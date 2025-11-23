/**
 * Mock Data Service
 *
 * Provides realistic Salesforce-like data for development and testing
 * when actual Salesforce OAuth connection is not available.
 */

// Type definitions for our Salesforce schema
export interface MockAccount {
  Id: string;
  Name: string;
  Industry: string;
  AnnualRevenue: number;
  NumberOfEmployees: number;
  Website: string;
  BillingCity: string;
  BillingState: string;
  BillingCountry: string;
  OwnerId: string;
  Owner: {
    Name: string;
    Email: string;
  };
  CreatedDate: string;
  LastModifiedDate: string;

  // Clay enrichment fields
  Clay_Employee_Count__c: number;
  Clay_Employee_Growth_Pct__c: number;
  Clay_Current_LMS__c: string;
  Clay_HRIS_System__c: string;
  Clay_Active_Signals__c: string;
  Clay_Last_Funding_Round__c?: string;
  Clay_Last_Funding_Amount__c?: number;
  Clay_Technologies__c: string;

  // 6sense fields
  SixSense_Buying_Stage__c: string;
  SixSense_Intent_Score__c: number;
  SixSense_Profile_Fit_Score__c: number;
  SixSense_Engaged_Campaigns__c: string;

  // Calculated priority fields
  Priority_Score__c: number;
  Priority_Tier__c: string;
  Last_Activity_Date__c: string;
}

export interface MockOpportunity {
  Id: string;
  Name: string;
  AccountId: string;
  Account: {
    Name: string;
  };
  StageName: string;
  Amount: number;
  Probability: number;
  CloseDate: string;
  OwnerId: string;
  Owner: {
    Name: string;
    Email: string;
  };
  CreatedDate: string;
  LastModifiedDate: string;
  DaysInStage__c: number;
  IsAtRisk__c: boolean;

  // MEDDPICC fields
  MEDDPICC_Metrics__c: number;
  MEDDPICC_Economic_Buyer__c: number;
  MEDDPICC_Decision_Criteria__c: number;
  MEDDPICC_Decision_Process__c: number;
  MEDDPICC_Paper_Process__c: number;
  MEDDPICC_Identify_Pain__c: number;
  MEDDPICC_Champion__c: number;
  MEDDPICC_Competition__c: number;
  MEDDPICC_Overall_Score__c: number;

  NextStep: string;
  Description: string;
}

export interface MockUser {
  Id: string;
  Name: string;
  Email: string;
  Title: string;
  Department: string;
  CompanyName: string;
  Username: string;
}

export interface MockActivity {
  Id: string;
  Type: string;
  Subject: string;
  WhoId?: string;
  WhatId?: string;
  AccountId?: string;
  OpportunityId?: string;
  CreatedDate: string;
  Description: string;
  Owner: {
    Name: string;
  };
}

// Mock User Data
export const mockUser: MockUser = {
  Id: 'user001',
  Name: 'Susan Bamberger',
  Email: 'susan@example.com',
  Title: 'Sales Director',
  Department: 'Sales',
  CompanyName: 'Your Company',
  Username: 'susan@example.com',
};

