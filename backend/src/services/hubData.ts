/**
 * Hub Data Service
 *
 * Specialized data queries for role-based hubs (AE, AM, CSM)
 */

import { Connection } from 'jsforce';
import { Account, Opportunity } from './salesforceData';
import * as agentforce from './agentforceService';

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
 */
function calculateMEDDPICCScore(opp: Opportunity): number {
  // If actual score field exists, use it
  if (opp.MEDDPICC_Overall_Score__c) {
    return opp.MEDDPICC_Overall_Score__c;
  }

  // Otherwise calculate based on filled fields
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

  const filledCount = fields.filter(f => f && f.trim().length > 0).length;
  return Math.round((filledCount / fields.length) * 100);
}

/**
 * Generate AI recommendation for priority account using Agentforce
 */
async function generateAccountRecommendation(
  connection: Connection,
  account: Account
): Promise<string> {
  try {
    const recommendation = await agentforce.getRecommendation(connection, {
      objectType: 'Account',
      recordId: account.Id,
      data: {
        intentScore: account.accountIntentScore6sense__c || 0,
        buyingStage: account.accountBuyingStage6sense__c,
        signals: account.Clay_Active_Signals__c,
        employeeCount: account.Clay_Employee_Count__c || account.Gemini_Employee_Count__c,
        industry: account.Industry || account.Clay_Industry__c,
      },
      promptType: 'ae_priority_account',
    });

    return recommendation.text;
  } catch (error) {
    console.error('Error generating account recommendation:', error);
    // Fallback to simple recommendation
    const stage = account.accountBuyingStage6sense__c || '';
    const intentScore = account.accountIntentScore6sense__c || 0;

    if (stage.toLowerCase().includes('purchase') || intentScore > 85) {
      return 'High intent detected. Schedule discovery call this week.';
    }
    return 'Monitor intent signals and engage with relevant content.';
  }
}

/**
 * Generate AI recommendation for at-risk deal using Agentforce
 */
