import { Connection } from 'jsforce';

/**
 * Salesforce Data Service
 *
 * This service handles all Salesforce API queries and data transformations.
 * It gracefully handles missing custom fields by catching errors and falling back to standard fields.
 */

// Type definitions for our data structures
export interface Account {
  Id: string;
  Name: string;
  Industry?: string;
  OwnerId?: string;
  ParentId?: string;
  Parent?: { Name: string };

  // Standard Salesforce Account fields
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  Rating?: string;
  Type?: string;

  // 6sense fields (actual API names from Salesforce)
  accountBuyingStage6sense__c?: string;
  accountIntentScore6sense__c?: number;
  accountProfileFit6sense__c?: string;
  accountProfileScore6sense__c?: number;
  accountReachScore6sense__c?: string;
  accountUpdateDate6sense__c?: string;
  X6Sense_Segments__c?: string;
  X6senseID__c?: string;
  Previous_6sense_Account_Buying_Stage__c?: string;

  // Clay enrichment fields
  Clay_Employee_Count__c?: number;
  Gemini_Employee_Count__c?: number;
  Clay_Revenue__c?: number;
  Clay_Industry__c?: string;
  Clay_Parent_Account__c?: string;
  Clay_Total_Locations__c?: number;
  Clay_NAICS_code__c?: number;
  Clay_City__c?: string;
  Clay_State__c?: string;
  Clay_Country__c?: string;
  Clay_Franchise__c?: boolean;
  Clay_Is_the_Parent_Company__c?: boolean;
  Enriched_by_Clay__c?: boolean;
  Last_Enriched_by_Clay__c?: string;

  // Priority/Scoring fields
  Current_Gainsight_Score__c?: number;
  bizible2__Engagement_Score__c?: string;
  MQL_Company_Score__c?: number;
  G2Crowd__CustomerPriority__c?: string;
  Customer_Success_Score__c?: number;

  // Health & Risk
  Risk__c?: string;
  Customer_Stage__c?: string;
  Total_ARR__c?: number;
  of_Axonify_Users__c?: number;
  Launch_Date__c?: string;
  Agreement_Expiry_Date__c?: string;
  Last_QBR__c?: string;
  Last_Exec_Check_In__c?: string;

  // Axonify Usage/License Data
  Contract_Total_License_Seats__c?: number;
  Total_Hierarchy_Seats__c?: number;
  Logo_Seats__c?: number;
  License_Override__c?: number;

  // Active Users by Product
  Total_Active_Users__c?: number;
  Active_Users_Max__c?: number;
  Active_Users_Learn__c?: number;
  Active_Users_Comms__c?: number;
  Active_Users_Tasks__c?: number;
  Learn_Users__c?: number;
  Comms_Users__c?: number;
  Tasks_Users__c?: number;
  Chat_Users__c?: number;
  Max_Users__c?: number;
  Recognition_Users__c?: number;
  Content_Studio_Licenses__c?: number;

  // License Utilization (percentages)
  License_Utilization_Max__c?: number;
  License_Utilization_Learn__c?: number;
  License_Utilization_Comms__c?: number;
  License_Utilization_Tasks__c?: number;

  // Usage Summaries
  Max_Usage_Trend__c?: string;
  License_Utilization_current_Summary__c?: string;
  License_Utilization_Active_User_Summary__c?: string;
  Usage_Metrics_Next_Steps__c?: string;

  // Notes/Commentary
  Strategy_Notes__c?: string;
  Risk_Notes__c?: string;
  Contract_Notes__c?: string;
  Overall_Customer_Health_Notes__c?: string;
  Sponsorship_Notes__c?: string;
  Support_Notes__c?: string;

  // Legacy/mock field names for backward compatibility
  Priority_Score__c?: number;
  Priority_Tier__c?: string;
  Clay_Employee_Growth_Pct__c?: number;
  Clay_Current_LMS__c?: string;
  Clay_Active_Signals__c?: string;
  SixSense_Intent_Score__c?: number;
  SixSense_Buying_Stage__c?: string;

  CreatedDate?: string;
  LastModifiedDate?: string;
}