// Mock Accounts Data
export const mockAccounts: MockAccount[] = [
  {
    Id: 'acc001',
    Name: 'RetailCo',
    Industry: 'Retail',
    AnnualRevenue: 45000000,
    NumberOfEmployees: 592,
    Website: 'https://www.retailco.example.com',
    BillingCity: 'San Francisco',
    BillingState: 'CA',
    BillingCountry: 'USA',
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2023-06-15T10:30:00Z',
    LastModifiedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),

    Clay_Employee_Count__c: 592,
    Clay_Employee_Growth_Pct__c: 22,
    Clay_Current_LMS__c: 'Cornerstone',
    Clay_HRIS_System__c: 'Workday',
    Clay_Active_Signals__c: 'New VP of Learning hired 8 days ago\nHigh job posting activity for L&D roles\nWebsite engagement increased 45%\nRecent expansion into 3 new regions',
    Clay_Last_Funding_Round__c: 'Series C',
    Clay_Last_Funding_Amount__c: 28000000,
    Clay_Technologies__c: 'Salesforce, Workday, Slack, Zoom, Microsoft 365',

    SixSense_Buying_Stage__c: 'Decision',
    SixSense_Intent_Score__c: 89,
    SixSense_Profile_Fit_Score__c: 94,
    SixSense_Engaged_Campaigns__c: 'L&D Transformation Webinar, ROI Calculator, Demo Videos',

    Priority_Score__c: 92,
    Priority_Tier__c: '🔥 Hot',
    Last_Activity_Date__c: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    Id: 'acc002',
    Name: 'ManufacturingCo',
    Industry: 'Manufacturing',
    AnnualRevenue: 120000000,
    NumberOfEmployees: 1450,
    Website: 'https://www.mfgco.example.com',
    BillingCity: 'Chicago',
    BillingState: 'IL',
    BillingCountry: 'USA',
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2023-08-22T14:15:00Z',
    LastModifiedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),

    Clay_Employee_Count__c: 1450,
    Clay_Employee_Growth_Pct__c: 12,
    Clay_Current_LMS__c: 'SAP SuccessFactors',
    Clay_HRIS_System__c: 'ADP',
    Clay_Active_Signals__c: 'Posted 15 new training coordinator roles\nAttended industry L&D conference\nDownloaded compliance training whitepaper',
    Clay_Last_Funding_Round__c: 'Private Equity',
    Clay_Last_Funding_Amount__c: 85000000,
    Clay_Technologies__c: 'SAP, Oracle, Microsoft Teams, Tableau',

    SixSense_Buying_Stage__c: 'Consideration',
    SixSense_Intent_Score__c: 72,
    SixSense_Profile_Fit_Score__c: 88,
    SixSense_Engaged_Campaigns__c: 'Manufacturing Training Guide, Compliance Webinar',

    Priority_Score__c: 78,
    Priority_Tier__c: '🔶 Warm',
    Last_Activity_Date__c: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    Id: 'acc003',
    Name: 'TechStartup Inc',
    Industry: 'Technology',
    AnnualRevenue: 8500000,
    NumberOfEmployees: 145,
    Website: 'https://www.techstartup.example.com',
    BillingCity: 'Austin',
    BillingState: 'TX',
    BillingCountry: 'USA',
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2024-01-10T09:00:00Z',
    LastModifiedDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),

    Clay_Employee_Count__c: 145,
    Clay_Employee_Growth_Pct__c: 45,
    Clay_Current_LMS__c: 'None',
    Clay_HRIS_System__c: 'BambooHR',
    Clay_Active_Signals__c: 'Rapid hiring in engineering\nNew office expansion\nRecent product launch',
    Clay_Last_Funding_Round__c: 'Series A',
    Clay_Last_Funding_Amount__c: 12000000,
    Clay_Technologies__c: 'Google Workspace, Slack, Zoom, Notion, GitHub',

    SixSense_Buying_Stage__c: 'Awareness',
    SixSense_Intent_Score__c: 52,
    SixSense_Profile_Fit_Score__c: 71,
    SixSense_Engaged_Campaigns__c: 'Startup Growth Webinar',

    Priority_Score__c: 58,
    Priority_Tier__c: '🔵 Cool',
    Last_Activity_Date__c: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    Id: 'acc004',
    Name: 'HealthCare Systems',
    Industry: 'Healthcare',
    AnnualRevenue: 250000000,
    NumberOfEmployees: 3200,
    Website: 'https://www.healthcaresys.example.com',
    BillingCity: 'Boston',
    BillingState: 'MA',
    BillingCountry: 'USA',
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2023-05-20T11:45:00Z',
    LastModifiedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),

    Clay_Employee_Count__c: 3200,
    Clay_Employee_Growth_Pct__c: 8,
    Clay_Current_LMS__c: 'HealthStream',
    Clay_HRIS_System__c: 'UKG',
    Clay_Active_Signals__c: 'New Chief Learning Officer appointed\nMandatory compliance training initiative\nDigital transformation project announced',
    Clay_Technologies__c: 'Epic, Microsoft 365, Zoom for Healthcare, SharePoint',

    SixSense_Buying_Stage__c: 'Decision',
    SixSense_Intent_Score__c: 85,
    SixSense_Profile_Fit_Score__c: 92,
    SixSense_Engaged_Campaigns__c: 'Healthcare Compliance Guide, HIPAA Training Webinar, ROI Study',

    Priority_Score__c: 87,
    Priority_Tier__c: '🔥 Hot',
    Last_Activity_Date__c: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    Id: 'acc005',
    Name: 'Financial Services Group',
    Industry: 'Financial Services',
    AnnualRevenue: 180000000,
    NumberOfEmployees: 890,
    Website: 'https://www.finservices.example.com',
    BillingCity: 'New York',
    BillingState: 'NY',
    BillingCountry: 'USA',
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2023-09-12T13:20:00Z',
    LastModifiedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),

    Clay_Employee_Count__c: 890,
    Clay_Employee_Growth_Pct__c: 6,
    Clay_Current_LMS__c: 'Docebo',
    Clay_HRIS_System__c: 'Workday',
    Clay_Active_Signals__c: 'Evaluating new learning platforms\nRegulatory compliance deadline approaching',
    Clay_Technologies__c: 'Salesforce Financial Services Cloud, Bloomberg, Microsoft 365',

    SixSense_Buying_Stage__c: 'Consideration',
    SixSense_Intent_Score__c: 68,
    SixSense_Profile_Fit_Score__c: 82,
    SixSense_Engaged_Campaigns__c: 'Financial Services Compliance, Security Webinar',

    Priority_Score__c: 74,
    Priority_Tier__c: '🔶 Warm',
    Last_Activity_Date__c: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    Id: 'acc006',
    Name: 'Global Logistics Corp',
    Industry: 'Transportation & Logistics',
    AnnualRevenue: 95000000,
    NumberOfEmployees: 2100,
    Website: 'https://www.globallogistics.example.com',
    BillingCity: 'Atlanta',
    BillingState: 'GA',
    BillingCountry: 'USA',
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2024-02-05T08:30:00Z',
    LastModifiedDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),

    Clay_Employee_Count__c: 2100,
    Clay_Employee_Growth_Pct__c: 18,
    Clay_Current_LMS__c: 'TalentLMS',
    Clay_HRIS_System__c: 'Paylocity',
    Clay_Active_Signals__c: 'International expansion announced\nDriver training program modernization',
    Clay_Technologies__c: 'Oracle Transportation, Microsoft Teams, PowerBI',

    SixSense_Buying_Stage__c: 'Awareness',
    SixSense_Intent_Score__c: 45,
    SixSense_Profile_Fit_Score__c: 65,
    SixSense_Engaged_Campaigns__c: 'Operations Training Guide',

    Priority_Score__c: 51,
    Priority_Tier__c: '🔵 Cool',
    Last_Activity_Date__c: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Mock Opportunities Data
