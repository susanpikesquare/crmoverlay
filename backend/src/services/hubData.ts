/**
 * Hub Data Service
 *
 * Specialized data queries for role-based hubs (AE, AM, CSM)
 */

import { Connection } from 'jsforce';
import { Pool } from 'pg';
import { Account, Opportunity } from './salesforceData';
import * as agentforce from './agentforceService';
import { getQuotaFieldName } from './configService';
import { AdminSettingsService } from './adminSettings';

/**
 * AE Hub Metrics
 */
export interface AEMetrics {
  quotaAttainmentYTD: number; // Percentage
  pipelineCoverage: number; // Ratio
  hotProspectsCount: number;
  avgDealSize: number;
}

/**
 * AM Hub Metrics
 */
export interface AMMetrics {
  renewalsAtRiskCount: number;
  expansionPipeline: number; // Dollar amount
  avgContractValue: number;
}

/**
 * CSM Hub Metrics
 */
export interface CSMMetrics {
  accountsAtRisk: number;
  avgHealthScore: number;
  upcomingRenewals: number;
  adoptionTrend: number; // Percentage change
}

/**
 * Priority Account (for AE hub)
 */
export interface PriorityAccount extends Account {
  priorityTier: '🔥 Hot' | '🔶 Warm' | '🔵 Cool';
  employeeCount: number;
  employeeGrowthPct: number;
  intentScore: number;
  buyingStage: string;
  techStack: string;
  topSignal: string;
  aiRecommendation: string;
  // Grouping fields
  isGroup?: boolean;
  groupCount?: number;
  groupedAccounts?: Account[];
  domain?: string;
}

/**
 * At-Risk Deal (for AE hub)
 */
export interface AtRiskDeal extends Opportunity {
  daysStale: number;
  meddpiccScore: number;
  warning: string;
  aiRecommendation: string;
}

/**
 * Renewal Account (for AM hub)
 */
export interface RenewalAccount extends Account {
  daysToRenewal: number;
  contractValue: number;
  healthScore: number;
  renewalRisk: 'At Risk' | 'On Track' | 'Expansion Opportunity';
  keySignals: string[];
  aiRecommendation: string;
}

/**
 * Helper function to calculate days between dates
 */
function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Extract domain/company key from account name for grouping
 * Examples: "Park Hyatt" → "hyatt", "Grand Hyatt" → "hyatt", "TechCorp Inc" → "techcorp"
 */
function extractDomainKey(accountName: string): string {
  // Remove common suffixes
  let cleaned = accountName
    .toLowerCase()
    .replace(/\s+(inc|llc|ltd|corporation|corp|company|co|group|international|intl)\.?$/i, '')
    .trim();

  // Extract base company name (last significant word usually)
  const words = cleaned.split(/\s+/);

  // For multi-word companies, check if last word is the key identifier
  // e.g., "Park Hyatt" → "hyatt", "Grand Hyatt" → "hyatt"
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    // If last word is substantial (>3 chars), it's likely the key
    if (lastWord.length > 3) {
      return lastWord;
    }
  }

  // Otherwise use full cleaned name
  return cleaned.replace(/\s+/g, '');
}

/**
 * Get configured opportunity amount field name
 */
async function getAmountFieldName(pool: Pool): Promise<string> {
  try {
    const adminSettings = new AdminSettingsService(pool);
    const config = await adminSettings.getSalesforceFieldConfig();
    return config.opportunityAmountField || 'Amount';
  } catch (error) {
    console.error('Error fetching amount field config:', error);
    return 'Amount'; // Fallback to default
  }
}

async function getForecastCategoryFieldName(pool: Pool): Promise<string> {
  try {
    const adminSettings = new AdminSettingsService(pool);
    const config = await adminSettings.getSalesforceFieldConfig();
    return config.forecastCategoryField || 'ForecastCategory';
  } catch (error) {
    console.error('Error fetching forecast category field config:', error);
    return 'ForecastCategory';
  }
}

/**
 * Group accounts by parent company/domain
 */
function groupAccountsByDomain(accounts: any[]): any[] {
  const domainMap = new Map<string, any[]>();

  // Group accounts by extracted domain
  accounts.forEach(account => {
    const domain = extractDomainKey(account.Name);
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain)!.push(account);
  });

  const grouped: any[] = [];

  // Convert groups to grouped accounts
  domainMap.forEach((group, domain) => {
    if (group.length === 1) {
      // Single account, no grouping needed
      grouped.push({ ...group[0], domain });
    } else {
      // Multiple accounts - create group
      // Use highest priority account as representative
      const sortedByIntent = group.sort((a, b) =>
        (b.intentScore || 0) - (a.intentScore || 0)
      );
      const representative = sortedByIntent[0];

      grouped.push({
        ...representative,
        domain,
        isGroup: true,
        groupCount: group.length,
        groupedAccounts: group,
        // Aggregate metrics
        employeeCount: group.reduce((sum, acc) => sum + (acc.employeeCount || 0), 0),
      });
    }
  });

  return grouped;
}

/**
 * Calculate qualification score from standard fields
 * Since we're not querying custom MEDDPICC fields, use Probability as primary indicator
 */
function calculateMEDDPICCScore(opp: Opportunity): number {
  // Use Probability as the primary indicator (it's a standard field)
  // Convert probability (0-100) to a qualification score
  if (opp.Probability !== undefined && opp.Probability !== null) {
    return opp.Probability;
  }

  // Fallback if Probability is not set - estimate from other standard fields
  let score = 30; // base score for opportunities without probability
  if (opp.NextStep && String(opp.NextStep).trim().length > 0) score += 20;
  if (opp.Description && String(opp.Description).trim().length > 50) score += 15;
  if (opp.StageName && !['Prospecting', 'Qualification'].includes(opp.StageName)) score += 15;

  return Math.min(score, 100);
}

/**
 * Generate AI recommendation for priority account using Agentforce
 * Falls back to standard fields if custom fields don't exist
 */
async function generateAccountRecommendation(
  connection: Connection,
  account: Account
): Promise<string> {
  try {
    // Use available fields - custom or standard
    const intentScore = (account as any).intentScore || 0;
    const buyingStage = account.Rating || account.Type || '';
    const employeeCount = account.NumberOfEmployees || 0;
    const industry = account.Industry || '';
    const revenue = account.AnnualRevenue || 0;

    const recommendation = await agentforce.getRecommendation(connection, {
      objectType: 'Account',
      recordId: account.Id,
      data: {
        intentScore,
        buyingStage,
        employeeCount,
        industry,
        revenue,
      },
      promptType: 'ae_priority_account',
    });

    return recommendation.text;
  } catch (error) {
    console.error('Error generating account recommendation:', error);
    // Fallback to simple recommendation based on standard fields
    const rating = account.Rating || '';
    const employeeCount = account.NumberOfEmployees || 0;
    const revenue = account.AnnualRevenue || 0;

    if (rating === 'Hot' || employeeCount > 1000 || revenue > 10000000) {
      return 'High-value prospect. Schedule discovery call this week to understand needs.';
    } else if (rating === 'Warm' || employeeCount > 500) {
      return 'Promising prospect. Send relevant case studies and request intro meeting.';
    }
    return 'Continue nurturing. Share educational content and monitor engagement.';
  }
}

/**
 * Generate AI recommendation for at-risk deal using Agentforce
 * Falls back to standard fields if custom fields don't exist
 */
async function generateDealRecommendation(
  connection: Connection,
  opp: Opportunity,
  daysSinceActivity: number
): Promise<string> {
  try {
    const meddpiccScore = calculateMEDDPICCScore(opp);
    const missingElements = [];

    // Check for missing information in standard fields
    if (!opp.NextStep || String(opp.NextStep).trim().length === 0) {
      missingElements.push('Next Step');
    }
    if (!opp.Description || String(opp.Description).trim().length < 20) {
      missingElements.push('Description');
    }
    if (!opp.Type) {
      missingElements.push('Opportunity Type');
    }

    const recommendation = await agentforce.getRecommendation(connection, {
      objectType: 'Opportunity',
      recordId: opp.Id,
      data: {
        daysSinceActivity,
        meddpiccScore,
        missingElements,
        stage: opp.StageName,
        amount: opp.Amount,
        probability: opp.Probability || 0,
      },
      promptType: 'ae_at_risk_deal',
    });

    return recommendation.text;
  } catch (error) {
    console.error('Error generating deal recommendation:', error);
    // Fallback based on staleness and missing data
    if (daysSinceActivity > 30) {
      return `Critical: No activity in ${daysSinceActivity} days. Schedule urgent check-in call and confirm budget/timeline.`;
    } else if (daysSinceActivity > 21) {
      return `High priority: ${daysSinceActivity} days stale. Reach out to champion and schedule next steps meeting.`;
    } else if (!opp.NextStep || String(opp.NextStep).trim().length === 0) {
      return 'Define clear next steps with buyer. Schedule follow-up meeting to move deal forward.';
    }
    return 'Update close date and confirm decision timeline to maintain momentum.';
  }
}

// ============================================================================
// AE COCKPIT QUERIES
// ============================================================================

/**
 * Get AE dashboard metrics
 */
export async function getAEMetrics(
  connection: Connection,
  userId: string,
  pool: Pool,
  timeframe: 'annual' | 'quarterly' = 'annual'
): Promise<AEMetrics> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const amountField = await getAmountFieldName(pool);

  try {
    // Calculate date ranges based on timeframe
    let startDate: Date;
    let endDate: Date;
    let quotaType: 'annual' | 'quarterly' | 'monthly';

    if (timeframe === 'quarterly') {
      // Calculate current quarter
      const currentMonth = now.getMonth();
      const currentQuarter = Math.floor(currentMonth / 3);
      startDate = new Date(currentYear, currentQuarter * 3, 1);
      endDate = new Date(currentYear, currentQuarter * 3 + 3, 0);
      quotaType = 'quarterly';
    } else {
      // Annual - calendar year
      startDate = new Date(currentYear, 0, 1);
      endDate = new Date(currentYear, 11, 31);
      quotaType = 'annual';
    }

    // Get user quota from Salesforce
    const quotaFieldName = getQuotaFieldName(quotaType);
    let quota = timeframe === 'quarterly' ? 250000 : 1000000; // Default fallback

    try {
      const userQuery = `SELECT Id, ${quotaFieldName} FROM User WHERE Id = '${userId}' LIMIT 1`;
      const userResult = await connection.query(userQuery);
      if (userResult.records && userResult.records.length > 0) {
        const userQuota = (userResult.records[0] as any)[quotaFieldName];
        if (userQuota && userQuota > 0) {
          quota = userQuota;
        }
      }
    } catch (quotaError) {
      console.log(`Note: Could not fetch user quota from field ${quotaFieldName}, using default`);
    }

    // Get closed won opps for quota attainment
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const closedWonQuery = `
      SELECT Id, ${amountField}
      FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsWon = true
        AND CloseDate >= ${startDateStr}
        AND CloseDate <= ${endDateStr}
    `;

    // Get pipeline (open opps)
    const pipelineQuery = `
      SELECT Id, ${amountField}
      FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsClosed = false
    `;

    // Get hot prospects (accounts owned by user, recently created or modified)
    const hotProspectsQuery = `
      SELECT Id
      FROM Account
      WHERE OwnerId = '${userId}'
        AND (CreatedDate = LAST_N_DAYS:30 OR LastModifiedDate = LAST_N_DAYS:30)
    `;

    const [closedWonResult, pipelineResult, hotProspectsResult] = await Promise.all([
      connection.query(closedWonQuery),
      connection.query(pipelineQuery),
      connection.query(hotProspectsQuery),
    ]);

    // Calculate totals from records
    const closedWonTotal = (closedWonResult.records || []).reduce((sum: number, record: any) => {
      return sum + (record[amountField] || 0);
    }, 0);

    const pipelineRecords = pipelineResult.records || [];
    const pipelineTotal = pipelineRecords.reduce((sum: number, record: any) => {
      return sum + (record[amountField] || 0);
    }, 0);
    const pipelineCount = pipelineRecords.length;
    const hotProspects = (hotProspectsResult.records || []).length;

    const quotaRemaining = Math.max(0, quota - closedWonTotal);
    const pipelineCoverage = quotaRemaining > 0 ? pipelineTotal / quotaRemaining : 0;

    return {
      quotaAttainmentYTD: quota > 0 ? (closedWonTotal / quota) * 100 : 0,
      pipelineCoverage,
      hotProspectsCount: hotProspects,
      avgDealSize: pipelineCount > 0 ? Math.round(pipelineTotal / pipelineCount) : 0,
    };
  } catch (error) {
    console.error('Error fetching AE metrics:', error);
    return {
      quotaAttainmentYTD: 0,
      pipelineCoverage: 0,
      hotProspectsCount: 0,
      avgDealSize: 0,
    };
  }
}

/**
 * Get priority accounts for AE (recently active accounts)
 */