export interface Opportunity {
  Id: string;
  Name: string;
  AccountId?: string;
  Account?: {
    Name: string;
    Id?: string;
    Type?: string;
  };
  Amount?: number;
  StageName?: string;
  Probability?: number;
  CloseDate?: string;
  OwnerId?: string;
  Owner?: {
    Name: string;
    Email?: string;
  };
  CreatedDate?: string;
  LastModifiedDate?: string;

  // Standard Opportunity fields
  Type?: string;
  NextStep?: string;
  Description?: string;
  LeadSource?: string;

  // MEDDPICC Fields (actual field names from Salesforce)
  COM_Metrics__c?: string;
  MEDDPICCR_Economic_Buyer__c?: string;
  Economic_Buyer_Name__c?: string;
  Economic_Buyer_Title__c?: string;
  MEDDPICCR_Decision_Criteria__c?: string;
  MEDDPICCR_Decision_Process__c?: string;
  MEDDPICCR_Paper_Process__c?: string;
  MEDDPICCR_Implicate_Pain__c?: string;
  MEDDPICCR_Champion__c?: string;
  MEDDPICCR_Competition__c?: string;
  MEDDPICCR_Risks__c?: string;

  // Risk tracking
  Risk__c?: string;
  Unresolved_Risks__c?: number;

  // Deal metrics
  ARR__c?: number;
  Duration__c?: number;
  Total_Contract_Value__c?: number;
  License_Seats__c?: number;
  Milestone__c?: string;
  Use_Cases__c?: string;
  Business_Objectives__c?: string;
  Date_Passed__c?: string;

  // Command of the Message fields (from Gong via Scratchpad)
  Command_Why_Do_Anything__c?: string;
  Command_Why_Now__c?: string;
  Command_Why_Us__c?: string;
  Command_Why_Trust__c?: string;
  Command_Why_Pay_That__c?: string;
  Command_Overall_Score__c?: number;
  Command_Last_Updated__c?: string;
  Command_Confidence_Level__c?: string;

  // Gong Call Insights fields
  Gong_Call_Count__c?: number;
  Gong_Last_Call_Date__c?: string;
  Gong_Sentiment__c?: string;
  Gong_Competitor_Mentions__c?: string;
  Gong_Call_Recording_URL__c?: string;

  // Legacy fields for backward compatibility
  DaysInStage__c?: number;
  IsAtRisk__c?: boolean;
  MEDDPICC_Metrics__c?: number;
  MEDDPICC_Economic_Buyer__c?: number;
  MEDDPICC_Decision_Criteria__c?: number;
  MEDDPICC_Decision_Process__c?: number;
  MEDDPICC_Paper_Process__c?: number;
  MEDDPICC_Identify_Pain__c?: number;
  MEDDPICC_Champion__c?: number;
  MEDDPICC_Competition__c?: number;
  MEDDPICC_Overall_Score__c?: number;
}

export interface Activity {
  Id: string;
  Subject?: string;
  ActivityDate?: string;
  Description?: string;
  Type?: string;
  WhatId?: string;
  WhoId?: string;
}

export interface DashboardStats {
  accounts: {
    total: number;
    highPriority: number;
  };
  opportunities: {
    total: number;
    atRisk: number;
    totalValue: number;
    avgDealSize: number;
  };
}

/**
 * Helper function to safely query Salesforce with custom fields
 * Falls back to a simpler query if custom fields don't exist
 */
async function safeQuery<T>(
  connection: Connection,
  primaryQuery: string,
  fallbackQuery?: string
): Promise<T[]> {
  try {
    const result = await connection.query<T>(primaryQuery);
    return result.records || [];
  } catch (error: any) {
    // Check if error is due to missing fields
    if (error.errorCode === 'INVALID_FIELD' || error.message?.includes('No such column')) {
      console.warn('Custom fields not found, using fallback query:', error.message);

      if (fallbackQuery) {
        try {
          const result = await connection.query<T>(fallbackQuery);
          return result.records || [];
        } catch (fallbackError: any) {
          console.error('Fallback query also failed:', fallbackError.message);
          throw fallbackError;
        }
      }
    }

    console.error('Salesforce query error:', error.message);
    throw error;
  }
}

