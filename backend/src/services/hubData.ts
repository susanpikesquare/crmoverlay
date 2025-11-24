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
  nrrTarget: number; // Percentage
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
 * Calculate MEDDPICC score from individual components
 * Falls back to standard fields if custom fields don't exist
 */
function calculateMEDDPICCScore(opp: Opportunity): number {
  // If actual score field exists, use it
  if (opp.MEDDPICC_Overall_Score__c) {
    return opp.MEDDPICC_Overall_Score__c;
  }

  // Check if custom MEDDPICC fields exist
  const hasCustomFields =
    'COM_Metrics__c' in opp ||
    'MEDDPICCR_Economic_Buyer__c' in opp ||
    'MEDDPICCR_Decision_Criteria__c' in opp;

  if (hasCustomFields) {
    // Otherwise calculate based on filled custom fields
    const fields = [
      opp.COM_Metrics__c,
      opp.MEDDPICCR_Economic_Buyer__c,
      opp.MEDDPICCR_Decision_Criteria__c,
      opp.MEDDPICCR_Decision_Process__c,
      opp.MEDDPICCR_Paper_Process__c,
      opp.MEDDPICCR_Implicate_Pain__c,
      opp.MEDDPICCR_Champion__c,
      opp.MEDDPICCR_Competition__c,
    ];

    const filledCount = fields.filter(f => f && String(f).trim().length > 0).length;
    return Math.round((filledCount / fields.length) * 100);
  }

  // Fallback: Calculate qualification score from standard fields
  let score = 50; // base score
  if (opp.NextStep && String(opp.NextStep).trim().length > 0) score += 20;
  if (opp.Description && String(opp.Description).trim().length > 50) score += 15;
  if (opp.Probability && opp.Probability > 50) score += 15;

  return score;
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
  // Query accounts that have opportunities owned by the AE
  // This approach works because AEs typically own opportunities, not accounts
  // Return all accounts with open opportunities, prioritizing those with 6sense data
  const query = `
    SELECT Id, Name, Industry, OwnerId, NumberOfEmployees,
           Type, Rating, AnnualRevenue,
           accountIntentScore6sense__c, accountBuyingStage6sense__c,
           CreatedDate, LastModifiedDate,
           (SELECT Id FROM Opportunities WHERE OwnerId = '${userId}' AND IsClosed = false LIMIT 1)
    FROM Account
    WHERE Id IN (
      SELECT AccountId FROM Opportunity WHERE OwnerId = '${userId}' AND IsClosed = false
    )
    ORDER BY accountIntentScore6sense__c DESC NULLS LAST, Rating DESC, LastModifiedDate DESC
    LIMIT 50
  `;

  try {
    const result = await connection.query<Account>(query);
    const accounts = result.records || [];

    // First, transform accounts with data from 6sense or calculated from standard fields
    const transformedAccounts = accounts.map(account => {
      const employeeCount = account.NumberOfEmployees || 0;
      const revenue = account.AnnualRevenue || 0;
      const rating = account.Rating || '';

      // Use 6sense Intent Score if available, otherwise calculate from standard fields
      let intentScore: number;
      if ((account as any).accountIntentScore6sense__c) {
        intentScore = (account as any).accountIntentScore6sense__c;
      } else {
        // Fallback: calculate score from standard fields
        let score = 50; // base score
        if (employeeCount > 1000) score += 20;
        else if (employeeCount > 500) score += 15;
        else if (employeeCount > 100) score += 10;

        if (revenue > 10000000) score += 15;
        else if (revenue > 1000000) score += 10;
        else if (revenue > 100000) score += 5;

        if (rating === 'Hot') score += 15;
        else if (rating === 'Warm') score += 10;

        intentScore = Math.min(100, score);
      }

      // Determine priority tier based on intent score
      let priorityTier: '🔥 Hot' | '🔶 Warm' | '🔵 Cool';
      if (intentScore >= 85) {
        priorityTier = '🔥 Hot';
      } else if (intentScore >= 70) {
        priorityTier = '🔶 Warm';
      } else {
        priorityTier = '🔵 Cool';
      }

      // Use 6sense Buying Stage if available, otherwise use Rating or Type
      const buyingStage = (account as any).accountBuyingStage6sense__c || rating || account.Type || 'Active';

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
    return priorityAccounts.sort((a, b) => (b.intentScore || 0) - (a.intentScore || 0));
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
  userId: string
): Promise<AMMetrics> {
  const renewalsAtRiskQuery = `
    SELECT COUNT() total
    FROM Account
    WHERE OwnerId = '${userId}'
      AND Customer_Stage__c = 'Renewal'
      AND (Risk__c = 'Red' OR Current_Gainsight_Score__c < 50)
  `;

  const expansionPipelineQuery = `
    SELECT SUM(ARR__c) total
    FROM Opportunity
    WHERE OwnerId = '${userId}'
      AND IsClosed = false
      AND Type = 'Upsell'
  `;

  const avgContractQuery = `
    SELECT AVG(Total_ARR__c) avg
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

    const atRiskCount = (renewalsAtRisk.records[0] as any)?.total || 0;
    const expansionTotal = (expansionPipeline.records[0] as any)?.total || 0;
    const avgValue = (avgContract.records[0] as any)?.avg || 0;

    return {
      nrrTarget: 110, // Mock value - should come from user goal
      renewalsAtRiskCount: atRiskCount,
      expansionPipeline: expansionTotal,
      avgContractValue: avgValue,
    };
  } catch (error) {
    console.error('Error fetching AM metrics:', error);
    return {
      nrrTarget: 0,
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
        const healthScore = account.Current_Gainsight_Score__c || 70;
        const risk = account.Risk__c || 'Green';

        let renewalRisk: 'At Risk' | 'On Track' | 'Expansion Opportunity';
        if (risk === 'Red' || healthScore < 50 || daysToRenewal < 30) {
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
                usagePercent: 85, // Mock - would come from actual usage data
                employeeGrowth: 20, // Mock - would calculate from historical data
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
      adoptionTrend: 5, // Mock - would calculate from historical usage data
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
      opportunityName: string;
      owner: string;
      amount: number;
      stage: string;
      daysInStage: number;
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
  filters: DashboardFilters = {}
): Promise<SalesLeaderDashboard> {
  try {
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
      SELECT SUM(Amount) total, OwnerId, Owner.Name
      FROM Opportunity
      WHERE OwnerId IN (${teamMemberIdsStr})
        AND IsWon = true
        AND ${dateFilter}
        ${filters.minDealSize ? `AND Amount >= ${filters.minDealSize}` : ''}
      GROUP BY OwnerId, Owner.Name
    `;

    // Get team pipeline (open opps with filters)
    const pipelineQuery = `
      SELECT Id, Name, Amount, StageName, OwnerId, Owner.Name, AccountId, Account.Name,
             CloseDate, CreatedDate, LastModifiedDate,
             COM_Metrics__c, MEDDPICCR_Economic_Buyer__c, MEDDPICCR_Decision_Criteria__c,
             MEDDPICCR_Decision_Process__c, MEDDPICCR_Paper_Process__c,
             MEDDPICCR_Implicate_Pain__c, MEDDPICCR_Champion__c, MEDDPICCR_Competition__c,
             MEDDPICC_Overall_Score__c
      FROM Opportunity
      WHERE OwnerId IN (${teamMemberIdsStr})
        AND IsClosed = false
        ${filters.minDealSize ? `AND Amount >= ${filters.minDealSize}` : ''}
    `;

    // Get recent wins (last 30 days)
    const recentWinsQuery = `
      SELECT Id, Name, Amount, OwnerId, Owner.Name, AccountId, Account.Name, CloseDate
      FROM Opportunity
      WHERE OwnerId IN (${teamMemberIdsStr})
        AND IsWon = true
        AND CloseDate = LAST_N_DAYS:30
      ORDER BY CloseDate DESC
      LIMIT 10
    `;

    // Get recent losses (last 30 days)
    const recentLossesQuery = `
      SELECT Id, Name, Amount, OwnerId, Owner.Name, AccountId, Account.Name, Loss_Reason__c
      FROM Opportunity
      WHERE OwnerId IN (${teamMemberIdsStr})
        AND IsWon = false
        AND IsClosed = true
        AND CloseDate = LAST_N_DAYS:30
      ORDER BY CloseDate DESC
      LIMIT 10
    `;

    // Execute all queries in parallel
    const [closedWonResult, pipelineResult, recentWinsResult, recentLossesResult] = await Promise.all([
      connection.query(closedWonQuery),
      connection.query(pipelineQuery),
      connection.query(recentWinsQuery),
      connection.query(recentLossesQuery),
    ]);

    const closedWonByRep = closedWonResult.records as any[];
    const allPipeline = pipelineResult.records as any[];
    const wins = recentWinsResult.records as any[];
    const losses = recentLossesResult.records as any[];

    // Calculate team metrics
    const totalClosedWon = closedWonByRep.reduce((sum, r) => sum + (r.total || 0), 0);
    const teamQuotaTarget = teamMembers.length * 1000000; // $1M per rep - should come from actual quota fields
    const quotaPercentage = teamQuotaTarget > 0 ? (totalClosedWon / teamQuotaTarget) * 100 : 0;

    const totalPipeline = allPipeline.reduce((sum, opp) => sum + (opp.Amount || 0), 0);
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
    const atRiskValue = atRiskDeals.reduce((sum, opp) => sum + (opp.Amount || 0), 0);

    // Calculate average deal cycle (from created to closed for won deals this year)
    const avgDealCycleDays = 45; // Mock - would calculate from actual closed deals
    const avgDealCycleTrend = -5; // Mock - would compare to previous period

    // Build rep performance leaderboard
    const repPerformance = teamMembers.map(rep => {
      const repClosedWon = closedWonByRep.find(r => r.OwnerId === rep.Id);
      const closedWonAmount = repClosedWon?.total || 0;
      const repQuota = 1000000; // $1M - should come from user quota field
      const quotaAttainment = repQuota > 0 ? (closedWonAmount / repQuota) * 100 : 0;

      const repPipeline = allPipeline.filter(opp => opp.OwnerId === rep.Id);
      const totalRepPipeline = repPipeline.reduce((sum, opp) => sum + (opp.Amount || 0), 0);
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
        amount: opp.Amount || 0,
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
        amount: opp.Amount || 0,
        stage: opp.StageName,
        meddpiccScore: calculateMEDDPICCScore(opp),
      }));

    const coldAccounts = allPipeline
      .filter(opp => {
        const daysSinceUpdate = daysBetween(opp.LastModifiedDate || now.toISOString(), now);
        return daysSinceUpdate > 21; // No activity in 3+ weeks
      })
      .slice(0, 10)
      .map(opp => ({
        id: opp.Id,
        accountName: opp.Account?.Name || 'Unknown',
        opportunityName: opp.Name,
        owner: opp.Owner?.Name || 'Unknown',
        amount: opp.Amount || 0,
        stage: opp.StageName,
        daysInStage: daysBetween(opp.LastModifiedDate || now.toISOString(), now),
      }));

    const largeDeals = allPipeline
      .filter(opp => (opp.Amount || 0) >= 100000) // $100K+ deals
      .sort((a, b) => (b.Amount || 0) - (a.Amount || 0))
      .slice(0, 10)
      .map(opp => ({
        id: opp.Id,
        accountName: opp.Account?.Name || 'Unknown',
        opportunityName: opp.Name,
        owner: opp.Owner?.Name || 'Unknown',
        amount: opp.Amount || 0,
        stage: opp.StageName,
        daysInStage: daysBetween(opp.CreatedDate || now.toISOString(), now),
      }));

    // Format recent wins and losses
    const recentWins = wins.map(opp => ({
      id: opp.Id,
      accountName: opp.Account?.Name || 'Unknown',
      amount: opp.Amount || 0,
      owner: opp.Owner?.Name || 'Unknown',
      closeDate: opp.CloseDate,
    }));

    const recentLosses = losses.map(opp => ({
      id: opp.Id,
      accountName: opp.Account?.Name || 'Unknown',
      amount: opp.Amount || 0,
      owner: opp.Owner?.Name || 'Unknown',
      lossReason: opp.Loss_Reason__c || 'Unknown',
    }));

    // Mock trend calculation (would compare to last month)
    const quotaTrend = 5; // +5% vs last month

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
  currentQuarter: {
    quarterName: string;
    totalPipeline: number;
    commitForecast: number;
    bestCaseForecast: number;
    coverageRatio: number;
    opportunitiesByStage: {
      stageName: string;
      count: number;
      value: number;
    }[];
  };
  nextQuarter: {
    quarterName: string;
    totalPipeline: number;
    commitForecast: number;
    bestCaseForecast: number;
    coverageRatio: number;
    opportunitiesByStage: {
      stageName: string;
      count: number;
      value: number;
    }[];
  };
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
 * Get Pipeline and Forecast for AE
 */
export async function getPipelineForecast(
  connection: Connection,
  userId: string,
  pool: Pool
): Promise<PipelineForecast> {
  try {
    const amountField = await getAmountFieldName(pool);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate current quarter
    const currentQuarter = Math.floor(currentMonth / 3);
    const currentQuarterStart = new Date(currentYear, currentQuarter * 3, 1);
    const currentQuarterEnd = new Date(currentYear, currentQuarter * 3 + 3, 0);

    // Calculate next quarter
    const nextQuarterStart = new Date(currentQuarterEnd);
    nextQuarterStart.setDate(nextQuarterStart.getDate() + 1);
    const nextQuarterEnd = new Date(nextQuarterStart.getFullYear(), nextQuarterStart.getMonth() + 3, 0);

    // Query opportunities for current quarter
    const currentQuarterQuery = `
      SELECT Id, Name, StageName, ${amountField}, CloseDate, Probability, ForecastCategory
      FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsClosed = false
        AND CloseDate >= ${currentQuarterStart.toISOString().split('T')[0]}
        AND CloseDate <= ${currentQuarterEnd.toISOString().split('T')[0]}
      ORDER BY CloseDate ASC
    `;

    // Query opportunities for next quarter
    const nextQuarterQuery = `
      SELECT Id, Name, StageName, ${amountField}, CloseDate, Probability, ForecastCategory
      FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsClosed = false
        AND CloseDate >= ${nextQuarterStart.toISOString().split('T')[0]}
        AND CloseDate <= ${nextQuarterEnd.toISOString().split('T')[0]}
      ORDER BY CloseDate ASC
    `;

    const [currentQtrResult, nextQtrResult] = await Promise.all([
      connection.query(currentQuarterQuery),
      connection.query(nextQuarterQuery),
    ]);

    const currentQtrOpps = currentQtrResult.records as any[];
    const nextQtrOpps = nextQtrResult.records as any[];

    // Helper function to calculate quarter metrics
    const calculateQuarterMetrics = (opps: any[], quarterName: string) => {
      const totalPipeline = opps.reduce((sum, opp) => sum + (opp[amountField] || 0), 0);

      // Group by stage
      const stageMap = new Map<string, { count: number; value: number }>();
      opps.forEach((opp) => {
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

      // Calculate forecast categories
      const commitForecast = opps
        .filter((opp) => opp.ForecastCategory === 'Commit' || opp.ForecastCategory === 'Closed')
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);

      const bestCaseForecast = opps
        .filter((opp) =>
          opp.ForecastCategory === 'Commit' ||
          opp.ForecastCategory === 'Closed' ||
          opp.ForecastCategory === 'Best Case'
        )
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);

      // Calculate coverage ratio (pipeline / expected quota)
      // Assuming quarterly quota is total annual quota / 4
      // This is a simplified calculation - adjust based on actual quota data
      const coverageRatio = totalPipeline > 0 ? totalPipeline / Math.max(commitForecast, 1) : 0;

      return {
        quarterName,
        totalPipeline,
        commitForecast,
        bestCaseForecast,
        coverageRatio,
        opportunitiesByStage,
      };
    };

    const currentQuarterData = calculateQuarterMetrics(
      currentQtrOpps,
      `Q${currentQuarter + 1} ${currentYear}`
    );

    const nextQuarterNum = (currentQuarter + 1) % 4 + 1;
    const nextQuarterYear = currentQuarter === 3 ? currentYear + 1 : currentYear;
    const nextQuarterData = calculateQuarterMetrics(
      nextQtrOpps,
      `Q${nextQuarterNum} ${nextQuarterYear}`
    );

    // Get Salesforce instance URL for forecast submission
    const identity = await connection.identity();
    const instanceUrl = identity.urls?.enterprise?.replace('{version}', '60.0').split('/services')[0] || '';

    return {
      currentQuarter: currentQuarterData,
      nextQuarter: nextQuarterData,
      forecastStatus: {
        isSubmitted: false, // TODO: Check actual forecast submission status
        submissionUrl: `${instanceUrl}/lightning/o/Opportunity/list`,
      },
    };
  } catch (error) {
    console.error('Error fetching pipeline forecast:', error);
    return {
      currentQuarter: {
        quarterName: 'Current Quarter',
        totalPipeline: 0,
        commitForecast: 0,
        bestCaseForecast: 0,
        coverageRatio: 0,
        opportunitiesByStage: [],
      },
      nextQuarter: {
        quarterName: 'Next Quarter',
        totalPipeline: 0,
        commitForecast: 0,
        bestCaseForecast: 0,
        coverageRatio: 0,
        opportunitiesByStage: [],
      },
      forecastStatus: {
        isSubmitted: false,
        submissionUrl: '',
      },
    };
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
  managerId: string
): Promise<PriorityItem[]> {
  try {
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
      SELECT Id, Name, AccountId, Account.Name, StageName, Amount, CloseDate,
             LastModifiedDate, CreatedDate, OwnerId, Owner.Name,
             Command_Why_Do_Anything__c, Command_Why_Now__c, Command_Why_Us__c,
             MEDDPICC_Overall_Score__c, NextStep, IsAtRisk__c
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

    // 1. Critical: At Risk Deals
    opportunities.forEach((opp) => {
      if (opp.IsAtRisk__c) {
        const repPriorities = prioritiesByRep.get(opp.OwnerId) || 0;
        if (repPriorities < 2) {
          priorities.push({
            id: `at-risk-${opp.Id}`,
            type: 'deal-risk',
            title: `${opp.Owner.Name}: ${opp.Name} flagged as At Risk`,
            description: `${formatCurrency(opp.Amount || 0)} - Review with rep and create action plan`,
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

    // 2. High: Large deals closing this month missing Command fields
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    opportunities.forEach((opp) => {
      const closeDate = new Date(opp.CloseDate);
      const amount = opp.Amount || 0;
      if (
        closeDate.getMonth() === currentMonth &&
        closeDate.getFullYear() === currentYear &&
        amount > 50000
      ) {
        const missingFields: string[] = [];
        if (!opp.Command_Why_Do_Anything__c) missingFields.push('Why Do Anything');
        if (!opp.Command_Why_Now__c) missingFields.push('Why Now');
        if (!opp.Command_Why_Us__c) missingFields.push('Why Us');

        if (missingFields.length > 0) {
          priorities.push({
            id: `missing-cmd-${opp.Id}`,
            type: 'missing-info',
            title: `${opp.Owner.Name}: Complete Command for ${opp.Name}`,
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
      if (daysInStage > 45 && (opp.Amount || 0) > 25000) {
        const repPriorities = prioritiesByRep.get(opp.OwnerId) || 0;
        if (repPriorities < 3) {
          priorities.push({
            id: `stuck-${opp.Id}`,
            type: 'stage-stuck',
            title: `${opp.Owner.Name}: ${opp.Name} stuck ${daysInStage} days`,
            description: `${formatCurrency(opp.Amount || 0)} in ${opp.StageName} - Needs intervention`,
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

    // 4. Medium: Low MEDDPICC on significant deals
    opportunities.forEach((opp) => {
      const score = opp.MEDDPICC_Overall_Score__c || 0;
      const amount = opp.Amount || 0;
      if (score < 50 && amount > 50000 && opp.StageName !== 'Prospecting') {
        priorities.push({
          id: `low-meddpicc-${opp.Id}`,
          type: 'missing-info',
          title: `${opp.Owner.Name}: Low qualification on ${opp.Name}`,
          description: `${formatCurrency(amount)} - MEDDPICC ${score}% - Coach on qualification`,
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
  pool: Pool
): Promise<PipelineForecast> {
  try {
    const amountField = await getAmountFieldName(pool);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

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
      return {
        currentQuarter: {
          quarterName: 'Current Quarter',
          totalPipeline: 0,
          commitForecast: 0,
          bestCaseForecast: 0,
          coverageRatio: 0,
          opportunitiesByStage: [],
        },
        nextQuarter: {
          quarterName: 'Next Quarter',
          totalPipeline: 0,
          commitForecast: 0,
          bestCaseForecast: 0,
          coverageRatio: 0,
          opportunitiesByStage: [],
        },
        forecastStatus: {
          isSubmitted: false,
          submissionUrl: '',
        },
      };
    }

    // Calculate current quarter
    const currentQuarter = Math.floor(currentMonth / 3);
    const currentQuarterStart = new Date(currentYear, currentQuarter * 3, 1);
    const currentQuarterEnd = new Date(currentYear, currentQuarter * 3 + 3, 0);

    // Calculate next quarter
    const nextQuarterStart = new Date(currentQuarterEnd);
    nextQuarterStart.setDate(nextQuarterStart.getDate() + 1);
    const nextQuarterEnd = new Date(nextQuarterStart.getFullYear(), nextQuarterStart.getMonth() + 3, 0);

    // Query team's opportunities for current quarter
    const currentQuarterQuery = `
      SELECT Id, Name, StageName, ${amountField}, CloseDate, Probability, ForecastCategory, OwnerId, Owner.Name
      FROM Opportunity
      WHERE OwnerId IN ('${teamMemberIds.join("','")}')
        AND IsClosed = false
        AND CloseDate >= ${currentQuarterStart.toISOString().split('T')[0]}
        AND CloseDate <= ${currentQuarterEnd.toISOString().split('T')[0]}
      ORDER BY CloseDate ASC
    `;

    // Query team's opportunities for next quarter
    const nextQuarterQuery = `
      SELECT Id, Name, StageName, ${amountField}, CloseDate, Probability, ForecastCategory, OwnerId, Owner.Name
      FROM Opportunity
      WHERE OwnerId IN ('${teamMemberIds.join("','")}')
        AND IsClosed = false
        AND CloseDate >= ${nextQuarterStart.toISOString().split('T')[0]}
        AND CloseDate <= ${nextQuarterEnd.toISOString().split('T')[0]}
      ORDER BY CloseDate ASC
    `;

    const [currentQtrResult, nextQtrResult] = await Promise.all([
      connection.query(currentQuarterQuery),
      connection.query(nextQuarterQuery),
    ]);

    const currentQtrOpps = currentQtrResult.records as any[];
    const nextQtrOpps = nextQtrResult.records as any[];

    // Helper function to calculate quarter metrics
    const calculateQuarterMetrics = (opps: any[], quarterName: string) => {
      const totalPipeline = opps.reduce((sum, opp) => sum + (opp[amountField] || 0), 0);

      // Group by stage
      const stageMap = new Map<string, { count: number; value: number }>();
      opps.forEach((opp) => {
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

      // Calculate forecast categories
      const commitForecast = opps
        .filter((opp) => opp.ForecastCategory === 'Commit' || opp.ForecastCategory === 'Closed')
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);

      const bestCaseForecast = opps
        .filter((opp) =>
          opp.ForecastCategory === 'Commit' ||
          opp.ForecastCategory === 'Closed' ||
          opp.ForecastCategory === 'Best Case'
        )
        .reduce((sum, opp) => sum + (opp[amountField] || 0), 0);

      // Calculate coverage ratio
      const coverageRatio = totalPipeline > 0 ? totalPipeline / Math.max(commitForecast, 1) : 0;

      return {
        quarterName,
        totalPipeline,
        commitForecast,
        bestCaseForecast,
        coverageRatio,
        opportunitiesByStage,
      };
    };

    const currentQuarterData = calculateQuarterMetrics(
      currentQtrOpps,
      `Q${currentQuarter + 1} ${currentYear} (Team)`
    );

    const nextQuarterNum = (currentQuarter + 1) % 4 + 1;
    const nextQuarterYear = currentQuarter === 3 ? currentYear + 1 : currentYear;
    const nextQuarterData = calculateQuarterMetrics(
      nextQtrOpps,
      `Q${nextQuarterNum} ${nextQuarterYear} (Team)`
    );

    // Get Salesforce instance URL
    const identity = await connection.identity();
    const instanceUrl = identity.urls?.enterprise?.replace('{version}', '60.0').split('/services')[0] || '';

    return {
      currentQuarter: currentQuarterData,
      nextQuarter: nextQuarterData,
      forecastStatus: {
        isSubmitted: false,
        submissionUrl: `${instanceUrl}/lightning/o/Opportunity/list`,
      },
    };
  } catch (error) {
    console.error('Error fetching team pipeline forecast:', error);
    return {
      currentQuarter: {
        quarterName: 'Current Quarter',
        totalPipeline: 0,
        commitForecast: 0,
        bestCaseForecast: 0,
        coverageRatio: 0,
        opportunitiesByStage: [],
      },
      nextQuarter: {
        quarterName: 'Next Quarter',
        totalPipeline: 0,
        commitForecast: 0,
        bestCaseForecast: 0,
        coverageRatio: 0,
        opportunitiesByStage: [],
      },
      forecastStatus: {
        isSubmitted: false,
        submissionUrl: '',
      },
    };
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