export async function getPriorityAccounts(
  connection: Connection,
  userId: string
): Promise<PriorityAccount[]> {
  // Query high-value accounts WITHOUT open opportunities (potential new business)
  // These are priority accounts to target for new deals
  // Note: Not using Rating field as it may not exist in all Salesforce orgs
  const query = `
    SELECT Id, Name, Industry, OwnerId, NumberOfEmployees,
           Type, AnnualRevenue,
           CreatedDate, LastModifiedDate,
           (SELECT Id, Name FROM Opportunities WHERE IsClosed = false LIMIT 1)
    FROM Account
    WHERE Id NOT IN (
      SELECT AccountId FROM Opportunity WHERE IsClosed = false
    )
    AND (
      NumberOfEmployees > 500
      OR AnnualRevenue > 1000000
    )
    ORDER BY AnnualRevenue DESC NULLS LAST, NumberOfEmployees DESC NULLS LAST, LastModifiedDate DESC
    LIMIT 50
  `;

  try {
    const result = await connection.query<Account>(query);
    const accounts = result.records || [];

    console.log(`[DEBUG] getPriorityAccounts - Query returned ${accounts.length} accounts`);

    if (accounts.length > 0) {
      // Log first account for debugging
      const sample = accounts[0];
      console.log(`[DEBUG] Sample account:`, {
        Name: sample.Name,
        NumberOfEmployees: sample.NumberOfEmployees,
        AnnualRevenue: sample.AnnualRevenue,
        Type: sample.Type
      });
    }

    // Transform accounts with data calculated from standard fields
    const transformedAccounts = accounts.map((account, index) => {
      const employeeCount = account.NumberOfEmployees || 0;
      const revenue = account.AnnualRevenue || 0;

      // Calculate score from employee count and revenue only
      let score = 50; // base score
      if (employeeCount > 1000) score += 20;
      else if (employeeCount > 500) score += 15;
      else if (employeeCount > 100) score += 10;

      if (revenue > 10000000) score += 15;
      else if (revenue > 1000000) score += 10;
      else if (revenue > 100000) score += 5;

      const intentScore = Math.min(100, score);

      // Determine priority tier based on intent score
      let priorityTier: '🔥 Hot' | '🔶 Warm' | '🔵 Cool';
      if (intentScore >= 75) {
        priorityTier = '🔥 Hot';
      } else if (intentScore >= 60) {
        priorityTier = '🔶 Warm';
      } else {
        priorityTier = '🔵 Cool';
      }

      // Log scoring details for first 3 accounts
      if (index < 3) {
        console.log(`[DEBUG] Account #${index + 1} scoring:`, {
          name: account.Name,
          employeeCount,
          revenue,
          calculatedScore: score,
          intentScore,
          priorityTier
        });
      }

      // Use Type for buying stage
      const buyingStage = account.Type || 'Prospect';

      // Calculate days since last activity
      const daysSinceUpdate = account.LastModifiedDate
        ? daysBetween(account.LastModifiedDate, new Date().toISOString())
        : 999;

      return {
        ...account,
        priorityTier,
        employeeCount,
        employeeGrowthPct: 0, // Not available from standard fields
        intentScore,
        buyingStage,
        techStack: account.Industry || 'Unknown',
        topSignal: `${buyingStage !== 'Active' ? buyingStage + ' • ' : ''}${daysSinceUpdate < 7 ? 'Recently active' : 'Last updated ' + daysSinceUpdate + ' days ago'}`,
      };
    });

    // Group accounts by domain/parent company
    const groupedAccounts = groupAccountsByDomain(transformedAccounts);

    // Add AI recommendations to grouped accounts
    const priorityAccounts = await Promise.all(
      groupedAccounts.map(async account => {
        // Get AI recommendation for the representative account
        const aiRecommendation = await generateAccountRecommendation(connection, account);

        return {
          ...account,
          aiRecommendation,
        };
      })
    );

    // Sort by intent score descending
    const sortedAccounts = priorityAccounts.sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0));

    // Log final distribution
    const tierCounts = sortedAccounts.reduce((acc, account) => {
      acc[account.priorityTier] = (acc[account.priorityTier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`[DEBUG] Priority account distribution:`, tierCounts);
    console.log(`[DEBUG] Returning ${sortedAccounts.length} priority accounts`);

    return sortedAccounts;
  } catch (error) {
    console.error('Error fetching priority accounts:', error);
    return [];
  }
}

/**
 * Get at-risk deals for AE (stale deals based on standard fields)
 */
export async function getAtRiskDeals(
  connection: Connection,
  userId: string,
  pool: Pool
): Promise<AtRiskDeal[]> {
  const amountField = await getAmountFieldName(pool);

  // Query only standard Salesforce fields
  const query = `
    SELECT Id, Name, AccountId, Account.Name, ${amountField}, StageName,
           CloseDate, LastModifiedDate, CreatedDate, NextStep, Description,
           Probability, Type, LeadSource
    FROM Opportunity
    WHERE OwnerId = '${userId}'
      AND IsClosed = false
      AND StageName NOT IN ('Prospecting', 'Qualification')
    ORDER BY LastModifiedDate ASC
    LIMIT 20
  `;

  try {
    const result = await connection.query<Opportunity>(query);
    const opportunities = result.records || [];

    const now = new Date();

    // Filter opportunities that are stale
    const filteredOpps = opportunities.filter(opp => {
      const daysSinceActivity = daysBetween(opp.LastModifiedDate || now.toISOString(), now);
      // Only include if stale (>14 days)
      return daysSinceActivity >= 14;
    });

    // Process with AI recommendations in parallel
    const atRiskDeals = await Promise.all(
      filteredOpps.map(async opp => {
        const daysSinceActivity = daysBetween(opp.LastModifiedDate || now.toISOString(), now);

        // Calculate a simple qualification score based on available fields
        let qualificationScore = 50; // base score
        if (opp.NextStep && opp.NextStep.trim().length > 0) qualificationScore += 20;
        if (opp.Description && opp.Description.trim().length > 50) qualificationScore += 15;
        if (opp.Probability && opp.Probability > 50) qualificationScore += 15;

        const meddpiccScore = qualificationScore;

        let warning = '';
        if (daysSinceActivity > 30) {
          warning = `⚠️ No activity in ${daysSinceActivity} days`;
        } else if (daysSinceActivity > 21) {
          warning = `⚡ ${daysSinceActivity} days since last update`;
        } else if (daysSinceActivity > 14) {
          warning = `⏰ ${daysSinceActivity} days since last update`;
        }

        if (!opp.NextStep || opp.NextStep.trim().length === 0) {
          warning += warning ? ' • No next step defined' : '📋 No next step defined';
        }

        // Get AI recommendation
        const aiRecommendation = await generateDealRecommendation(connection, opp, daysSinceActivity);

        return {
          ...opp,
          Amount: opp[amountField] || 0, // Normalize amount field to Amount for frontend
          Account: {
            Name: opp.Account?.Name || 'Unknown Account',
          },
          daysStale: daysSinceActivity,
          meddpiccScore,
          warning,
          aiRecommendation,
        };
      })
    );

    return atRiskDeals;
  } catch (error) {
    console.error('Error fetching at-risk deals:', error);
    return [];
  }
}

// ============================================================================
// AM COCKPIT QUERIES
// ============================================================================

/**
 * Get AM dashboard metrics
 */
export async function getAMMetrics(
  connection: Connection,
  userId: string,
  pool?: Pool
): Promise<AMMetrics> {
  const amountField = pool ? await getAmountFieldName(pool) : 'Amount';

  const renewalsAtRiskQuery = `
    SELECT COUNT(Id) cnt
    FROM Account
    WHERE OwnerId = '${userId}'
      AND (Risk__c = 'Red' OR Current_Gainsight_Score__c < 50)
  `;

  const expansionPipelineQuery = `
    SELECT SUM(${amountField}) total
    FROM Opportunity
    WHERE OwnerId = '${userId}'
      AND IsClosed = false
      AND (Type = 'Upsell' OR Type = 'Expansion' OR Type = 'Add-On'
           OR Type = 'Customer Expansion' OR Type = 'Renewal + Expansion')
  `;

  const avgContractQuery = `
    SELECT AVG(Total_ARR__c) avgValue
    FROM Account
    WHERE OwnerId = '${userId}'
      AND Total_ARR__c > 0
  `;

  try {
    const [renewalsAtRisk, expansionPipeline, avgContract] = await Promise.all([
      connection.query(renewalsAtRiskQuery),
      connection.query(expansionPipelineQuery),
      connection.query(avgContractQuery),
    ]);

    const atRiskCount = (renewalsAtRisk.records[0] as any)?.cnt || 0;
    const expansionTotal = (expansionPipeline.records[0] as any)?.total || 0;
    const avgValue = (avgContract.records[0] as any)?.avgValue || 0;

    return {
      renewalsAtRiskCount: atRiskCount,
      expansionPipeline: expansionTotal,
      avgContractValue: avgValue,
    };
  } catch (error) {
    console.error('Error fetching AM metrics:', error);
    return {
      renewalsAtRiskCount: 0,
      expansionPipeline: 0,
      avgContractValue: 0,
    };
  }
}

/**
 * Get renewal accounts for AM
 */
export async function getRenewalAccounts(
  connection: Connection,
  userId: string
): Promise<RenewalAccount[]> {
  const query = `
    SELECT Id, Name, Industry, OwnerId,
           Agreement_Expiry_Date__c, Total_ARR__c,
           Current_Gainsight_Score__c, Risk__c,
           Customer_Stage__c, of_Axonify_Users__c,
           Last_QBR__c, Risk_Notes__c,
           CreatedDate, LastModifiedDate
    FROM Account
    WHERE OwnerId = '${userId}'
      AND Agreement_Expiry_Date__c != null
      AND Agreement_Expiry_Date__c <= NEXT_N_DAYS:180
    ORDER BY Agreement_Expiry_Date__c ASC
    LIMIT 20
  `;

  try {
    const result = await connection.query<Account>(query);
    const accounts = result.records || [];

    const now = new Date();

    // Process accounts with AI recommendations in parallel
    const renewalAccounts = await Promise.all(
      accounts.map(async account => {
        const renewalDate = account.Agreement_Expiry_Date__c
          ? new Date(account.Agreement_Expiry_Date__c)
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // Default to 90 days out

        const daysToRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const healthScore = account.Current_Gainsight_Score__c || 0;
        const risk = account.Risk__c || 'Green';

        let renewalRisk: 'At Risk' | 'On Track' | 'Expansion Opportunity';
        if (risk === 'Red' || risk === 'At Risk') {
          renewalRisk = 'At Risk';
        } else if (healthScore > 80 && (account.of_Axonify_Users__c || 0) > 500) {
          renewalRisk = 'Expansion Opportunity';
        } else {
          renewalRisk = 'On Track';
        }

        const keySignals: string[] = [];
        const riskFactors: string[] = [];

        if (healthScore < 60) {
          keySignals.push(`Low health score: ${healthScore}`);
          riskFactors.push('Low health score');
        }
        if (daysToRenewal < 60) {
          keySignals.push(`Renewal in ${daysToRenewal} days`);
        }
        if (!account.Last_QBR__c || daysBetween(account.Last_QBR__c, now) > 90) {
          keySignals.push('QBR overdue');
          riskFactors.push('QBR overdue');
        }
        if (account.Risk_Notes__c) {
          keySignals.push('Has risk notes');
          riskFactors.push('Has active risk notes');
        }

        // Get AI recommendation based on renewal risk
        let aiRecommendation = '';
        try {
          if (renewalRisk === 'At Risk') {
            const recommendation = await agentforce.getRecommendation(connection, {
              objectType: 'Account',
              recordId: account.Id,
              data: {
                daysToRenewal,
                healthScore,
                riskFactors,
                contractValue: account.Total_ARR__c || 0,
              },
              promptType: 'am_renewal_risk',
            });
            aiRecommendation = recommendation.text;
          } else if (renewalRisk === 'Expansion Opportunity') {
            const recommendation = await agentforce.getRecommendation(connection, {
              objectType: 'Account',
              recordId: account.Id,
              data: {
                healthScore,
                usagePercent: account.License_Utilization_Max__c || 0,
                employeeGrowth: 0,
                currentValue: account.Total_ARR__c || 0,
              },
              promptType: 'am_expansion',
            });
            aiRecommendation = recommendation.text;
          } else {
            aiRecommendation = `Renewal tracking well. Schedule check-in 60 days before renewal`;
          }
        } catch (error) {
          console.error('Error generating renewal recommendation:', error);
          // Fallback
          if (renewalRisk === 'At Risk') {
            aiRecommendation = `Schedule QBR immediately - ${daysToRenewal} days to renewal with ${healthScore} health score`;
          } else if (renewalRisk === 'Expansion Opportunity') {
            aiRecommendation = `Strong renewal candidate. Prepare expansion proposal for additional users/features`;
          } else {
            aiRecommendation = `Renewal tracking well. Schedule check-in 60 days before renewal`;
          }
        }

        return {
          ...account,
          daysToRenewal,
          contractValue: account.Total_ARR__c || 0,
          healthScore,
          renewalRisk,
          keySignals,
          aiRecommendation,
        };
      })
    );

    return renewalAccounts;
  } catch (error) {
    console.error('Error fetching renewal accounts:', error);
    return [];
  }
}

// ============================================================================
// CSM COCKPIT QUERIES
// ============================================================================

/**
 * Get CSM dashboard metrics
 */
export async function getCSMMetrics(
  connection: Connection,
  userId: string
): Promise<CSMMetrics> {
  const atRiskQuery = `
    SELECT COUNT() total
    FROM Account
    WHERE Customer_Success_Manager__c = '${userId}'
      AND (Risk__c = 'Red' OR Current_Gainsight_Score__c < 60)
  `;

  const avgHealthQuery = `
    SELECT AVG(Current_Gainsight_Score__c) avg
    FROM Account
    WHERE Customer_Success_Manager__c = '${userId}'
      AND Current_Gainsight_Score__c != null
  `;

  const upcomingRenewalsQuery = `
    SELECT COUNT() total
    FROM Account
    WHERE Customer_Success_Manager__c = '${userId}'
      AND Agreement_Expiry_Date__c != null
      AND Agreement_Expiry_Date__c <= NEXT_N_DAYS:90
  `;

  try {
    const [atRisk, avgHealth, upcomingRenewals] = await Promise.all([
      connection.query(atRiskQuery),
      connection.query(avgHealthQuery),
      connection.query(upcomingRenewalsQuery),
    ]);

    return {
      accountsAtRisk: (atRisk.records[0] as any)?.total || 0,
      avgHealthScore: (avgHealth.records[0] as any)?.avg || 0,
      upcomingRenewals: (upcomingRenewals.records[0] as any)?.total || 0,
      adoptionTrend: 0,
    };
  } catch (error) {
    console.error('Error fetching CSM metrics:', error);
    return {
      accountsAtRisk: 0,
      avgHealthScore: 0,
      upcomingRenewals: 0,
      adoptionTrend: 0,
    };
  }
}

/**
 * At-Risk Account for CSM Hub
 */
export interface AtRiskAccount {
  id: string;
  name: string;
  healthScore: number;
  riskFactors: string[];
  arr?: number;
  daysToRenewal?: number;
  lastContactDate?: string;
  csm?: string;
}

/**
 * Get at-risk accounts for CSM Hub
 * Returns accounts with low health scores or risk flags
 */
export async function getAtRiskAccounts(
  connection: Connection,
  userId: string
): Promise<AtRiskAccount[]> {
  try {
    // Primary query with full fields - broadened to include active customers
    const query = `
      SELECT Id, Name, Current_Gainsight_Score__c, Risk__c,
             Total_ARR__c, Agreement_Expiry_Date__c,
             LastActivityDate, Customer_Success_Manager__r.Name,
             Customer_Stage__c
      FROM Account
      WHERE (Customer_Success_Manager__c = '${userId}' OR OwnerId = '${userId}')
        AND (Customer_Stage__c IN ('Customer', 'Active', 'Active Customer', 'Renewal', 'Implementation') OR Customer_Stage__c = null)
        AND (Risk__c = 'Red' OR Risk__c = 'At Risk' OR Current_Gainsight_Score__c < 60 OR Agreement_Expiry_Date__c <= NEXT_N_DAYS:90)
      ORDER BY Current_Gainsight_Score__c ASC NULLS LAST
      LIMIT 50
    `;

    // Fallback query if custom fields don't exist
    const fallbackQuery = `
      SELECT Id, Name, LastActivityDate
      FROM Account
      WHERE OwnerId = '${userId}'
      ORDER BY LastActivityDate ASC NULLS LAST
      LIMIT 20
    `;

    let accounts: any[] = [];
    let hasCustomFields = true;

    try {
      const result = await connection.query(query);
      accounts = result.records as any[];
    } catch (error: any) {
      if (error.errorCode === 'INVALID_FIELD' || error.message?.includes('No such column')) {
        console.warn('At-risk fields not found, using fallback query');
        hasCustomFields = false;
        const fallbackResult = await connection.query(fallbackQuery);
        accounts = fallbackResult.records as any[];
      } else {
        throw error;
      }
    }

    // Transform to AtRiskAccount format
    const atRiskAccounts: AtRiskAccount[] = accounts.map(acc => {
      const riskFactors: string[] = [];

      if (hasCustomFields) {
        // Determine risk factors based on available data
        const healthScore = acc.Current_Gainsight_Score__c || 0;
        if (healthScore < 40) {
          riskFactors.push('Critical health score');
        } else if (healthScore < 60) {
          riskFactors.push('Low health score');
        }

        if (acc.Risk__c === 'Red' || acc.Risk__c === 'At Risk') {
          riskFactors.push('Flagged as at-risk');
        }

        // Calculate days to renewal
        let daysToRenewal: number | undefined;
        if (acc.Agreement_Expiry_Date__c) {
          const renewalDate = new Date(acc.Agreement_Expiry_Date__c);
          const today = new Date();
          daysToRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (daysToRenewal <= 30) {
            riskFactors.push('Renewal in <30 days');
          } else if (daysToRenewal <= 60) {
            riskFactors.push('Renewal approaching');
          }
        }

        // Check last activity
        if (acc.LastActivityDate) {
          const lastActivity = new Date(acc.LastActivityDate);
          const daysSinceActivity = Math.ceil((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceActivity > 60) {
            riskFactors.push('No recent engagement');
          }
        } else {
          riskFactors.push('No activity recorded');
        }

        return {
          id: acc.Id,
          name: acc.Name,
          healthScore: acc.Current_Gainsight_Score__c || 0,
          riskFactors,
          arr: acc.Total_ARR__c,
          daysToRenewal,
          lastContactDate: acc.LastActivityDate,
          csm: acc.Customer_Success_Manager__r?.Name,
        };
      } else {
        // Fallback - just use last activity as risk indicator
        if (acc.LastActivityDate) {
          const lastActivity = new Date(acc.LastActivityDate);
          const daysSinceActivity = Math.ceil((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceActivity > 90) {
            riskFactors.push('No activity in 90+ days');
          } else if (daysSinceActivity > 60) {
            riskFactors.push('Low engagement');
          }
        } else {
          riskFactors.push('No activity recorded');
        }

        return {
          id: acc.Id,
          name: acc.Name,
          healthScore: 50, // Default when no health score available
          riskFactors,
          lastContactDate: acc.LastActivityDate,
        };
      }
    });

    // Sort by health score (lowest first)
    return atRiskAccounts.sort((a, b) => a.healthScore - b.healthScore);
  } catch (error) {
    console.error('Error fetching at-risk accounts:', error);
    return [];
  }
}

// ============================================================================
// SALES LEADER DASHBOARD
// ============================================================================

export interface SalesLeaderDashboard {
  teamMetrics: {
    quotaAttainment: {
      current: number;
      target: number;
      percentage: number;
      trend: number;
    };
    pipelineCoverage: {
      pipeline: number;
      remainingQuota: number;
      ratio: number;
      status: string;
    };
    atRiskDeals: {
      count: number;
      value: number;
    };
    avgDealCycle: {
      days: number;
      trend: number;
    };
  };
  repPerformance: Array<{
    repId: string;
    repName: string;
    quotaAttainment: number;
    pipelineCoverage: number;
    activeDeals: number;
    atRiskDeals: number;
    avgDealSize: number;
    lastActivity: number;
  }>;
  coachingOpportunities: {
    stuckDeals: Array<{
      id: string;
      accountName: string;
      opportunityName: string;
      owner: string;
      amount: number;
      stage: string;
      daysInStage: number;
    }>;
    lowMEDDPICC: Array<{
      id: string;
      accountName: string;
      opportunityName: string;
      owner: string;
      amount: number;
      stage: string;
      meddpiccScore: number;
    }>;
    coldAccounts: Array<{
      id: string;
      accountName: string;
      owner: string;
      lastActivityDate: string | null;
      daysSinceActivity: number | null;
    }>;
    largeDeals: Array<{
      id: string;
      accountName: string;
      opportunityName: string;
      owner: string;
      amount: number;
      stage: string;
      daysInStage: number;
    }>;
  };
  recentWins: Array<{
    id: string;
    accountName: string;
    amount: number;
    owner: string;
    closeDate: string;
  }>;
  recentLosses: Array<{
    id: string;
    accountName: string;
    amount: number;
    owner: string;
    lossReason: string;
  }>;
}

interface DashboardFilters {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  teamFilter?: string;
  reps?: string[];
  minDealSize?: number;
  includeAll?: boolean;
}

/**
 * Build SOQL date filter based on dateRange parameter
 * Fiscal year starts in February (month 2)
 */
function buildDateFilter(dateRange?: string, startDate?: string, endDate?: string): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed (0 = January)
  const currentQuarter = Math.floor(currentMonth / 3) + 1;

  // Fiscal year starts in February (month 1 in 0-indexed)
  const FISCAL_YEAR_START_MONTH = 1; // February (0-indexed)

  // Calculate fiscal year and quarter
  const fiscalYear = currentMonth >= FISCAL_YEAR_START_MONTH ? currentYear : currentYear - 1;
  const fiscalMonth = currentMonth >= FISCAL_YEAR_START_MONTH
    ? currentMonth - FISCAL_YEAR_START_MONTH
    : currentMonth + (12 - FISCAL_YEAR_START_MONTH);
  const fiscalQuarter = Math.floor(fiscalMonth / 3) + 1;

  switch (dateRange) {
    // Standard date ranges
    case 'today':
      return 'CloseDate = TODAY';

    case 'yesterday':
      return 'CloseDate = YESTERDAY';

    case 'thisWeek':
      return 'CloseDate = THIS_WEEK';

    case 'lastWeek':
      return 'CloseDate = LAST_WEEK';

    case 'thisMonth':
      return 'CloseDate = THIS_MONTH';

    case 'lastMonth':
      return 'CloseDate = LAST_MONTH';

    // Calendar quarters
    case 'thisQuarter':
      return `CALENDAR_YEAR(CloseDate) = ${currentYear} AND CALENDAR_QUARTER(CloseDate) = ${currentQuarter}`;

    case 'lastQuarter': {
      const lastQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
      const lastQuarterYear = currentQuarter === 1 ? currentYear - 1 : currentYear;
      return `CALENDAR_YEAR(CloseDate) = ${lastQuarterYear} AND CALENDAR_QUARTER(CloseDate) = ${lastQuarter}`;
    }

    case 'nextQuarter': {
      const nextQuarter = currentQuarter === 4 ? 1 : currentQuarter + 1;
      const nextQuarterYear = currentQuarter === 4 ? currentYear + 1 : currentYear;
      return `CALENDAR_YEAR(CloseDate) = ${nextQuarterYear} AND CALENDAR_QUARTER(CloseDate) = ${nextQuarter}`;
    }

    // Fiscal quarters (fiscal year starts in February)
    case 'thisFiscalQuarter': {
      const fiscalQuarterStartMonth = FISCAL_YEAR_START_MONTH + ((fiscalQuarter - 1) * 3);
      const fiscalQuarterEndMonth = fiscalQuarterStartMonth + 2;

      // Handle month wrap-around
      if (fiscalQuarterEndMonth > 11) {
        const monthsInCurrentYear = 11 - fiscalQuarterStartMonth + 1;
        const monthsInNextYear = fiscalQuarterEndMonth - 11;
        return `((CALENDAR_YEAR(CloseDate) = ${fiscalYear} AND CALENDAR_MONTH(CloseDate) >= ${fiscalQuarterStartMonth + 1}) OR (CALENDAR_YEAR(CloseDate) = ${fiscalYear + 1} AND CALENDAR_MONTH(CloseDate) <= ${monthsInNextYear}))`;
      }
      return `CALENDAR_YEAR(CloseDate) = ${fiscalYear} AND CALENDAR_MONTH(CloseDate) >= ${fiscalQuarterStartMonth + 1} AND CALENDAR_MONTH(CloseDate) <= ${fiscalQuarterEndMonth + 1}`;
    }

    case 'lastFiscalQuarter': {
      const lastFiscalQuarter = fiscalQuarter === 1 ? 4 : fiscalQuarter - 1;
      const lastFiscalQuarterYear = fiscalQuarter === 1 ? fiscalYear - 1 : fiscalYear;
      const fiscalQuarterStartMonth = FISCAL_YEAR_START_MONTH + ((lastFiscalQuarter - 1) * 3);
      const fiscalQuarterEndMonth = fiscalQuarterStartMonth + 2;

      if (fiscalQuarterEndMonth > 11) {
        const monthsInCurrentYear = 11 - fiscalQuarterStartMonth + 1;
        const monthsInNextYear = fiscalQuarterEndMonth - 11;
        return `((CALENDAR_YEAR(CloseDate) = ${lastFiscalQuarterYear} AND CALENDAR_MONTH(CloseDate) >= ${fiscalQuarterStartMonth + 1}) OR (CALENDAR_YEAR(CloseDate) = ${lastFiscalQuarterYear + 1} AND CALENDAR_MONTH(CloseDate) <= ${monthsInNextYear}))`;
      }
      return `CALENDAR_YEAR(CloseDate) = ${lastFiscalQuarterYear} AND CALENDAR_MONTH(CloseDate) >= ${fiscalQuarterStartMonth + 1} AND CALENDAR_MONTH(CloseDate) <= ${fiscalQuarterEndMonth + 1}`;
    }

    // Fiscal years (fiscal year starts in February)
    case 'thisFiscalYear': {
      const fiscalYearStartDate = new Date(fiscalYear, FISCAL_YEAR_START_MONTH, 1);
      const fiscalYearEndDate = new Date(fiscalYear + 1, FISCAL_YEAR_START_MONTH, 0); // Last day of January next year
      return `CloseDate >= ${fiscalYearStartDate.toISOString().split('T')[0]} AND CloseDate <= ${fiscalYearEndDate.toISOString().split('T')[0]}`;
    }

    case 'lastFiscalYear': {
      const lastFiscalYear = fiscalYear - 1;
      const fiscalYearStartDate = new Date(lastFiscalYear, FISCAL_YEAR_START_MONTH, 1);
      const fiscalYearEndDate = new Date(lastFiscalYear + 1, FISCAL_YEAR_START_MONTH, 0);
      return `CloseDate >= ${fiscalYearStartDate.toISOString().split('T')[0]} AND CloseDate <= ${fiscalYearEndDate.toISOString().split('T')[0]}`;
    }

    // Calendar years
    case 'thisYear':
      return `CALENDAR_YEAR(CloseDate) = ${currentYear}`;

    case 'lastYear':
      return `CALENDAR_YEAR(CloseDate) = ${currentYear - 1}`;

    case 'nextYear':
      return `CALENDAR_YEAR(CloseDate) = ${currentYear + 1}`;

    // Rolling date ranges
    case 'last7Days':
      return 'CloseDate = LAST_N_DAYS:7';

    case 'last30Days':
      return 'CloseDate = LAST_N_DAYS:30';

    case 'last90Days':
      return 'CloseDate = LAST_N_DAYS:90';

    case 'last120Days':
      return 'CloseDate = LAST_N_DAYS:120';

    // Custom date range
    case 'custom':
      if (startDate && endDate) {
        return `CloseDate >= ${startDate} AND CloseDate <= ${endDate}`;
      } else if (startDate) {
        return `CloseDate >= ${startDate}`;
      } else if (endDate) {
        return `CloseDate <= ${endDate}`;
      }
      // Fall through to default if no dates provided
      return `CALENDAR_YEAR(CloseDate) = ${currentYear}`;

    // All time
    case 'all':
      return '1=1'; // No date filter

    // Default to this year
    default:
      return `CALENDAR_YEAR(CloseDate) = ${currentYear}`;
  }
}

/**
 * Get Sales Leader Dashboard data with team metrics and coaching opportunities
 */
export async function getSalesLeaderDashboard(
  connection: Connection,
  managerId: string,
  filters: DashboardFilters = {},
  pool?: Pool
): Promise<SalesLeaderDashboard> {
  try {
    const amountField = pool ? await getAmountFieldName(pool) : 'Amount';

    // Determine which users to query based on teamFilter
    let teamMembersQuery = '';
    let teamMembers: any[] = [];
    let teamMemberIds: string[] = [];

    const teamFilter = filters.teamFilter || 'myTeam';

    if (teamFilter === 'allUsers') {
      // Query all active users
      console.log('Team filter: all active users');
      teamMembersQuery = `
        SELECT Id, Name
        FROM User
        WHERE IsActive = true
        LIMIT 200
      `;
      const teamMembersResult = await connection.query(teamMembersQuery);
      teamMembers = teamMembersResult.records as any[];
      teamMemberIds = teamMembers.map(u => u.Id);
    } else if (teamFilter === 'myTeam') {
      // Query manager's direct reports (existing behavior)
      console.log('Team filter: my direct reports');
      teamMembersQuery = `
        SELECT Id, Name
        FROM User
        WHERE ManagerId = '${managerId}'
          AND IsActive = true
      `;
      const teamMembersResult = await connection.query(teamMembersQuery);
      teamMembers = teamMembersResult.records as any[];
      teamMemberIds = teamMembers.map(u => u.Id);

      // FALLBACK: If no direct reports found and includeAll is true, get ALL active users
      if (teamMemberIds.length === 0 && filters.includeAll) {
        console.log('No direct reports found - falling back to all active users');
        const allUsersQuery = `
          SELECT Id, Name
          FROM User
          WHERE IsActive = true
          LIMIT 200
        `;
        const allUsersResult = await connection.query(allUsersQuery);
        teamMembers = allUsersResult.records as any[];
        teamMemberIds = teamMembers.map(u => u.Id);

        if (teamMemberIds.length === 0) {
          return getEmptySalesLeaderDashboard();
        }
      } else if (teamMemberIds.length === 0) {
        // No direct reports and not fallback mode - return empty
        return getEmptySalesLeaderDashboard();
      }
    } else {
      // Specific user ID - query that user and their direct reports
      console.log(`Team filter: specific user ${teamFilter} and their reports`);

      // Get the specific user
      const specificUserQuery = `
        SELECT Id, Name
        FROM User
        WHERE Id = '${teamFilter}'
          AND IsActive = true
      `;
      const specificUserResult = await connection.query(specificUserQuery);
      const specificUser = specificUserResult.records as any[];

      // Get their direct reports
      const reportsQuery = `
        SELECT Id, Name
        FROM User
        WHERE ManagerId = '${teamFilter}'
          AND IsActive = true
      `;
      const reportsResult = await connection.query(reportsQuery);
      const reports = reportsResult.records as any[];

      // Combine the specific user and their reports
      teamMembers = [...specificUser, ...reports];
      teamMemberIds = teamMembers.map(u => u.Id);

      if (teamMemberIds.length === 0) {
        return getEmptySalesLeaderDashboard();
      }
    }

    // Apply rep filter if specified (overrides teamFilter)
    if (filters.reps && filters.reps.length > 0) {
      teamMemberIds = teamMemberIds.filter(id => filters.reps!.includes(id));
      teamMembers = teamMembers.filter(u => filters.reps!.includes(u.Id));
    }

    const teamMemberIdsStr = teamMemberIds.map(id => `'${id}'`).join(',');

    // Build date filter using helper function
    const dateFilter = buildDateFilter(filters.dateRange, filters.startDate, filters.endDate);

    // Get team quota attainment (closed won with date filter)
    const closedWonQuery = `
      SELECT SUM(${amountField}) total, OwnerId, Owner.Name
      FROM Opportunity
      WHERE OwnerId IN (${teamMemberIdsStr})
        AND IsWon = true
        AND ${dateFilter}
        ${filters.minDealSize ? `AND ${amountField} >= ${filters.minDealSize}` : ''}
      GROUP BY OwnerId, Owner.Name
    `;

    // Get team pipeline (open opps with filters)
    const pipelineQuery = `
      SELECT Id, Name, ${amountField}, StageName, OwnerId, Owner.Name, AccountId, Account.Name,
             CloseDate, CreatedDate, LastModifiedDate, Probability
      FROM Opportunity
      WHERE OwnerId IN (${teamMemberIdsStr})
        AND IsClosed = false
        ${filters.minDealSize ? `AND ${amountField} >= ${filters.minDealSize}` : ''}
    `;

    // Get recent wins (last 30 days)
    const recentWinsQuery = `
      SELECT Id, Name, ${amountField}, OwnerId, Owner.Name, AccountId, Account.Name, CloseDate
      FROM Opportunity
      WHERE OwnerId IN (${teamMemberIdsStr})
        AND IsWon = true
        AND CloseDate = LAST_N_DAYS:30
      ORDER BY CloseDate DESC
      LIMIT 10
    `;

    // Get recent losses (last 30 days)
    const recentLossesQuery = `
      SELECT Id, Name, ${amountField}, OwnerId, Owner.Name, AccountId, Account.Name, CloseDate
      FROM Opportunity
      WHERE OwnerId IN (${teamMemberIdsStr})
        AND IsWon = false
        AND IsClosed = true
        AND CloseDate = LAST_N_DAYS:30
      ORDER BY CloseDate DESC
      LIMIT 10
    `;

    // Query for cold accounts: accounts without open opportunities and minimal recent activity
    const coldAccountsQuery = `
      SELECT Id, Name, OwnerId, Owner.Name, LastActivityDate, LastModifiedDate
      FROM Account
      WHERE OwnerId IN (${teamMemberIdsStr})
        AND Id NOT IN (
          SELECT AccountId
          FROM Opportunity
          WHERE IsClosed = false
          AND AccountId != null
        )
      ORDER BY LastActivityDate ASC NULLS FIRST
      LIMIT 20
    `;

    // Execute all queries in parallel
    const [closedWonResult, pipelineResult, recentWinsResult, recentLossesResult, coldAccountsResult] = await Promise.all([
      connection.query(closedWonQuery),
      connection.query(pipelineQuery),
      connection.query(recentWinsQuery),
      connection.query(recentLossesQuery),
      connection.query(coldAccountsQuery),
    ]);

    const closedWonByRep = closedWonResult.records as any[];
    const allPipeline = pipelineResult.records as any[];
    const wins = recentWinsResult.records as any[];
    const losses = recentLossesResult.records as any[];
    const coldAccountsRaw = coldAccountsResult.records as any[];

    // Calculate team metrics
    const totalClosedWon = closedWonByRep.reduce((sum, r) => sum + (r.total || 0), 0);
    const teamQuotaTarget = teamMembers.length * 1000000; // $1M per rep - should come from actual quota fields
    const quotaPercentage = teamQuotaTarget > 0 ? (totalClosedWon / teamQuotaTarget) * 100 : 0;

    const totalPipeline = allPipeline.reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
    const remainingQuota = Math.max(0, teamQuotaTarget - totalClosedWon);
    const pipelineCoverageRatio = remainingQuota > 0 ? totalPipeline / remainingQuota : 0;

    let pipelineStatus = 'Healthy';
    if (pipelineCoverageRatio < 3) {
      pipelineStatus = 'At Risk';
    } else if (pipelineCoverageRatio < 4) {
      pipelineStatus = 'Monitor';
    }

    // Calculate at-risk deals
    const now = new Date();
    const atRiskDeals = allPipeline.filter(opp => {
      const daysSinceUpdate = daysBetween(opp.LastModifiedDate || now.toISOString(), now);
      const meddpiccScore = calculateMEDDPICCScore(opp);
      return daysSinceUpdate > 14 || meddpiccScore < 60;
    });
    const atRiskValue = atRiskDeals.reduce((sum, opp) => sum + (opp[amountField] || 0), 0);

    // Calculate average deal cycle (from created to closed for won deals this year)
    const avgDealCycleDays = 0;
    const avgDealCycleTrend = 0;

    // Build rep performance leaderboard
    const repPerformance = teamMembers.map(rep => {
      const repClosedWon = closedWonByRep.find(r => r.OwnerId === rep.Id);
      const closedWonAmount = repClosedWon?.total || 0;
      const repQuota = 0;
      const quotaAttainment = repQuota > 0 ? (closedWonAmount / repQuota) * 100 : 0;

      const repPipeline = allPipeline.filter(opp => opp.OwnerId === rep.Id);
      const totalRepPipeline = repPipeline.reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      const repRemainingQuota = Math.max(0, repQuota - closedWonAmount);
      const repPipelineCoverage = repRemainingQuota > 0 ? totalRepPipeline / repRemainingQuota : 0;

      const activeDeals = repPipeline.length;
      const repAtRiskDeals = repPipeline.filter(opp => {
        const daysSinceUpdate = daysBetween(opp.LastModifiedDate || now.toISOString(), now);
        const meddpiccScore = calculateMEDDPICCScore(opp);
        return daysSinceUpdate > 14 || meddpiccScore < 60;
      }).length;

      const avgDealSize = activeDeals > 0 ? Math.round(totalRepPipeline / activeDeals) : 0;

      // Get most recent activity date across all opps
      let lastActivityDays = 999;
      repPipeline.forEach(opp => {
        const days = daysBetween(opp.LastModifiedDate || now.toISOString(), now);
        if (days < lastActivityDays) {
          lastActivityDays = days;
        }
      });

      return {
        repId: rep.Id,
        repName: rep.Name,
        quotaAttainment,
        pipelineCoverage: repPipelineCoverage,
        activeDeals,
        atRiskDeals: repAtRiskDeals,
        avgDealSize,
        lastActivity: lastActivityDays,
      };
    });

    // Build coaching opportunities
    const stuckDeals = allPipeline
      .filter(opp => {
        const daysSinceUpdate = daysBetween(opp.LastModifiedDate || now.toISOString(), now);
        const createdDate = opp.CreatedDate ? new Date(opp.CreatedDate) : now;
        const daysInCurrentStage = daysBetween(opp.LastModifiedDate || createdDate.toISOString(), now);
        return daysInCurrentStage > 30; // Stuck in stage for 30+ days
      })
      .slice(0, 10)
      .map(opp => ({
        id: opp.Id,
        accountName: opp.Account?.Name || 'Unknown',
        opportunityName: opp.Name,
        owner: opp.Owner?.Name || 'Unknown',
        amount: opp[amountField] || 0,
        stage: opp.StageName,
        daysInStage: daysBetween(opp.LastModifiedDate || opp.CreatedDate || now.toISOString(), now),
      }));

    const lowMEDDPICC = allPipeline
      .filter(opp => {
        const meddpiccScore = calculateMEDDPICCScore(opp);
        return meddpiccScore < 60 && opp.StageName !== 'Prospecting' && opp.StageName !== 'Qualification';
      })
      .slice(0, 10)
      .map(opp => ({
        id: opp.Id,
        accountName: opp.Account?.Name || 'Unknown',
        opportunityName: opp.Name,
        owner: opp.Owner?.Name || 'Unknown',
        amount: opp[amountField] || 0,
        stage: opp.StageName,
        meddpiccScore: calculateMEDDPICCScore(opp),
      }));

    // Cold Accounts: accounts without open opportunities and no recent activity
    const coldAccounts = coldAccountsRaw
      .filter(account => {
        // Filter to accounts with no activity in 30+ days (or never)
        const lastActivity = account.LastActivityDate || account.LastModifiedDate;
        if (!lastActivity) return true; // No activity ever
        const daysSinceActivity = daysBetween(lastActivity, now);
        return daysSinceActivity > 30;
      })
      .slice(0, 10)
      .map(account => ({
        id: account.Id,
        accountName: account.Name || 'Unknown',
        owner: account.Owner?.Name || 'Unknown',
        lastActivityDate: account.LastActivityDate,
        daysSinceActivity: account.LastActivityDate
          ? daysBetween(account.LastActivityDate, now)
          : null,
      }));

    const largeDeals = allPipeline
      .filter(opp => (opp[amountField] || 0) >= 100000) // $100K+ deals
      .sort((a, b) => (b[amountField] || 0) - (a[amountField] || 0))
      .slice(0, 10)
      .map(opp => ({
        id: opp.Id,
        accountName: opp.Account?.Name || 'Unknown',
        opportunityName: opp.Name,
        owner: opp.Owner?.Name || 'Unknown',
        amount: opp[amountField] || 0,
        stage: opp.StageName,
        daysInStage: daysBetween(opp.CreatedDate || now.toISOString(), now),
      }));

    // Format recent wins and losses
    const recentWins = wins.map(opp => ({
      id: opp.Id,
      accountName: opp.Account?.Name || 'Unknown',
      amount: opp[amountField] || 0,
      owner: opp.Owner?.Name || 'Unknown',
      closeDate: opp.CloseDate,
    }));

    const recentLosses = losses.map(opp => ({
      id: opp.Id,
      accountName: opp.Account?.Name || 'Unknown',
      amount: opp[amountField] || 0,
      owner: opp.Owner?.Name || 'Unknown',
      lossReason: opp.Loss_Reason__c || 'Unknown',
    }));

    const quotaTrend = 0;

    return {
      teamMetrics: {
        quotaAttainment: {
          current: totalClosedWon,
          target: teamQuotaTarget,
          percentage: quotaPercentage,
          trend: quotaTrend,
        },
        pipelineCoverage: {
          pipeline: totalPipeline,
          remainingQuota,
          ratio: pipelineCoverageRatio,
          status: pipelineStatus,
        },
        atRiskDeals: {
          count: atRiskDeals.length,
          value: atRiskValue,
        },
        avgDealCycle: {
          days: avgDealCycleDays,
          trend: avgDealCycleTrend,
        },
      },
      repPerformance,
      coachingOpportunities: {
        stuckDeals,
        lowMEDDPICC,
        coldAccounts,
        largeDeals,
      },
      recentWins,
      recentLosses,
    };
  } catch (error) {
    console.error('Error fetching sales leader dashboard:', error);
    return getEmptySalesLeaderDashboard();
  }
}

/**
 * Helper function to return empty dashboard data
 */
function getEmptySalesLeaderDashboard(): SalesLeaderDashboard {
  return {
    teamMetrics: {
      quotaAttainment: {
        current: 0,
        target: 0,
        percentage: 0,
        trend: 0,
      },
      pipelineCoverage: {
        pipeline: 0,
        remainingQuota: 0,
        ratio: 0,
        status: 'Healthy',
      },
      atRiskDeals: {
        count: 0,
        value: 0,
      },
      avgDealCycle: {
        days: 0,
        trend: 0,
      },
    },
    repPerformance: [],
    coachingOpportunities: {
      stuckDeals: [],
      lowMEDDPICC: [],
      coldAccounts: [],
      largeDeals: [],
    },
    recentWins: [],
    recentLosses: [],
  };
}

/**
 * Priority Item Interface
 */
export interface PriorityItem {
  id: string;
  type: 'deal-risk' | 'missing-info' | 'icp-alert' | 'task-due' | 'no-next-step' | 'stage-stuck';
  title: string;
  description: string;
  urgency: 'critical' | 'high' | 'medium';
  relatedAccountId?: string;
  relatedAccountName?: string;
  relatedOpportunityId?: string;
  relatedOpportunityName?: string;
  dueDate?: string;
  actionButton: {
    label: string;
    action: string;
  };
}

/**
 * Pipeline Forecast Interface
 */
export interface PipelineForecast {
  periodName: string;
  totalPipeline: number;
  commitAmount: number;
  bestCaseAmount: number;
  pipelineAmount: number;
  closedWon: number;
  forecastMethod: 'forecastCategory' | 'probability';
  commitLabel: string;   // e.g., "Commit" or ">=70%"
  bestCaseLabel: string; // e.g., "Best Case" or ">=50%"
  quotaTarget: number;
  quotaAttainment: number; // percentage
  quotaSource: 'salesforce' | 'forecastingQuota' | 'manual' | 'none';
  opportunitiesByStage: {
    stageName: string;
    count: number;
    value: number;
  }[];
  distinctOpportunityTypes: string[];
  forecastStatus: {
    isSubmitted: boolean;
    lastSubmittedDate?: string;
    submissionUrl: string;
  };
}

/**
 * Get Today's Priorities for AE
 */
export async function getTodaysPriorities(
  connection: Connection,
  userId: string
): Promise<PriorityItem[]> {
  try {
    const now = new Date();
    const priorities: PriorityItem[] = [];

    // Get user's open opportunities
    const oppQuery = `
      SELECT Id, Name, AccountId, Account.Name, StageName, Amount, CloseDate,
             LastModifiedDate, CreatedDate,
             Command_Why_Do_Anything__c, Command_Why_Now__c, Command_Why_Us__c,
             MEDDPICC_Overall_Score__c, NextStep, IsAtRisk__c
      FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsClosed = false
      ORDER BY CloseDate ASC
      LIMIT 100
    `;

    const oppResult = await connection.query(oppQuery);
    const opportunities = oppResult.records as any[];

    // 1. Deal Risk - Opportunities closing this month missing Command fields
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    opportunities.forEach((opp) => {
      const closeDate = new Date(opp.CloseDate);
      if (closeDate.getMonth() === currentMonth && closeDate.getFullYear() === currentYear) {
        const missingFields: string[] = [];
        if (!opp.Command_Why_Do_Anything__c) missingFields.push('Why Do Anything');
        if (!opp.Command_Why_Now__c) missingFields.push('Why Now');
        if (!opp.Command_Why_Us__c) missingFields.push('Why Us');

        if (missingFields.length > 0) {
          priorities.push({
            id: `missing-cmd-${opp.Id}`,
            type: 'missing-info',
            title: `Complete Command of the Message for ${opp.Name}`,
            description: `Closing ${formatDate(opp.CloseDate)} - Missing: ${missingFields.join(', ')}`,
            urgency: 'critical',
            relatedAccountId: opp.AccountId,
            relatedAccountName: opp.Account?.Name,
            relatedOpportunityId: opp.Id,
            relatedOpportunityName: opp.Name,
            dueDate: opp.CloseDate,
            actionButton: {
              label: 'Update Deal',
              action: `/opportunity/${opp.Id}`,
            },
          });
        }
      }
    });

    // 2. Stage Stuck - Opportunities in stage > 30 days
    opportunities.forEach((opp) => {
      const daysInStage = daysBetween(opp.LastModifiedDate || opp.CreatedDate || now.toISOString(), now);
      if (daysInStage > 30) {
        priorities.push({
          id: `stuck-${opp.Id}`,
          type: 'stage-stuck',
          title: `${opp.Name} stuck in ${opp.StageName}`,
          description: `No progress for ${daysInStage} days - Review and update status`,
          urgency: 'high',
          relatedAccountId: opp.AccountId,
          relatedAccountName: opp.Account?.Name,
          relatedOpportunityId: opp.Id,
          relatedOpportunityName: opp.Name,
          actionButton: {
            label: 'Review Deal',
            action: `/opportunity/${opp.Id}`,
          },
        });
      }
    });

    // 3. Low MEDDPICC Score
    opportunities.forEach((opp) => {
      const score = opp.MEDDPICC_Overall_Score__c || 0;
      if (score < 50 && opp.StageName !== 'Prospecting') {
        priorities.push({
          id: `low-meddpicc-${opp.Id}`,
          type: 'missing-info',
          title: `Improve qualification for ${opp.Name}`,
          description: `MEDDPICC score is ${score}% - Missing key qualification criteria`,
          urgency: 'high',
          relatedAccountId: opp.AccountId,
          relatedAccountName: opp.Account?.Name,
          relatedOpportunityId: opp.Id,
          relatedOpportunityName: opp.Name,
          actionButton: {
            label: 'Qualify Deal',
            action: `/opportunity/${opp.Id}`,
          },
        });
      }
    });

    // 4. No Next Step defined
    opportunities.forEach((opp) => {
      if (!opp.NextStep && opp.StageName !== 'Closed Won' && opp.StageName !== 'Closed Lost') {
        priorities.push({
          id: `no-next-step-${opp.Id}`,
          type: 'no-next-step',
          title: `Define next step for ${opp.Name}`,
          description: `No next step defined - Add clear action item`,
          urgency: 'medium',
          relatedAccountId: opp.AccountId,
          relatedAccountName: opp.Account?.Name,
          relatedOpportunityId: opp.Id,
          relatedOpportunityName: opp.Name,
          actionButton: {
            label: 'Add Next Step',
            action: `/opportunity/${opp.Id}`,
          },
        });
      }
    });

    // 5. At Risk Deals
    opportunities.forEach((opp) => {
      if (opp.IsAtRisk__c) {
        priorities.push({
          id: `at-risk-${opp.Id}`,
          type: 'deal-risk',
          title: `${opp.Name} flagged as At Risk`,
          description: `Review risk factors and create action plan`,
          urgency: 'critical',
          relatedAccountId: opp.AccountId,
          relatedAccountName: opp.Account?.Name,
          relatedOpportunityId: opp.Id,
          relatedOpportunityName: opp.Name,
          actionButton: {
            label: 'Review Risk',
            action: `/opportunity/${opp.Id}`,
          },
        });
      }
    });

    // 6. Get overdue and due today tasks
    const taskQuery = `
      SELECT Id, Subject, ActivityDate, WhatId, What.Name, What.Type
      FROM Task
      WHERE OwnerId = '${userId}'
        AND IsClosed = false
        AND ActivityDate <= ${now.toISOString().split('T')[0]}
      ORDER BY ActivityDate ASC
      LIMIT 20
    `;

    try {
      const taskResult = await connection.query(taskQuery);
      const tasks = taskResult.records as any[];

      tasks.forEach((task) => {
        const dueDate = new Date(task.ActivityDate);
        const isOverdue = dueDate < now;

        priorities.push({
          id: `task-${task.Id}`,
          type: 'task-due',
          title: isOverdue ? `Overdue: ${task.Subject}` : `Due Today: ${task.Subject}`,
          description: `Due ${formatDate(task.ActivityDate)}`,
          urgency: isOverdue ? 'critical' : 'high',
          relatedAccountId: task.What?.Type === 'Account' ? task.WhatId : undefined,
          relatedOpportunityId: task.What?.Type === 'Opportunity' ? task.WhatId : undefined,
          dueDate: task.ActivityDate,
          actionButton: {
            label: 'Complete Task',
            action: task.WhatId ? `/${task.What.Type.toLowerCase()}/${task.WhatId}` : '/dashboard',
          },
        });
      });
    } catch (taskError) {
      console.error('Error fetching tasks:', taskError);
    }

    // Sort by urgency and limit to top 15
    const urgencyOrder = { critical: 0, high: 1, medium: 2 };
    priorities.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return priorities.slice(0, 15);
  } catch (error) {
    console.error('Error fetching priorities:', error);
    return [];
  }
}

/**
 * Get Pipeline and Forecast for AE (current quarter view)
 */
export async function getPipelineForecast(
  connection: Connection,
  userId: string,
  pool: Pool,
  filters: { dateRange?: string; startDate?: string; endDate?: string; excludeStages?: string[]; opportunityTypes?: string[] } = {}
): Promise<PipelineForecast> {
  try {
    const amountField = await getAmountFieldName(pool);
    const forecastCategoryField = await getForecastCategoryFieldName(pool);
    const adminSettings = new AdminSettingsService(pool);
    const forecastConfig = await adminSettings.getForecastConfig();

    // Use this quarter as default if no dateRange specified
    const dateFilter = buildDateFilter(filters.dateRange || 'thisQuarter', filters.startDate, filters.endDate);
    const periodName = getPeriodName(filters.dateRange || 'thisQuarter', filters.startDate, filters.endDate);

    // Build optional filters
    const excludeStagesFilter = filters.excludeStages && filters.excludeStages.length > 0
      ? `AND StageName NOT IN ('${filters.excludeStages.join("','")}')`
      : '';
    const typeFilter = filters.opportunityTypes && filters.opportunityTypes.length > 0
      ? `AND Type IN ('${filters.opportunityTypes.join("','")}')`
      : '';

    // Query open pipeline
    const openQuery = `
      SELECT Id, Name, StageName, ${amountField}, CloseDate, Probability, ${forecastCategoryField}, Type
      FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsClosed = false
        AND ${dateFilter}
        ${excludeStagesFilter}
        ${typeFilter}
      ORDER BY CloseDate ASC
    `;

    // Query closed-won for the period (use IsWon for reliability across orgs)
    const closedWonQuery = `
      SELECT Id, ${amountField}, ${forecastCategoryField}, Type
      FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsWon = true
        AND ${dateFilter}
        ${typeFilter}
    `;

    const [openResult, closedWonResult] = await Promise.all([
      connection.query(openQuery),
      connection.query(closedWonQuery),
    ]);

    const openOpps = openResult.records as any[];
    const closedWonOpps = closedWonResult.records as any[];

    const totalPipeline = openOpps.reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
    const closedWon = closedWonOpps.reduce((sum, opp) => sum + (opp[amountField] || 0), 0);

    // Group by stage
    const stageMap = new Map<string, { count: number; value: number }>();
    openOpps.forEach((opp) => {
      const stage = opp.StageName || 'Unknown';
      if (!stageMap.has(stage)) {
        stageMap.set(stage, { count: 0, value: 0 });
      }
      const stageData = stageMap.get(stage)!;
      stageData.count++;
      stageData.value += opp[amountField] || 0;
    });

    const opportunitiesByStage = Array.from(stageMap.entries()).map(([stageName, data]) => ({
      stageName,
      count: data.count,
      value: data.value,
    }));

    // Group by ForecastCategory or Probability based on config
    let commitAmount: number;
    let bestCaseAmount: number;
    let pipelineAmount: number;
    let commitLabel: string;
    let bestCaseLabel: string;
    const { forecastMethod, commitProbabilityThreshold, bestCaseProbabilityThreshold } = forecastConfig;

    if (forecastMethod === 'forecastCategory') {
      commitAmount = openOpps
        .filter((opp) => opp[forecastCategoryField] === 'Commit')
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      bestCaseAmount = openOpps
        .filter((opp) => opp[forecastCategoryField] === 'Best Case')
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      pipelineAmount = openOpps
        .filter((opp) => opp[forecastCategoryField] === 'Pipeline')
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      commitLabel = 'Commit';
      bestCaseLabel = 'Best Case';
    } else {
      const commitThreshold = commitProbabilityThreshold ?? 70;
      const bestCaseThreshold = bestCaseProbabilityThreshold ?? 50;
      commitAmount = openOpps
        .filter((opp) => (opp.Probability || 0) >= commitThreshold)
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      bestCaseAmount = openOpps
        .filter((opp) => (opp.Probability || 0) >= bestCaseThreshold && (opp.Probability || 0) < commitThreshold)
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      pipelineAmount = openOpps
        .filter((opp) => (opp.Probability || 0) < bestCaseThreshold)
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      commitLabel = `>=${commitThreshold}%`;
      bestCaseLabel = `>=${bestCaseThreshold}%`;
    }

    // Collect distinct Opportunity Types from the data
    const typeSet = new Set<string>();
    openOpps.forEach(opp => { if (opp.Type) typeSet.add(opp.Type); });
    closedWonOpps.forEach(opp => { if (opp.Type) typeSet.add(opp.Type); });
    const distinctOpportunityTypes = Array.from(typeSet).sort();

    // Resolve quota/target
    let quotaTarget = 0;
    const { quotaSource } = forecastConfig;
    if (quotaSource === 'salesforce') {
      try {
        const quotaField = forecastConfig.salesforceQuotaField || 'Quarterly_Quota__c';
        const quotaQuery = `SELECT Id, ${quotaField} FROM User WHERE Id = '${userId}'`;
        const quotaResult = await connection.query(quotaQuery);
        if (quotaResult.records.length > 0) {
          quotaTarget = (quotaResult.records[0] as any)[quotaField] || 0;
        }
      } catch (quotaError) {
        console.log('Could not fetch user quota from Salesforce:', quotaError);
      }
    } else if (quotaSource === 'forecastingQuota') {
      quotaTarget = await fetchForecastingQuota(connection, [userId], filters.dateRange, filters.startDate, filters.endDate);
    } else if (quotaSource === 'manual') {
      const manualQuotas = forecastConfig.manualQuotas || {};
      quotaTarget = manualQuotas[userId] ?? (forecastConfig.defaultQuota || 0);
    }
    const quotaAttainment = quotaTarget > 0 ? (closedWon / quotaTarget) * 100 : 0;

    // Get Salesforce instance URL
    const identity = await connection.identity();
    const instanceUrl = identity.urls?.enterprise?.replace('{version}', '60.0').split('/services')[0] || '';

    return {
      periodName,
      totalPipeline,
      commitAmount,
      bestCaseAmount,
      pipelineAmount,
      closedWon,
      forecastMethod,
      commitLabel,
      bestCaseLabel,
      quotaTarget,
      quotaAttainment,
      quotaSource,
      opportunitiesByStage,
      distinctOpportunityTypes,
      forecastStatus: {
        isSubmitted: false,
        submissionUrl: `${instanceUrl}/lightning/o/Opportunity/list`,
      },
    };
  } catch (error) {
    console.error('Error fetching pipeline forecast:', error);
    return getEmptyPipelineForecast();
  }
}

/**
 * Helper to format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get Team Priorities for Sales Leader
 */
export async function getTeamPriorities(
  connection: Connection,
  managerId: string,
  pool?: Pool
): Promise<PriorityItem[]> {
  try {
    const amountField = pool ? await getAmountFieldName(pool) : 'Amount';
    const now = new Date();
    const priorities: PriorityItem[] = [];

    // Get team members
    const teamQuery = `
      SELECT Id, Name
      FROM User
      WHERE ManagerId = '${managerId}' AND IsActive = true
    `;
    const teamResult = await connection.query(teamQuery);
    const teamMembers = teamResult.records as any[];
    const teamMemberIds = teamMembers.map(u => u.Id);

    if (teamMemberIds.length === 0) {
      return priorities;
    }

    // Get team's open opportunities
    const oppQuery = `
      SELECT Id, Name, AccountId, Account.Name, StageName, ${amountField}, CloseDate,
             LastModifiedDate, CreatedDate, OwnerId, Owner.Name,
             NextStep, Probability
      FROM Opportunity
      WHERE OwnerId IN ('${teamMemberIds.join("','")}')
        AND IsClosed = false
      ORDER BY CloseDate ASC
      LIMIT 200
    `;

    const oppResult = await connection.query(oppQuery);
    const opportunities = oppResult.records as any[];

    // Track priorities by rep for diversity
    const prioritiesByRep = new Map<string, number>();

    // 1. Critical: At Risk Deals (based on low probability and stale activity)
    opportunities.forEach((opp) => {
      const daysSinceUpdate = daysBetween(opp.LastModifiedDate || now.toISOString(), now);
      const probability = opp.Probability || 0;
      const isAtRisk = probability < 50 || daysSinceUpdate > 21; // Low probability or no activity in 3 weeks

      if (isAtRisk && (opp[amountField] || 0) > 25000) { // Only flag at-risk deals over $25K
        const repPriorities = prioritiesByRep.get(opp.OwnerId) || 0;
        if (repPriorities < 2) {
          priorities.push({
            id: `at-risk-${opp.Id}`,
            type: 'deal-risk',
            title: `${opp.Owner.Name}: ${opp.Name} flagged as At Risk`,
            description: `${formatCurrency(opp[amountField] || 0)} - ${probability}% probability, ${daysSinceUpdate} days since update`,
            urgency: 'critical',
            relatedAccountId: opp.AccountId,
            relatedAccountName: opp.Account?.Name,
            relatedOpportunityId: opp.Id,
            relatedOpportunityName: opp.Name,
            actionButton: {
              label: 'Review Deal',
              action: `/opportunity/${opp.Id}`,
            },
          });
          prioritiesByRep.set(opp.OwnerId, repPriorities + 1);
        }
      }
    });

    // 2. High: Large deals closing this month missing critical info
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    opportunities.forEach((opp) => {
      const closeDate = new Date(opp.CloseDate);
      const amount = opp[amountField] || 0;
      if (
        closeDate.getMonth() === currentMonth &&
        closeDate.getFullYear() === currentYear &&
        amount > 50000
      ) {
        const missingFields: string[] = [];
        if (!opp.NextStep || String(opp.NextStep).trim().length === 0) missingFields.push('Next Step');
        if (!opp.Probability || opp.Probability === 0) missingFields.push('Probability');

        if (missingFields.length > 0) {
          priorities.push({
            id: `missing-info-${opp.Id}`,
            type: 'missing-info',
            title: `${opp.Owner.Name}: Complete info for ${opp.Name}`,
            description: `${formatCurrency(amount)} closing ${formatDate(opp.CloseDate)} - Missing: ${missingFields.join(', ')}`,
            urgency: 'high',
            relatedAccountId: opp.AccountId,
            relatedAccountName: opp.Account?.Name,
            relatedOpportunityId: opp.Id,
            relatedOpportunityName: opp.Name,
            actionButton: {
              label: 'Coach Rep',
              action: `/opportunity/${opp.Id}`,
            },
          });
        }
      }
    });

    // 3. High: Deals stuck in stage > 45 days (stricter for team view)
    opportunities.forEach((opp) => {
      const daysInStage = daysBetween(opp.LastModifiedDate || opp.CreatedDate || now.toISOString(), now);
      if (daysInStage > 45 && (opp[amountField] || 0) > 25000) {
        const repPriorities = prioritiesByRep.get(opp.OwnerId) || 0;
        if (repPriorities < 3) {
          priorities.push({
            id: `stuck-${opp.Id}`,
            type: 'stage-stuck',
            title: `${opp.Owner.Name}: ${opp.Name} stuck ${daysInStage} days`,
            description: `${formatCurrency(opp[amountField] || 0)} in ${opp.StageName} - Needs intervention`,
            urgency: 'high',
            relatedAccountId: opp.AccountId,
            relatedAccountName: opp.Account?.Name,
            relatedOpportunityId: opp.Id,
            relatedOpportunityName: opp.Name,
            actionButton: {
              label: 'Review with Rep',
              action: `/opportunity/${opp.Id}`,
            },
          });
          prioritiesByRep.set(opp.OwnerId, repPriorities + 1);
        }
      }
    });

    // 4. Medium: Low qualification on significant deals
    opportunities.forEach((opp) => {
      const probability = opp.Probability || 0;
      const amount = opp[amountField] || 0;
      if (probability < 50 && amount > 50000 && opp.StageName !== 'Prospecting') {
        priorities.push({
          id: `low-qualification-${opp.Id}`,
          type: 'missing-info',
          title: `${opp.Owner.Name}: Low qualification on ${opp.Name}`,
          description: `${formatCurrency(amount)} - ${probability}% probability - Coach on qualification`,
          urgency: 'medium',
          relatedAccountId: opp.AccountId,
          relatedAccountName: opp.Account?.Name,
          relatedOpportunityId: opp.Id,
          relatedOpportunityName: opp.Name,
          actionButton: {
            label: 'Review Deal',
            action: `/opportunity/${opp.Id}`,
          },
        });
      }
    });

    // Sort by urgency and limit to top 15
    const urgencyOrder = { critical: 0, high: 1, medium: 2 };
    priorities.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return priorities.slice(0, 15);
  } catch (error) {
    console.error('Error fetching team priorities:', error);
    return [];
  }
}

/**
 * Helper to format currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Get Team Pipeline Forecast for Sales Leader
 */
export async function getTeamPipelineForecast(
  connection: Connection,
  managerId: string,
  pool: Pool,
  filters: DashboardFilters & { excludeStages?: string[]; opportunityTypes?: string[] } = {}
): Promise<PipelineForecast> {
  try {
    const amountField = await getAmountFieldName(pool);
    const forecastCategoryField = await getForecastCategoryFieldName(pool);
    const adminSettings = new AdminSettingsService(pool);
    const forecastConfig = await adminSettings.getForecastConfig();
    const teamFilter = filters.teamFilter || 'myTeam';

    // Determine which users to query
    let teamMemberIds: string[] = [];

    if (teamFilter === 'allUsers') {
      const allUsersQuery = `SELECT Id FROM User WHERE IsActive = true LIMIT 200`;
      const allUsersResult = await connection.query(allUsersQuery);
      teamMemberIds = (allUsersResult.records as any[]).map(u => u.Id);
    } else if (teamFilter === 'me') {
      // Just the current user's own data
      teamMemberIds = [managerId];
    } else if (teamFilter === 'myTeam') {
      // Get manager's direct reports
      const teamQuery = `SELECT Id FROM User WHERE ManagerId = '${managerId}' AND IsActive = true`;
      const teamResult = await connection.query(teamQuery);
      teamMemberIds = (teamResult.records as any[]).map(u => u.Id);

      // Include the manager themselves
      if (!teamMemberIds.includes(managerId)) {
        teamMemberIds.push(managerId);
      }

      // No fallback to all users - just show manager's own data if no reports
      if (teamMemberIds.length <= 1) {
        console.log('No direct reports found for pipeline forecast - showing manager data only');
      }
    } else {
      // Specific user ID - that user + their reports
      const reportsQuery = `SELECT Id FROM User WHERE (Id = '${teamFilter}' OR ManagerId = '${teamFilter}') AND IsActive = true`;
      const reportsResult = await connection.query(reportsQuery);
      teamMemberIds = (reportsResult.records as any[]).map(u => u.Id);
    }

    if (teamMemberIds.length === 0) {
      return getEmptyPipelineForecast();
    }

    // Build date filter
    const dateFilter = buildDateFilter(filters.dateRange, filters.startDate, filters.endDate);
    const ownerFilter = `OwnerId IN ('${teamMemberIds.join("','")}')`;
    const minDealFilter = filters.minDealSize ? `AND ${amountField} >= ${filters.minDealSize}` : '';

    // Build stage exclusion filter
    const excludeStagesFilter = filters.excludeStages && filters.excludeStages.length > 0
      ? `AND StageName NOT IN ('${filters.excludeStages.join("','")}')`
      : '';

    // Build opportunity type filter
    const typeFilter = filters.opportunityTypes && filters.opportunityTypes.length > 0
      ? `AND Type IN ('${filters.opportunityTypes.join("','")}')`
      : '';

    // Build period name from filter
    const periodName = getPeriodName(filters.dateRange, filters.startDate, filters.endDate);

    // Query open pipeline opportunities for the period
    const openPipelineQuery = `
      SELECT Id, Name, StageName, ${amountField}, CloseDate, Probability, ${forecastCategoryField}, Type, OwnerId, Owner.Name
      FROM Opportunity
      WHERE ${ownerFilter}
        AND IsClosed = false
        AND ${dateFilter}
        ${minDealFilter}
        ${excludeStagesFilter}
        ${typeFilter}
      ORDER BY CloseDate ASC
    `;

    // Query closed-won opportunities for the period (use IsWon for reliability across orgs)
    const closedWonQuery = `
      SELECT Id, ${amountField}, ${forecastCategoryField}, Type
      FROM Opportunity
      WHERE ${ownerFilter}
        AND IsWon = true
        AND ${dateFilter}
        ${minDealFilter}
        ${typeFilter}
    `;

    const [openResult, closedWonResult] = await Promise.all([
      connection.query(openPipelineQuery),
      connection.query(closedWonQuery),
    ]);

    const openOpps = openResult.records as any[];
    const closedWonOpps = closedWonResult.records as any[];

    // Calculate open pipeline metrics
    const totalPipeline = openOpps.reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
    const closedWon = closedWonOpps.reduce((sum, opp) => sum + (opp[amountField] || 0), 0);

    // Group by stage
    const stageMap = new Map<string, { count: number; value: number }>();
    openOpps.forEach((opp) => {
      const stage = opp.StageName || 'Unknown';
      if (!stageMap.has(stage)) {
        stageMap.set(stage, { count: 0, value: 0 });
      }
      const stageData = stageMap.get(stage)!;
      stageData.count++;
      stageData.value += opp[amountField] || 0;
    });

    const opportunitiesByStage = Array.from(stageMap.entries()).map(([stageName, data]) => ({
      stageName,
      count: data.count,
      value: data.value,
    }));

    // Group by ForecastCategory or Probability based on config
    let commitAmount: number;
    let bestCaseAmount: number;
    let pipelineAmount: number;
    let commitLabel: string;
    let bestCaseLabel: string;
    const { forecastMethod, commitProbabilityThreshold, bestCaseProbabilityThreshold } = forecastConfig;

    if (forecastMethod === 'forecastCategory') {
      commitAmount = openOpps
        .filter((opp) => opp[forecastCategoryField] === 'Commit')
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      bestCaseAmount = openOpps
        .filter((opp) => opp[forecastCategoryField] === 'Best Case')
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      pipelineAmount = openOpps
        .filter((opp) => opp[forecastCategoryField] === 'Pipeline')
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      commitLabel = 'Commit';
      bestCaseLabel = 'Best Case';
    } else {
      // Probability-based grouping
      const commitThreshold = commitProbabilityThreshold ?? 70;
      const bestCaseThreshold = bestCaseProbabilityThreshold ?? 50;
      commitAmount = openOpps
        .filter((opp) => (opp.Probability || 0) >= commitThreshold)
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      bestCaseAmount = openOpps
        .filter((opp) => (opp.Probability || 0) >= bestCaseThreshold && (opp.Probability || 0) < commitThreshold)
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      pipelineAmount = openOpps
        .filter((opp) => (opp.Probability || 0) < bestCaseThreshold)
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);
      commitLabel = `>=${commitThreshold}%`;
      bestCaseLabel = `>=${bestCaseThreshold}%`;
    }

    // Collect distinct Opportunity Types from the data
    const typeSet = new Set<string>();
    openOpps.forEach(opp => { if (opp.Type) typeSet.add(opp.Type); });
    closedWonOpps.forEach(opp => { if (opp.Type) typeSet.add(opp.Type); });
    const distinctOpportunityTypes = Array.from(typeSet).sort();

    // Resolve quota/target
    let quotaTarget = 0;
    const { quotaSource } = forecastConfig;
    if (quotaSource === 'salesforce') {
      try {
        const quotaField = forecastConfig.salesforceQuotaField || 'Quarterly_Quota__c';
        // Sum quotas for all team members
        const quotaQuery = `SELECT Id, ${quotaField} FROM User WHERE Id IN ('${teamMemberIds.join("','")}')`;
        const quotaResult = await connection.query(quotaQuery);
        quotaTarget = (quotaResult.records as any[]).reduce((sum, user) => sum + (user[quotaField] || 0), 0);
      } catch (quotaError) {
        console.log('Could not fetch team quota from Salesforce:', quotaError);
      }
    } else if (quotaSource === 'forecastingQuota') {
      quotaTarget = await fetchForecastingQuota(connection, teamMemberIds, filters.dateRange, filters.startDate, filters.endDate);
    } else if (quotaSource === 'manual') {
      const manualQuotas = forecastConfig.manualQuotas || {};
      const defaultQuota = forecastConfig.defaultQuota || 0;
      quotaTarget = teamMemberIds.reduce((sum, uid) => sum + (manualQuotas[uid] ?? defaultQuota), 0);
    }
    const quotaAttainment = quotaTarget > 0 ? (closedWon / quotaTarget) * 100 : 0;

    // Get Salesforce instance URL
    const identity = await connection.identity();
    const instanceUrl = identity.urls?.enterprise?.replace('{version}', '60.0').split('/services')[0] || '';

    return {
      periodName,
      totalPipeline,
      commitAmount,
      bestCaseAmount,
      pipelineAmount,
      closedWon,
      forecastMethod,
      commitLabel,
      bestCaseLabel,
      quotaTarget,
      quotaAttainment,
      quotaSource,
      opportunitiesByStage,
      distinctOpportunityTypes,
      forecastStatus: {
        isSubmitted: false,
        submissionUrl: `${instanceUrl}/lightning/o/Opportunity/list`,
      },
    };
  } catch (error) {
    console.error('Error fetching team pipeline forecast:', error);
    return getEmptyPipelineForecast();
  }
}

function getEmptyPipelineForecast(): PipelineForecast {
  return {
    periodName: '',
    totalPipeline: 0,
    commitAmount: 0,
    bestCaseAmount: 0,
    pipelineAmount: 0,
    closedWon: 0,
    forecastMethod: 'probability',
    commitLabel: '>=70%',
    bestCaseLabel: '>=50%',
    quotaTarget: 0,
    quotaAttainment: 0,
    quotaSource: 'none',
    opportunitiesByStage: [],
    distinctOpportunityTypes: [],
    forecastStatus: {
      isSubmitted: false,
      submissionUrl: '',
    },
  };
}

function getPeriodName(dateRange?: string, startDate?: string, endDate?: string): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

  switch (dateRange) {
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case 'thisWeek': return 'This Week';
    case 'lastWeek': return 'Last Week';
    case 'thisMonth': return 'This Month';
    case 'lastMonth': return 'Last Month';
    case 'thisQuarter': return `Q${currentQuarter} ${currentYear}`;
    case 'lastQuarter': {
      const lq = currentQuarter === 1 ? 4 : currentQuarter - 1;
      const ly = currentQuarter === 1 ? currentYear - 1 : currentYear;
      return `Q${lq} ${ly}`;
    }
    case 'nextQuarter': {
      const nq = currentQuarter === 4 ? 1 : currentQuarter + 1;
      const ny = currentQuarter === 4 ? currentYear + 1 : currentYear;
      return `Q${nq} ${ny}`;
    }
    case 'thisFiscalQuarter': return 'This Fiscal Quarter';
    case 'lastFiscalQuarter': return 'Last Fiscal Quarter';
    case 'thisFiscalYear': return 'This Fiscal Year';
    case 'lastFiscalYear': return 'Last Fiscal Year';
    case 'thisYear': return `${currentYear}`;
    case 'lastYear': return `${currentYear - 1}`;
    case 'nextYear': return `${currentYear + 1}`;
    case 'last7Days': return 'Last 7 Days';
    case 'last30Days': return 'Last 30 Days';
    case 'last90Days': return 'Last 90 Days';
    case 'last120Days': return 'Last 120 Days';
    case 'all': return 'All Time';
    case 'custom':
      if (startDate && endDate) return `${startDate} to ${endDate}`;
      if (startDate) return `From ${startDate}`;
      if (endDate) return `Through ${endDate}`;
      return `${currentYear}`;
    default: return `${currentYear}`;
  }
}