/**
 * Get high priority accounts (owned by current user)
 * Uses 6sense Intent Score as the priority metric
 */
export async function getHighPriorityAccounts(
  connection: Connection,
  userId: string
): Promise<Account[]> {
  const primaryQuery = `
    SELECT Id, Name, Industry, OwnerId,
           accountBuyingStage6sense__c, accountIntentScore6sense__c,
           accountProfileFit6sense__c, accountProfileScore6sense__c,
           accountReachScore6sense__c, X6Sense_Segments__c,
           CreatedDate, LastModifiedDate
    FROM Account
    WHERE OwnerId = '${userId}'
      AND accountIntentScore6sense__c >= 70
    ORDER BY accountIntentScore6sense__c DESC
    LIMIT 10
  `;

  const fallbackQuery = `
    SELECT Id, Name, Industry, OwnerId, CreatedDate, LastModifiedDate
    FROM Account
    WHERE OwnerId = '${userId}'
    ORDER BY CreatedDate DESC
    LIMIT 10
  `;

  const accounts = await safeQuery<Account>(connection, primaryQuery, fallbackQuery);

  // Map 6sense fields to frontend-expected field names for backward compatibility
  return accounts.map(account => ({
    ...account,
    // Map 6sense Intent Score to Priority Score
    Priority_Score__c: account.accountIntentScore6sense__c || account.Priority_Score__c,
    // Map Buying Stage to Priority Tier
    Priority_Tier__c: account.accountBuyingStage6sense__c || account.Priority_Tier__c,
    // Map 6sense fields for display
    SixSense_Intent_Score__c: account.accountIntentScore6sense__c,
    SixSense_Buying_Stage__c: account.accountBuyingStage6sense__c,
    Clay_Employee_Count__c: account.Clay_Employee_Count__c || account.NumberOfEmployees,
    Clay_Employee_Growth_Pct__c: account.Clay_Employee_Growth_Pct__c,
    Clay_Current_LMS__c: account.Clay_Current_LMS__c,
    Clay_Active_Signals__c: account.Clay_Active_Signals__c,
  }));
}

/**
 * Get all accounts owned by current user
 */
export async function getAllAccounts(
  connection: Connection,
  userId: string
): Promise<Account[]> {
  const primaryQuery = `
    SELECT Id, Name, Industry, OwnerId, NumberOfEmployees,
           ParentId, Parent.Name,
           accountBuyingStage6sense__c, accountIntentScore6sense__c,
           accountProfileFit6sense__c, accountProfileScore6sense__c,
           accountReachScore6sense__c, X6Sense_Segments__c,
           CreatedDate, LastModifiedDate
    FROM Account
    WHERE OwnerId = '${userId}'
    ORDER BY LastModifiedDate DESC
    LIMIT 200
  `;

  const fallbackQuery = `
    SELECT Id, Name, Industry, OwnerId, NumberOfEmployees, ParentId, CreatedDate, LastModifiedDate
    FROM Account
    WHERE OwnerId = '${userId}'
    ORDER BY LastModifiedDate DESC
    LIMIT 200
  `;

  const accounts = await safeQuery<Account>(connection, primaryQuery, fallbackQuery);

  // Map 6sense fields to frontend-expected field names
  return accounts.map(account => ({
    ...account,
    Priority_Score__c: account.accountIntentScore6sense__c,
    Priority_Tier__c: account.accountBuyingStage6sense__c,
    SixSense_Intent_Score__c: account.accountIntentScore6sense__c,
    SixSense_Buying_Stage__c: account.accountBuyingStage6sense__c,
    Clay_Employee_Count__c: account.Clay_Employee_Count__c || account.NumberOfEmployees,
    Clay_Employee_Growth_Pct__c: account.Clay_Employee_Growth_Pct__c,
  }));
}

/**
 * Get a single account by ID
 */