export const mockOpportunities: MockOpportunity[] = [
  {
    Id: 'opp001',
    Name: 'RetailCo - Enterprise LMS Implementation',
    AccountId: 'acc001',
    Account: {
      Name: 'RetailCo',
    },
    StageName: 'Value Confirmation',
    Amount: 285000,
    Probability: 70,
    CloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2024-10-15T09:00:00Z',
    LastModifiedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    DaysInStage__c: 12,
    IsAtRisk__c: false,

    MEDDPICC_Metrics__c: 85,
    MEDDPICC_Economic_Buyer__c: 90,
    MEDDPICC_Decision_Criteria__c: 80,
    MEDDPICC_Decision_Process__c: 75,
    MEDDPICC_Paper_Process__c: 70,
    MEDDPICC_Identify_Pain__c: 95,
    MEDDPICC_Champion__c: 88,
    MEDDPICC_Competition__c: 75,
    MEDDPICC_Overall_Score__c: 82,

    NextStep: 'Executive demo scheduled for next week with VP of Learning',
    Description: 'Enterprise-wide LMS implementation for 592 employees with focus on retail operations training and compliance',
  },
  {
    Id: 'opp002',
    Name: 'HealthCare Systems - Compliance Training Platform',
    AccountId: 'acc004',
    Account: {
      Name: 'HealthCare Systems',
    },
    StageName: 'Negotiation',
    Amount: 520000,
    Probability: 85,
    CloseDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2024-09-08T10:30:00Z',
    LastModifiedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    DaysInStage__c: 8,
    IsAtRisk__c: false,

    MEDDPICC_Metrics__c: 92,
    MEDDPICC_Economic_Buyer__c: 95,
    MEDDPICC_Decision_Criteria__c: 90,
    MEDDPICC_Decision_Process__c: 88,
    MEDDPICC_Paper_Process__c: 85,
    MEDDPICC_Identify_Pain__c: 98,
    MEDDPICC_Champion__c: 92,
    MEDDPICC_Competition__c: 80,
    MEDDPICC_Overall_Score__c: 90,

    NextStep: 'Review final contract with legal team',
    Description: 'HIPAA-compliant training platform for 3,200 healthcare workers with annual compliance tracking',
  },
  {
    Id: 'opp003',
    Name: 'ManufacturingCo - Safety Training System',
    AccountId: 'acc002',
    Account: {
      Name: 'ManufacturingCo',
    },
    StageName: 'Discovery',
    Amount: 380000,
    Probability: 40,
    CloseDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2024-11-01T14:15:00Z',
    LastModifiedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    DaysInStage__c: 18,
    IsAtRisk__c: true,

    MEDDPICC_Metrics__c: 60,
    MEDDPICC_Economic_Buyer__c: 55,
    MEDDPICC_Decision_Criteria__c: 70,
    MEDDPICC_Decision_Process__c: 50,
    MEDDPICC_Paper_Process__c: 45,
    MEDDPICC_Identify_Pain__c: 75,
    MEDDPICC_Champion__c: 60,
    MEDDPICC_Competition__c: 55,
    MEDDPICC_Overall_Score__c: 59,

    NextStep: 'Schedule meeting with Operations Director to discuss safety compliance requirements',
    Description: 'Manufacturing safety and compliance training platform for 1,450 workers across 5 facilities',
  },
  {
    Id: 'opp004',
    Name: 'Financial Services Group - Sales Enablement',
    AccountId: 'acc005',
    Account: {
      Name: 'Financial Services Group',
    },
    StageName: 'Value Confirmation',
    Amount: 195000,
    Probability: 60,
    CloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2024-10-20T11:00:00Z',
    LastModifiedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    DaysInStage__c: 22,
    IsAtRisk__c: true,

    MEDDPICC_Metrics__c: 70,
    MEDDPICC_Economic_Buyer__c: 65,
    MEDDPICC_Decision_Criteria__c: 75,
    MEDDPICC_Decision_Process__c: 60,
    MEDDPICC_Paper_Process__c: 55,
    MEDDPICC_Identify_Pain__c: 80,
    MEDDPICC_Champion__c: 68,
    MEDDPICC_Competition__c: 70,
    MEDDPICC_Overall_Score__c: 68,

    NextStep: 'Follow up on ROI analysis - no response in 5 days',
    Description: 'Sales training and financial compliance platform for advisory team of 890 employees',
  },
  {
    Id: 'opp005',
    Name: 'TechStartup Inc - Onboarding & Skills Development',
    AccountId: 'acc003',
    Account: {
      Name: 'TechStartup Inc',
    },
    StageName: 'Discovery',
    Amount: 65000,
    Probability: 30,
    CloseDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2024-11-05T09:30:00Z',
    LastModifiedDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    DaysInStage__c: 14,
    IsAtRisk__c: false,

    MEDDPICC_Metrics__c: 50,
    MEDDPICC_Economic_Buyer__c: 45,
    MEDDPICC_Decision_Criteria__c: 60,
    MEDDPICC_Decision_Process__c: 40,
    MEDDPICC_Paper_Process__c: 35,
    MEDDPICC_Identify_Pain__c: 65,
    MEDDPICC_Champion__c: 55,
    MEDDPICC_Competition__c: 50,
    MEDDPICC_Overall_Score__c: 50,

    NextStep: 'Send onboarding demo video and case studies',
    Description: 'Rapid onboarding solution for fast-growing startup - 145 employees with 45% growth rate',
  },
  {
    Id: 'opp006',
    Name: 'Global Logistics Corp - Driver Training Program',
    AccountId: 'acc006',
    Account: {
      Name: 'Global Logistics Corp',
    },
    StageName: 'Discovery',
    Amount: 420000,
    Probability: 20,
    CloseDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    OwnerId: 'user001',
    Owner: {
      Name: 'Susan Bamberger',
      Email: 'susan@example.com',
    },
    CreatedDate: '2024-10-01T15:00:00Z',
    LastModifiedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    DaysInStage__c: 35,
    IsAtRisk__c: true,

    MEDDPICC_Metrics__c: 40,
    MEDDPICC_Economic_Buyer__c: 35,
    MEDDPICC_Decision_Criteria__c: 50,
    MEDDPICC_Decision_Process__c: 30,
    MEDDPICC_Paper_Process__c: 25,
    MEDDPICC_Identify_Pain__c: 55,
    MEDDPICC_Champion__c: 40,
    MEDDPICC_Competition__c: 45,
    MEDDPICC_Overall_Score__c: 40,

    NextStep: 'Re-engage - champion left company, need new contact',
    Description: 'Mobile-first driver training and certification platform for 2,100 logistics employees',
  },
];