/**
 * Get the start and end dates for a given date range (used for ForecastingQuota queries).
 * Returns ISO date strings (YYYY-MM-DD).
 */
function getPeriodDates(dateRange?: string, startDate?: string, endDate?: string): { start: string; end: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentQuarter = Math.floor(currentMonth / 3) + 1;

  const FISCAL_YEAR_START_MONTH = 1; // February (0-indexed)
  const fiscalYear = currentMonth >= FISCAL_YEAR_START_MONTH ? currentYear : currentYear - 1;
  const fiscalMonth = currentMonth >= FISCAL_YEAR_START_MONTH
    ? currentMonth - FISCAL_YEAR_START_MONTH
    : currentMonth + (12 - FISCAL_YEAR_START_MONTH);
  const fiscalQuarter = Math.floor(fiscalMonth / 3) + 1;

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (dateRange) {
    case 'thisQuarter': {
      const qStart = new Date(currentYear, (currentQuarter - 1) * 3, 1);
      const qEnd = new Date(currentYear, currentQuarter * 3, 0);
      return { start: fmt(qStart), end: fmt(qEnd) };
    }
    case 'lastQuarter': {
      const lq = currentQuarter === 1 ? 4 : currentQuarter - 1;
      const ly = currentQuarter === 1 ? currentYear - 1 : currentYear;
      const qStart = new Date(ly, (lq - 1) * 3, 1);
      const qEnd = new Date(ly, lq * 3, 0);
      return { start: fmt(qStart), end: fmt(qEnd) };
    }
    case 'nextQuarter': {
      const nq = currentQuarter === 4 ? 1 : currentQuarter + 1;
      const ny = currentQuarter === 4 ? currentYear + 1 : currentYear;
      const qStart = new Date(ny, (nq - 1) * 3, 1);
      const qEnd = new Date(ny, nq * 3, 0);
      return { start: fmt(qStart), end: fmt(qEnd) };
    }
    case 'thisFiscalQuarter': {
      const fqStartMonth = FISCAL_YEAR_START_MONTH + ((fiscalQuarter - 1) * 3);
      const fqStartYear = fqStartMonth > 11 ? fiscalYear + 1 : fiscalYear;
      const actualStartMonth = fqStartMonth % 12;
      const fqEndMonth = actualStartMonth + 2;
      const fqEndYear = fqEndMonth > 11 ? fqStartYear + 1 : fqStartYear;
      const qStart = new Date(fqStartYear, actualStartMonth, 1);
      const qEnd = new Date(fqEndYear, (fqEndMonth % 12) + 1, 0);
      return { start: fmt(qStart), end: fmt(qEnd) };
    }
    case 'thisYear': {
      return { start: `${currentYear}-01-01`, end: `${currentYear}-12-31` };
    }
    case 'lastYear': {
      return { start: `${currentYear - 1}-01-01`, end: `${currentYear - 1}-12-31` };
    }
    case 'thisFiscalYear': {
      const fyStart = new Date(fiscalYear, FISCAL_YEAR_START_MONTH, 1);
      const fyEnd = new Date(fiscalYear + 1, FISCAL_YEAR_START_MONTH, 0);
      return { start: fmt(fyStart), end: fmt(fyEnd) };
    }
    case 'custom': {
      if (startDate && endDate) return { start: startDate, end: endDate };
      if (startDate) return { start: startDate, end: fmt(now) };
      if (endDate) return { start: `${currentYear}-01-01`, end: endDate };
      const cqStart = new Date(currentYear, (currentQuarter - 1) * 3, 1);
      const cqEnd = new Date(currentYear, currentQuarter * 3, 0);
      return { start: fmt(cqStart), end: fmt(cqEnd) };
    }
    default: {
      // Default to current quarter
      const qStart = new Date(currentYear, (currentQuarter - 1) * 3, 1);
      const qEnd = new Date(currentYear, currentQuarter * 3, 0);
      return { start: fmt(qStart), end: fmt(qEnd) };
    }
  }
}