export async function getAccountById(
  connection: Connection,
  accountId: string
): Promise<Account | null> {
  const primaryQuery = `
    SELECT Id, Name, Industry, OwnerId, Website, AnnualRevenue, NumberOfEmployees,
           BillingCity, BillingState, BillingCountry,
           accountBuyingStage6sense__c, accountIntentScore6sense__c,
           accountProfileFit6sense__c, accountProfileScore6sense__c,
           accountReachScore6sense__c, accountUpdateDate6sense__c,
           X6Sense_Segments__c, X6senseID__c,
           Clay_Employee_Count__c, Clay_Revenue__c, Clay_Industry__c,
           Clay_City__c, Clay_State__c, Clay_Country__c,
           Total_ARR__c, Customer_Stage__c, Risk__c,
           Agreement_Expiry_Date__c, Last_QBR__c, Last_Exec_Check_In__c,
           Current_Gainsight_Score__c,
           Contract_Total_License_Seats__c, Total_Hierarchy_Seats__c, Logo_Seats__c,
           Total_Active_Users__c, Active_Users_Max__c, Active_Users_Learn__c,
           Active_Users_Comms__c, Active_Users_Tasks__c,
           Learn_Users__c, Comms_Users__c, Tasks_Users__c, Chat_Users__c,
           Max_Users__c, Recognition_Users__c, Content_Studio_Licenses__c,
           License_Utilization_Max__c, License_Utilization_Learn__c,
           License_Utilization_Comms__c, License_Utilization_Tasks__c,
           Max_Usage_Trend__c, License_Utilization_current_Summary__c,
           License_Utilization_Active_User_Summary__c, Usage_Metrics_Next_Steps__c,
           CreatedDate, LastModifiedDate
    FROM Account
    WHERE Id = '${accountId}'
    LIMIT 1
  `;

  const fallbackQuery = `
    SELECT Id, Name, Industry, OwnerId, Website, AnnualRevenue, NumberOfEmployees,
           BillingCity, BillingState, BillingCountry,
           CreatedDate, LastModifiedDate
    FROM Account
    WHERE Id = '${accountId}'
    LIMIT 1
  `;

  const accounts = await safeQuery<Account>(connection, primaryQuery, fallbackQuery);

  if (accounts.length === 0) {
    return null;
  }

  const account = accounts[0];

  // Map 6sense fields to frontend-expected field names
  return {
    ...account,
    Priority_Score__c: account.accountIntentScore6sense__c,
    Priority_Tier__c: account.accountBuyingStage6sense__c,
    SixSense_Intent_Score__c: account.accountIntentScore6sense__c,
    SixSense_Buying_Stage__c: account.accountBuyingStage6sense__c,
    Clay_Employee_Count__c: account.Clay_Employee_Count__c || account.NumberOfEmployees,
    Clay_Employee_Growth_Pct__c: account.Clay_Employee_Growth_Pct__c,
    Clay_Current_LMS__c: account.Clay_Current_LMS__c,
    Clay_Active_Signals__c: account.Clay_Active_Signals__c,
  };
}

/**
 * Get at-risk opportunities (owned by current user, open, and stale)
 */
export async function getAtRiskOpportunities(
  connection: Connection,
  userId: string
): Promise<Opportunity[]> {
  const primaryQuery = `
    SELECT Id, Name, AccountId, Account.Name, Amount, StageName,
           Probability, CloseDate, OwnerId,
           DaysInStage__c, IsAtRisk__c,
           MEDDPICC_Overall_Score__c, Command_Overall_Score__c,
           Command_Last_Updated__c,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE OwnerId = '${userId}'
      AND IsClosed = false
      AND (IsAtRisk__c = true
           OR MEDDPICC_Overall_Score__c < 60
           OR Command_Overall_Score__c < 70)
    ORDER BY LastModifiedDate ASC
    LIMIT 10
  `;

  const fallbackQuery = `
    SELECT Id, Name, AccountId, Account.Name, Amount, StageName,
           Probability, CloseDate, OwnerId,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE OwnerId = '${userId}'
      AND IsClosed = false
    ORDER BY LastModifiedDate ASC
    LIMIT 10
  `;

  const opportunities = await safeQuery<Opportunity>(connection, primaryQuery, fallbackQuery);

  return opportunities.map(opp => ({
    ...opp,
    Account: {
      Name: opp.Account?.Name || 'Unknown Account',
    },
  }));
}