// Mock Activities Data
export const mockActivities: MockActivity[] = [
  {
    Id: 'act001',
    Type: 'Meeting',
    Subject: 'Executive Demo - RetailCo',
    AccountId: 'acc001',
    OpportunityId: 'opp001',
    CreatedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    Description: 'Presented platform demo to VP of Learning and HR Director. Great engagement, requested ROI analysis.',
    Owner: {
      Name: 'Susan Bamberger',
    },
  },
  {
    Id: 'act002',
    Type: 'Email',
    Subject: 'Contract Review Follow-up - HealthCare Systems',
    AccountId: 'acc004',
    OpportunityId: 'opp002',
    CreatedDate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    Description: 'Sent follow-up on contract terms. Legal team reviewing compliance clauses.',
    Owner: {
      Name: 'Susan Bamberger',
    },
  },
  {
    Id: 'act003',
    Type: 'Phone Call',
    Subject: 'Discovery Call - ManufacturingCo',
    AccountId: 'acc002',
    OpportunityId: 'opp003',
    CreatedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    Description: 'Discussed safety training needs. Need to connect with Operations Director for technical requirements.',
    Owner: {
      Name: 'Susan Bamberger',
    },
  },
  {
    Id: 'act004',
    Type: 'Meeting',
    Subject: 'Quarterly Business Review - RetailCo',
    AccountId: 'acc001',
    CreatedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    Description: 'Discussed expansion opportunities and upcoming training initiatives for new store openings.',
    Owner: {
      Name: 'Susan Bamberger',
    },
  },
  {
    Id: 'act005',
    Type: 'Email',
    Subject: 'ROI Analysis Sent - Financial Services Group',
    AccountId: 'acc005',
    OpportunityId: 'opp004',
    CreatedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    Description: 'Sent detailed ROI analysis. Waiting for feedback - no response yet.',
    Owner: {
      Name: 'Susan Bamberger',
    },
  },
];