/**
 * Fetch quota from Salesforce ForecastingQuota object for one or more users.
 * Sums QuotaAmount for all matching records in the given period.
 */
async function fetchForecastingQuota(
  connection: Connection,
  userIds: string[],
  dateRange?: string,
  startDate?: string,
  endDate?: string,
): Promise<number> {
  try {
    const period = getPeriodDates(dateRange, startDate, endDate);
    const userFilter = userIds.length === 1
      ? `QuotaOwnerId = '${userIds[0]}'`
      : `QuotaOwnerId IN ('${userIds.join("','")}')`;

    const query = `
      SELECT QuotaOwnerId, QuotaAmount, StartDate
      FROM ForecastingQuota
      WHERE ${userFilter}
        AND StartDate >= ${period.start}
        AND StartDate <= ${period.end}
        AND IsQuantity = false
      ORDER BY StartDate
    `;

    const result = await connection.query(query);
    return (result.records as any[]).reduce((sum, rec) => sum + (rec.QuotaAmount || 0), 0);
  } catch (err) {
    console.log('Could not fetch ForecastingQuota from Salesforce:', err);
    return 0;
  }
}

// Activity Timeline for Deal Workspace
export interface TimelineActivity {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'task' | 'note' | 'stage_change';
  date: string;
  subject: string;
  description: string;
  participants?: string[];
  relatedTo?: string;
  status?: string;
}