/**
 * Get all opportunities owned by current user
 */
export async function getAllOpportunities(
  connection: Connection,
  userId: string
): Promise<Opportunity[]> {
  const primaryQuery = `
    SELECT Id, Name, AccountId, Account.Name, Amount, StageName,
           Probability, CloseDate, OwnerId,
           DaysInStage__c, IsAtRisk__c,
           MEDDPICC_Overall_Score__c,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE OwnerId = '${userId}'
    ORDER BY CloseDate DESC
    LIMIT 200
  `;

  const fallbackQuery = `
    SELECT Id, Name, AccountId, Account.Name, Amount, StageName,
           Probability, CloseDate, OwnerId,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE OwnerId = '${userId}'
    ORDER BY CloseDate DESC
    LIMIT 200
  `;

  const opportunities = await safeQuery<Opportunity>(connection, primaryQuery, fallbackQuery);

  return opportunities.map(opp => ({
    ...opp,
    Account: {
      Name: opp.Account?.Name || 'Unknown Account',
    },
  }));
}

/**
 * Get a single opportunity by ID with full details
 */
export async function getOpportunityById(
  connection: Connection,
  opportunityId: string
): Promise<Opportunity | null> {
  const primaryQuery = `
    SELECT Id, Name, AccountId, Account.Name, Amount, StageName,
           Probability, CloseDate, OwnerId, Owner.Name, Owner.Email,
           NextStep, Description,
           DaysInStage__c, IsAtRisk__c,
           MEDDPICC_Metrics__c, MEDDPICC_Economic_Buyer__c,
           MEDDPICC_Decision_Criteria__c, MEDDPICC_Decision_Process__c,
           MEDDPICC_Paper_Process__c, MEDDPICC_Identify_Pain__c,
           MEDDPICC_Champion__c, MEDDPICC_Competition__c,
           MEDDPICC_Overall_Score__c,
           Command_Why_Do_Anything__c, Command_Why_Now__c,
           Command_Why_Us__c, Command_Why_Trust__c, Command_Why_Pay_That__c,
           Command_Overall_Score__c, Command_Last_Updated__c, Command_Confidence_Level__c,
           Gong_Call_Count__c, Gong_Last_Call_Date__c, Gong_Sentiment__c,
           Gong_Competitor_Mentions__c, Gong_Call_Recording_URL__c,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE Id = '${opportunityId}'
    LIMIT 1
  `;

  const fallbackQuery = `
    SELECT Id, Name, AccountId, Account.Name, Amount, StageName,
           Probability, CloseDate, OwnerId, Owner.Name, Owner.Email,
           NextStep, Description,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE Id = '${opportunityId}'
    LIMIT 1
  `;

  const opportunities = await safeQuery<Opportunity>(connection, primaryQuery, fallbackQuery);

  if (opportunities.length === 0) {
    return null;
  }

  const opp = opportunities[0];

  return {
    ...opp,
    Account: {
      Name: opp.Account?.Name || 'Unknown Account',
      Id: opp.AccountId,
    },
    Owner: {
      Name: opp.Owner?.Name || 'Unknown Owner',
      Email: opp.Owner?.Email,
    },
  };
}

/**
 * Get opportunities for a specific account
 */
export async function getOpportunitiesByAccountId(
  connection: Connection,
  accountId: string
): Promise<Opportunity[]> {
  const primaryQuery = `
    SELECT Id, Name, Amount, StageName, CloseDate,
           IsAtRisk__c, MEDDPICC_Overall_Score__c,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE AccountId = '${accountId}'
    ORDER BY CloseDate DESC
    LIMIT 50
  `;

  const fallbackQuery = `
    SELECT Id, Name, Amount, StageName, CloseDate,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE AccountId = '${accountId}'
    ORDER BY CloseDate DESC
    LIMIT 50
  `;

  const opportunities = await safeQuery<Opportunity>(connection, primaryQuery, fallbackQuery);

  return opportunities.map(opp => ({
    ...opp,
  }));
}