// Helper functions
export function getAccountById(id: string): MockAccount | undefined {
  return mockAccounts.find(acc => acc.Id === id);
}

export function getOpportunitiesByAccountId(accountId: string): MockOpportunity[] {
  return mockOpportunities.filter(opp => opp.AccountId === accountId);
}

export function getActivitiesByAccountId(accountId: string): MockActivity[] {
  return mockActivities.filter(act => act.AccountId === accountId);
}

export function getActivitiesByOpportunityId(opportunityId: string): MockActivity[] {
  return mockActivities.filter(act => act.OpportunityId === opportunityId);
}

export function getHighPriorityAccounts(): MockAccount[] {
  return mockAccounts.filter(acc => acc.Priority_Score__c >= 85).sort((a, b) => b.Priority_Score__c - a.Priority_Score__c);
}

export function getAtRiskOpportunities(): MockOpportunity[] {
  return mockOpportunities.filter(opp => opp.IsAtRisk__c);
}

export function getRecentActivities(limit: number = 10): MockActivity[] {
  return [...mockActivities]
    .sort((a, b) => new Date(b.CreatedDate).getTime() - new Date(a.CreatedDate).getTime())
    .slice(0, limit);
}

export default {
  mockUser,
  mockAccounts,
  mockOpportunities,
  mockActivities,
  getAccountById,
  getOpportunitiesByAccountId,
  getActivitiesByAccountId,
  getActivitiesByOpportunityId,
  getHighPriorityAccounts,
  getAtRiskOpportunities,
  getRecentActivities,
};