export async function getOpportunityTimeline(
  connection: Connection,
  opportunityId: string
): Promise<TimelineActivity[]> {
  try {
    const activities: TimelineActivity[] = [];

    // Query Tasks related to this opportunity
    const taskQuery = `
      SELECT Id, Subject, Description, ActivityDate, Status, CreatedDate,
             Type, Priority, Who.Name, What.Name
      FROM Task
      WHERE WhatId = '${opportunityId}'
      ORDER BY CreatedDate DESC
      LIMIT 50
    `;

    const taskResult = await connection.query(taskQuery);
    const tasks = taskResult.records as any[];

    for (const task of tasks) {
      let activityType: TimelineActivity['type'] = 'task';

      // Determine type based on Task Type field
      if (task.Type) {
        const taskType = task.Type.toLowerCase();
        if (taskType.includes('email')) activityType = 'email';
        else if (taskType.includes('call')) activityType = 'call';
      }

      activities.push({
        id: task.Id,
        type: activityType,
        date: task.ActivityDate || task.CreatedDate,
        subject: task.Subject || 'Untitled Task',
        description: task.Description || '',
        participants: task.Who?.Name ? [task.Who.Name] : [],
        status: task.Status,
      });
    }

    // Query Events (meetings) related to this opportunity
    const eventQuery = `
      SELECT Id, Subject, Description, StartDateTime, EndDateTime,
             Type, Who.Name, What.Name
      FROM Event
      WHERE WhatId = '${opportunityId}'
      ORDER BY StartDateTime DESC
      LIMIT 50
    `;

    const eventResult = await connection.query(eventQuery);
    const events = eventResult.records as any[];

    for (const event of events) {
      activities.push({
        id: event.Id,
        type: 'meeting',
        date: event.StartDateTime,
        subject: event.Subject || 'Meeting',
        description: event.Description || '',
        participants: event.Who?.Name ? [event.Who.Name] : [],
      });
    }

    // Query Opportunity Field History for stage changes
    const historyQuery = `
      SELECT Id, Field, OldValue, NewValue, CreatedDate, CreatedBy.Name
      FROM OpportunityFieldHistory
      WHERE OpportunityId = '${opportunityId}'
        AND Field = 'StageName'
      ORDER BY CreatedDate DESC
      LIMIT 20
    `;

    try {
      const historyResult = await connection.query(historyQuery);
      const historyRecords = historyResult.records as any[];

      for (const record of historyRecords) {
        const createdByName = record.CreatedBy ? record.CreatedBy.Name : 'System';
        activities.push({
          id: record.Id,
          type: 'stage_change',
          date: record.CreatedDate,
          subject: `Stage changed from ${record.OldValue} to ${record.NewValue}`,
          description: `Updated by ${createdByName}`,
        });
      }
    } catch (error) {
      // OpportunityFieldHistory may not be accessible in all orgs
      console.warn('Could not query OpportunityFieldHistory:', error);
    }

    // Sort all activities by date (most recent first)
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return activities;
  } catch (error) {
    console.error('Error fetching opportunity timeline:', error);
    return [];
  }
}