async function generateDealRecommendation(
  connection: Connection,
  opp: Opportunity,
  daysSinceActivity: number
): Promise<string> {
  try {
    const meddpiccScore = calculateMEDDPICCScore(opp);
    const missingElements = [];

    if (!opp.MEDDPICCR_Economic_Buyer__c && !opp.Economic_Buyer_Name__c) {
      missingElements.push('Economic Buyer');
    }
    if (!opp.MEDDPICCR_Champion__c) {
      missingElements.push('Champion');
    }
    if (!opp.MEDDPICCR_Decision_Process__c) {
      missingElements.push('Decision Process');
    }
    if (!opp.COM_Metrics__c) {
      missingElements.push('Metrics');
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
      },
      promptType: 'ae_at_risk_deal',
    });

    return recommendation.text;
  } catch (error) {
    console.error('Error generating deal recommendation:', error);
    // Fallback
    if (daysSinceActivity > 14) {
      return `No activity in ${daysSinceActivity} days. Schedule check-in call immediately.`;
    }
    return 'Update close date and next steps to keep momentum.';
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
  userId: string
): Promise<AEMetrics> {
  const currentYear = new Date().getFullYear();

  // Get closed won opps for quota attainment
  const closedWonQuery = `
    SELECT SUM(Amount) total
    FROM Opportunity
    WHERE OwnerId = '${userId}'
      AND IsWon = true
      AND CALENDAR_YEAR(CloseDate) = ${currentYear}
  `;

  // Get pipeline (open opps)
  const pipelineQuery = `
    SELECT SUM(Amount) total, COUNT() count
    FROM Opportunity
    WHERE OwnerId = '${userId}'
      AND IsClosed = false
  `;

  // Get hot prospects (high intent accounts)
  const hotProspectsQuery = `
    SELECT COUNT() total
    FROM Account
    WHERE OwnerId = '${userId}'
      AND accountIntentScore6sense__c >= 80
  `;

  try {
    const [closedWonResult, pipelineResult, hotProspectsResult] = await Promise.all([
      connection.query(closedWonQuery),
      connection.query(pipelineQuery),
      connection.query(hotProspectsQuery),
    ]);

    const closedWonTotal = (closedWonResult.records[0] as any)?.total || 0;
    const pipelineTotal = (pipelineResult.records[0] as any)?.total || 0;
    const pipelineCount = (pipelineResult.records[0] as any)?.count || 0;
    const hotProspects = (hotProspectsResult.records[0] as any)?.total || 0;

    // Assume quota (could be from a custom field or user setting)
    const annualQuota = 1000000; // $1M - this should come from user quota field
    const quotaRemaining = Math.max(0, annualQuota - closedWonTotal);
    const pipelineCoverage = quotaRemaining > 0 ? pipelineTotal / quotaRemaining : 0;

    return {
      quotaAttainmentYTD: annualQuota > 0 ? (closedWonTotal / annualQuota) * 100 : 0,
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
 * Get priority accounts for AE (high intent prospects)
 */
export async function getPriorityAccounts(
  connection: Connection,
  userId: string
): Promise<PriorityAccount[]> {
  const query = `
    SELECT Id, Name, Industry, OwnerId,
           accountBuyingStage6sense__c, accountIntentScore6sense__c,
           X6Sense_Segments__c,
           Clay_Employee_Count__c, Gemini_Employee_Count__c,
           Clay_Revenue__c, Clay_Industry__c,
           LMS_System_s__c,
           CreatedDate, LastModifiedDate
    FROM Account
    WHERE OwnerId = '${userId}'
      AND accountIntentScore6sense__c >= 70
    ORDER BY accountIntentScore6sense__c DESC
    LIMIT 20
  `;

  try {
    const result = await connection.query<Account>(query);
    const accounts = result.records || [];

    // First, transform accounts with basic data
    const transformedAccounts = accounts.map(account => {
      const intentScore = account.accountIntentScore6sense__c || 70;
      const employeeCount = account.Clay_Employee_Count__c || account.Gemini_Employee_Count__c || 0;

      // Determine priority tier
      let priorityTier: '🔥 Hot' | '🔶 Warm' | '🔵 Cool';
      if (intentScore >= 85) {
        priorityTier = '🔥 Hot';
      } else if (intentScore >= 75) {
        priorityTier = '🔶 Warm';
      } else {
        priorityTier = '🔵 Cool';
      }

      return {
        ...account,
        priorityTier,
        employeeCount,
        employeeGrowthPct: 15, // Mock value - could calculate from historical data
        intentScore,
        buyingStage: account.accountBuyingStage6sense__c || 'Awareness',
        techStack: account.X6Sense_Segments__c || (account as any).LMS_System_s__c || 'Unknown',
        topSignal: `Intent score: ${intentScore} • ${account.accountBuyingStage6sense__c || 'Active research'}`,
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
 * Get at-risk deals for AE (stale or low MEDDPICC score)
 */
export async function getAtRiskDeals(
  connection: Connection,
  userId: string
): Promise<AtRiskDeal[]> {
  const query = `
    SELECT Id, Name, AccountId, Account.Name, Amount, StageName,
           CloseDate, LastModifiedDate, CreatedDate,
           COM_Metrics__c, MEDDPICCR_Economic_Buyer__c, Economic_Buyer_Name__c,
           MEDDPICCR_Decision_Criteria__c, MEDDPICCR_Decision_Process__c,
           MEDDPICCR_Paper_Process__c, MEDDPICCR_Implicate_Pain__c,
           MEDDPICCR_Champion__c, MEDDPICCR_Competition__c,
           MEDDPICC_Overall_Score__c, Risk__c
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

    // Filter opportunities first
    const filteredOpps = opportunities.filter(opp => {
      const daysSinceActivity = daysBetween(opp.LastModifiedDate || now.toISOString(), now);
      const meddpiccScore = calculateMEDDPICCScore(opp);

      // Only include if stale (>14 days) or low MEDDPICC (<60%)
      return daysSinceActivity >= 14 || meddpiccScore < 60;
    });

    // Process with AI recommendations in parallel
    const atRiskDeals = await Promise.all(
      filteredOpps.map(async opp => {
        const daysSinceActivity = daysBetween(opp.LastModifiedDate || now.toISOString(), now);
        const meddpiccScore = calculateMEDDPICCScore(opp);

        let warning = '';
        if (daysSinceActivity > 30) {
          warning = `⚠️ No activity in ${daysSinceActivity} days`;
        } else if (daysSinceActivity > 14) {
          warning = `⚡ ${daysSinceActivity} days since last update`;
        } else if (meddpiccScore < 40) {
          warning = `📉 MEDDPICC score critically low (${meddpiccScore}%)`;
        } else if (meddpiccScore < 60) {
          warning = `📊 MEDDPICC incomplete (${meddpiccScore}%)`;
        }

        // Get AI recommendation
        const aiRecommendation = await generateDealRecommendation(connection, opp, daysSinceActivity);

        return {
          ...opp,
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

/**
 * Get Sales Leader Dashboard data with team metrics and coaching opportunities
 */
export async function getSalesLeaderDashboard(
  connection: Connection,
  managerId: string
): Promise<SalesLeaderDashboard> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  try {
    // First, get all direct reports
    const teamMembersQuery = `
      SELECT Id, Name
      FROM User
      WHERE ManagerId = '${managerId}'
        AND IsActive = true
    `;
    const teamMembersResult = await connection.query(teamMembersQuery);
    const teamMembers = teamMembersResult.records as any[];
    const teamMemberIds = teamMembers.map(u => u.Id);

    if (teamMemberIds.length === 0) {
      // No direct reports - return empty dashboard
      return getEmptySalesLeaderDashboard();
    }

    const teamMemberIdsStr = teamMemberIds.map(id => `'${id}'`).join(',');

    // Get team quota attainment (closed won this year)
    const closedWonQuery = `
      SELECT SUM(Amount) total, OwnerId, Owner.Name
      FROM Opportunity
      WHERE OwnerId IN (${teamMemberIdsStr})
        AND IsWon = true
        AND CALENDAR_YEAR(CloseDate) = ${currentYear}
      GROUP BY OwnerId, Owner.Name
    `;

    // Get team pipeline (open opps)
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