/**
 * Contact interface for Account Plan
 */
export interface Contact {
  Id: string;
  Name?: string;
  FirstName?: string;
  LastName?: string;
  Title?: string;
  Email?: string;
  Phone?: string;
  Department?: string;
  Role__c?: string;
  Executive_Sponsor__c?: boolean;
  Platform_Owner__c?: boolean;
}

/**
 * Account Plan data bundle — fetches account, renewal/expansion opps, and contacts in parallel
 */
export interface AccountPlanData {
  account: Account | null;
  renewalOpps: Opportunity[];
  expansionOpps: Opportunity[];
  contacts: Contact[];
}

export async function getAccountPlanData(
  connection: Connection,
  accountId: string
): Promise<AccountPlanData> {
  // Extended account query with all fields used in the account plan
  const accountQuery = `
    SELECT Id, Name, Industry, OwnerId, Website, AnnualRevenue, NumberOfEmployees, Type,
           BillingCity, BillingState, BillingCountry,
           ParentId, Parent.Name,
           Owner.Name, Owner.Email,
           accountBuyingStage6sense__c, accountIntentScore6sense__c,
           accountProfileFit6sense__c, accountProfileScore6sense__c,
           Clay_Employee_Count__c, Clay_Revenue__c, Clay_Industry__c,
           Clay_Parent_Account__c,
           Total_ARR__c, of_Axonify_Users__c, Customer_Stage__c, Risk__c,
           Agreement_Expiry_Date__c, Launch_Date__c, Last_QBR__c, Last_Exec_Check_In__c,
           Current_Gainsight_Score__c, Customer_Success_Score__c,
           Contract_Total_License_Seats__c, Total_Hierarchy_Seats__c, Logo_Seats__c,
           Total_Active_Users__c, Active_Users_Max__c, Active_Users_Learn__c,
           Active_Users_Comms__c, Active_Users_Tasks__c,
           License_Utilization_Max__c, License_Utilization_Learn__c,
           License_Utilization_Comms__c, License_Utilization_Tasks__c,
           Max_Usage_Trend__c,
           Strategy_Notes__c, Risk_Notes__c, Contract_Notes__c,
           Overall_Customer_Health_Notes__c, Sponsorship_Notes__c, Support_Notes__c,
           CreatedDate, LastModifiedDate
    FROM Account
    WHERE Id = '${accountId}'
    LIMIT 1
  `;

  const accountFallback = `
    SELECT Id, Name, Industry, OwnerId, Website, AnnualRevenue, NumberOfEmployees, Type,
           BillingCity, BillingState, BillingCountry,
           Owner.Name, Owner.Email,
           CreatedDate, LastModifiedDate
    FROM Account
    WHERE Id = '${accountId}'
    LIMIT 1
  `;

  // Renewal opps: Type = 'Renewal', open
  const renewalQuery = `
    SELECT Id, Name, Amount, StageName, CloseDate, Probability, Type, OwnerId,
           Owner.Name, NextStep, Description,
           ARR__c, Duration__c, Total_Contract_Value__c, License_Seats__c,
           COM_Metrics__c, MEDDPICCR_Economic_Buyer__c,
           Economic_Buyer_Name__c, Economic_Buyer_Title__c,
           MEDDPICCR_Decision_Criteria__c, MEDDPICCR_Decision_Process__c,
           MEDDPICCR_Paper_Process__c, MEDDPICCR_Implicate_Pain__c,
           MEDDPICCR_Champion__c, MEDDPICCR_Competition__c, MEDDPICCR_Risks__c,
           Risk__c, Milestone__c, Use_Cases__c, Business_Objectives__c,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE AccountId = '${accountId}'
      AND Type = 'Renewal'
      AND IsClosed = false
    ORDER BY CloseDate ASC
    LIMIT 10
  `;

  const renewalFallback = `
    SELECT Id, Name, Amount, StageName, CloseDate, Probability, Type, OwnerId,
           Owner.Name, NextStep, Description,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE AccountId = '${accountId}'
      AND IsClosed = false
    ORDER BY CloseDate ASC
    LIMIT 10
  `;

  // Expansion opps: Type includes 'Expansion'
  const expansionQuery = `
    SELECT Id, Name, Amount, StageName, CloseDate, Probability, Type, OwnerId,
           Owner.Name, NextStep, Description,
           ARR__c, Duration__c, Total_Contract_Value__c, License_Seats__c,
           Use_Cases__c, Business_Objectives__c,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE AccountId = '${accountId}'
      AND (Type = 'Customer Expansion' OR Type = 'Renewal + Expansion')
      AND IsClosed = false
    ORDER BY CloseDate ASC
    LIMIT 5
  `;

  const expansionFallback = `
    SELECT Id, Name, Amount, StageName, CloseDate, Probability, Type, OwnerId,
           Owner.Name, NextStep, Description,
           CreatedDate, LastModifiedDate
    FROM Opportunity
    WHERE AccountId = '${accountId}'
      AND IsClosed = false
    ORDER BY Amount DESC
    LIMIT 5
  `;

  // Contacts for the account
  const contactsQuery = `
    SELECT Id, Name, FirstName, LastName, Title, Email, Phone, Department
    FROM Contact
    WHERE AccountId = '${accountId}'
    ORDER BY LastModifiedDate DESC
    LIMIT 50
  `;

  // Execute all queries in parallel
  const [accountRecords, renewalOpps, expansionOpps, contacts] = await Promise.all([
    safeQuery<Account>(connection, accountQuery, accountFallback),
    safeQuery<Opportunity>(connection, renewalQuery, renewalFallback),
    safeQuery<Opportunity>(connection, expansionQuery, expansionFallback),
    safeQuery<Contact>(connection, contactsQuery),
  ]);

  const account = accountRecords.length > 0 ? accountRecords[0] : null;

  return {
    account,
    renewalOpps,
    expansionOpps,
    contacts,
  };
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(
  connection: Connection,
  userId: string
): Promise<DashboardStats> {
  try {
    // Get account counts using standard queries
    const accountsQuery = `
      SELECT Id
      FROM Account
      WHERE OwnerId = '${userId}'
    `;

    // Get recently modified accounts as "high priority"
    const highPriorityAccountQuery = `
      SELECT Id
      FROM Account
      WHERE OwnerId = '${userId}'
        AND LastModifiedDate = LAST_N_DAYS:30
    `;

    // Get opportunity counts and values
    const opportunitiesQuery = `
      SELECT Id, Amount
      FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsClosed = false
    `;

    // Get stale opportunities (more than 14 days without activity)
    const atRiskOppQuery = `
      SELECT Id
      FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsClosed = false
        AND LastModifiedDate < LAST_N_DAYS:14
    `;

    const [accountsResult, highPriorityResult, oppsResult, atRiskResult] = await Promise.all([
      connection.query(accountsQuery),
      connection.query(highPriorityAccountQuery),
      connection.query(opportunitiesQuery),
      connection.query(atRiskOppQuery),
    ]);

    const totalAccounts = (accountsResult.records || []).length;
    const highPriority = (highPriorityResult.records || []).length;
    const opportunities = oppsResult.records || [];
    const atRisk = (atRiskResult.records || []).length;

    // Calculate total value and average deal size
    const totalValue = opportunities.reduce((sum: number, opp: any) => {
      return sum + (opp.Amount || 0);
    }, 0);

    return {
      accounts: {
        total: totalAccounts,
        highPriority,
      },
      opportunities: {
        total: opportunities.length,
        atRisk,
        totalValue,
        avgDealSize: opportunities.length > 0 ? Math.round(totalValue / opportunities.length) : 0,
      },
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return default stats on error
    return {
      accounts: {
        total: 0,
        highPriority: 0,
      },
      opportunities: {
        total: 0,
        atRisk: 0,
        totalValue: 0,
        avgDealSize: 0,
      },
    };
  }
}