/**
 * License Utilization Account (for CSM/AM hub)
 */
export interface LicenseUtilizationAccount {
  id: string;
  name: string;
  contractedSeats: number;
  activeUsers: number;
  utilizationPercent: number;
  utilizationByProduct: {
    learn?: { seats: number; activeUsers: number; utilization: number };
    comms?: { seats: number; activeUsers: number; utilization: number };
    tasks?: { seats: number; activeUsers: number; utilization: number };
    max?: { seats: number; activeUsers: number; utilization: number };
  };
  usageTrend?: string;
  nextSteps?: string;
  healthScore?: number;
  arr?: number;
  renewalDate?: string;
  daysToRenewal?: number;
  riskLevel: 'critical' | 'warning' | 'healthy' | 'over-utilized';
}

/**
 * Get accounts with underutilization risk
 * Returns accounts where license utilization is below threshold (default 60%)
 */
export async function getUnderutilizedAccounts(
  connection: Connection,
  userId: string,
  threshold: number = 60
): Promise<LicenseUtilizationAccount[]> {
  try {
    // Query accounts with license utilization data - broadened filters
    const query = `
      SELECT Id, Name,
             Contract_Total_License_Seats__c, Total_Hierarchy_Seats__c, Logo_Seats__c,
             Total_Active_Users__c, Active_Users_Max__c, Active_Users_Learn__c,
             Active_Users_Comms__c, Active_Users_Tasks__c,
             License_Utilization_Max__c, License_Utilization_Learn__c,
             License_Utilization_Comms__c, License_Utilization_Tasks__c,
             Max_Usage_Trend__c, Usage_Metrics_Next_Steps__c,
             Current_Gainsight_Score__c, Total_ARR__c, Agreement_Expiry_Date__c,
             Customer_Stage__c, Risk__c
      FROM Account
      WHERE (OwnerId = '${userId}' OR Customer_Success_Manager__c = '${userId}')
        AND (Contract_Total_License_Seats__c > 0 OR Total_Hierarchy_Seats__c > 0 OR Logo_Seats__c > 0)
      ORDER BY License_Utilization_Max__c ASC NULLS LAST
      LIMIT 50
    `;

    const fallbackQuery = `
      SELECT Id, Name, Total_ARR__c, Agreement_Expiry_Date__c,
             Current_Gainsight_Score__c, Customer_Stage__c
      FROM Account
      WHERE OwnerId = '${userId}'
      ORDER BY Name
      LIMIT 50
    `;

    let accounts: any[] = [];
    try {
      const result = await connection.query(query);
      accounts = result.records as any[];
    } catch (error: any) {
      if (error.errorCode === 'INVALID_FIELD' || error.message?.includes('No such column')) {
        console.warn('License utilization fields not found, using fallback query');
        const fallbackResult = await connection.query(fallbackQuery);
        accounts = fallbackResult.records as any[];
      } else {
        throw error;
      }
    }

    // Transform and filter for underutilized accounts
    const utilizedAccounts: LicenseUtilizationAccount[] = accounts
      .filter(acc => {
        const utilization = acc.License_Utilization_Max__c || 0;
        return utilization < threshold && utilization >= 0;
      })
      .map(acc => {
        const contractedSeats = acc.Contract_Total_License_Seats__c || acc.Total_Hierarchy_Seats__c || 0;
        const activeUsers = acc.Total_Active_Users__c || acc.Active_Users_Max__c || 0;
        const utilizationPercent = acc.License_Utilization_Max__c ||
          (contractedSeats > 0 ? (activeUsers / contractedSeats) * 100 : 0);

        // Calculate days to renewal
        let daysToRenewal: number | undefined;
        if (acc.Agreement_Expiry_Date__c) {
          const renewalDate = new Date(acc.Agreement_Expiry_Date__c);
          const today = new Date();
          daysToRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Determine risk level
        let riskLevel: 'critical' | 'warning' | 'healthy' | 'over-utilized' = 'healthy';
        if (utilizationPercent < 30) {
          riskLevel = 'critical';
        } else if (utilizationPercent < 50) {
          riskLevel = 'warning';
        } else if (utilizationPercent > 100) {
          riskLevel = 'over-utilized';
        }

        return {
          id: acc.Id,
          name: acc.Name,
          contractedSeats,
          activeUsers,
          utilizationPercent: Math.round(utilizationPercent),
          utilizationByProduct: {
            learn: acc.Active_Users_Learn__c ? {
              seats: contractedSeats,
              activeUsers: acc.Active_Users_Learn__c,
              utilization: acc.License_Utilization_Learn__c || 0,
            } : undefined,
            comms: acc.Active_Users_Comms__c ? {
              seats: contractedSeats,
              activeUsers: acc.Active_Users_Comms__c,
              utilization: acc.License_Utilization_Comms__c || 0,
            } : undefined,
            tasks: acc.Active_Users_Tasks__c ? {
              seats: contractedSeats,
              activeUsers: acc.Active_Users_Tasks__c,
              utilization: acc.License_Utilization_Tasks__c || 0,
            } : undefined,
            max: acc.Active_Users_Max__c ? {
              seats: contractedSeats,
              activeUsers: acc.Active_Users_Max__c,
              utilization: acc.License_Utilization_Max__c || 0,
            } : undefined,
          },
          usageTrend: acc.Max_Usage_Trend__c,
          nextSteps: acc.Usage_Metrics_Next_Steps__c,
          healthScore: acc.Current_Gainsight_Score__c,
          arr: acc.Total_ARR__c,
          renewalDate: acc.Agreement_Expiry_Date__c,
          daysToRenewal,
          riskLevel,
        };
      })
      .sort((a, b) => a.utilizationPercent - b.utilizationPercent); // Sort by lowest utilization first

    return utilizedAccounts;
  } catch (error) {
    console.error('Error fetching underutilized accounts:', error);
    return [];
  }
}

/**
 * Get accounts with expansion opportunity (over-utilized licenses)
 * Returns accounts where license utilization is above threshold (default 80%)
 */
export async function getExpansionOpportunityAccounts(
  connection: Connection,
  userId: string,
  threshold: number = 80
): Promise<LicenseUtilizationAccount[]> {
  try {
    // Query accounts with license utilization data
    const query = `
      SELECT Id, Name,
             Contract_Total_License_Seats__c, Total_Hierarchy_Seats__c, Logo_Seats__c,
             Total_Active_Users__c, Active_Users_Max__c, Active_Users_Learn__c,
             Active_Users_Comms__c, Active_Users_Tasks__c,
             License_Utilization_Max__c, License_Utilization_Learn__c,
             License_Utilization_Comms__c, License_Utilization_Tasks__c,
             Max_Usage_Trend__c, Usage_Metrics_Next_Steps__c,
             Current_Gainsight_Score__c, Total_ARR__c, Agreement_Expiry_Date__c,
             Customer_Stage__c, Risk__c
      FROM Account
      WHERE (OwnerId = '${userId}' OR Customer_Success_Manager__c = '${userId}')
        AND (Contract_Total_License_Seats__c > 0 OR Total_Hierarchy_Seats__c > 0 OR Logo_Seats__c > 0)
      ORDER BY License_Utilization_Max__c DESC NULLS LAST
      LIMIT 50
    `;

    const fallbackQuery = `
      SELECT Id, Name, Total_ARR__c, Agreement_Expiry_Date__c,
             Current_Gainsight_Score__c, Customer_Stage__c
      FROM Account
      WHERE OwnerId = '${userId}'
      ORDER BY Name
      LIMIT 50
    `;

    let accounts: any[] = [];
    try {
      const result = await connection.query(query);
      accounts = result.records as any[];
    } catch (error: any) {
      if (error.errorCode === 'INVALID_FIELD' || error.message?.includes('No such column')) {
        console.warn('License utilization fields not found, using fallback query');
        const fallbackResult = await connection.query(fallbackQuery);
        accounts = fallbackResult.records as any[];
      } else {
        throw error;
      }
    }

    // Transform and filter for over-utilized accounts (expansion opportunities)
    const expansionAccounts: LicenseUtilizationAccount[] = accounts
      .filter(acc => {
        const utilization = acc.License_Utilization_Max__c || 0;
        return utilization >= threshold;
      })
      .map(acc => {
        const contractedSeats = acc.Contract_Total_License_Seats__c || acc.Total_Hierarchy_Seats__c || 0;
        const activeUsers = acc.Total_Active_Users__c || acc.Active_Users_Max__c || 0;
        const utilizationPercent = acc.License_Utilization_Max__c ||
          (contractedSeats > 0 ? (activeUsers / contractedSeats) * 100 : 0);

        // Calculate days to renewal
        let daysToRenewal: number | undefined;
        if (acc.Agreement_Expiry_Date__c) {
          const renewalDate = new Date(acc.Agreement_Expiry_Date__c);
          const today = new Date();
          daysToRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Determine risk level (for expansion, over-utilized is actually good!)
        let riskLevel: 'critical' | 'warning' | 'healthy' | 'over-utilized' = 'over-utilized';
        if (utilizationPercent >= 100) {
          riskLevel = 'over-utilized'; // Prime for expansion
        } else if (utilizationPercent >= 90) {
          riskLevel = 'warning'; // Getting close
        } else {
          riskLevel = 'healthy'; // Good utilization
        }

        return {
          id: acc.Id,
          name: acc.Name,
          contractedSeats,
          activeUsers,
          utilizationPercent: Math.round(utilizationPercent),
          utilizationByProduct: {
            learn: acc.Active_Users_Learn__c ? {
              seats: contractedSeats,
              activeUsers: acc.Active_Users_Learn__c,
              utilization: acc.License_Utilization_Learn__c || 0,
            } : undefined,
            comms: acc.Active_Users_Comms__c ? {
              seats: contractedSeats,
              activeUsers: acc.Active_Users_Comms__c,
              utilization: acc.License_Utilization_Comms__c || 0,
            } : undefined,
            tasks: acc.Active_Users_Tasks__c ? {
              seats: contractedSeats,
              activeUsers: acc.Active_Users_Tasks__c,
              utilization: acc.License_Utilization_Tasks__c || 0,
            } : undefined,
            max: acc.Active_Users_Max__c ? {
              seats: contractedSeats,
              activeUsers: acc.Active_Users_Max__c,
              utilization: acc.License_Utilization_Max__c || 0,
            } : undefined,
          },
          usageTrend: acc.Max_Usage_Trend__c,
          nextSteps: acc.Usage_Metrics_Next_Steps__c,
          healthScore: acc.Current_Gainsight_Score__c,
          arr: acc.Total_ARR__c,
          renewalDate: acc.Agreement_Expiry_Date__c,
          daysToRenewal,
          riskLevel,
        };
      })
      .sort((a, b) => b.utilizationPercent - a.utilizationPercent); // Sort by highest utilization first

    return expansionAccounts;
  } catch (error) {
    console.error('Error fetching expansion opportunity accounts:', error);
    return [];
  }
}
