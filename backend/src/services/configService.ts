/**
 * Configuration Service
 *
 * Manages application configuration including risk rules, priority scoring,
 * field mappings, and other admin settings.
 *
 * For now, configuration is stored in memory with default values.
 * Future: Store in Salesforce Custom Settings or database
 */

import { ScopeDefaults } from '../types/filters';
import type { Product } from '../canonical/types';

export interface RiskRule {
  id: string;
  name: string;
  objectType: 'Account' | 'Opportunity';
  conditions: Array<{
    field: string;
    operator: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'IN' | 'NOT IN' | 'contains';
    value: any;
  }>;
  logic: 'AND' | 'OR';
  flag: 'at-risk' | 'critical' | 'warning';
  active: boolean;
  createdBy?: string;
  createdDate?: string;
}

export interface PriorityComponent {
  id: string;
  name: string;
  weight: number; // Percentage (0-100)
  field?: string; // Salesforce field name
  scoreRanges?: Array<{
    min: number;
    max: number;
    score: number;
  }>;
}

export interface TierThresholds {
  hot: { min: number; max: number };
  warm: { min: number; max: number };
  cool: { min: number; max: number };
  cold: { min: number; max: number };
}

export interface RoleConfig {
  componentWeights: Record<string, number>; // component.id -> weight override
  thresholds: TierThresholds;
}

export interface PriorityConfig {
  components: PriorityComponent[];
  thresholds: TierThresholds;
  roleConfigs?: Record<string, RoleConfig>; // 'ae' | 'am' | 'csm' -> role-specific config
}

export interface FieldMapping {
  /** Unique stable identifier for this concept across the app. */
  conceptName: string;
  /** Grouping for the admin UI: 'account', 'opportunity', 'health', 'clay', '6sense', 'gong', 'meddpicc', 'command', 'quota'. */
  category: string;
  /** Salesforce field API name for this concept, or null if the value is computed. */
  salesforceField: string | null;
  /** If true, the value is computed by the app rather than read from a source field. */
  calculateInApp: boolean;
}

/**
 * Per-product field mappings — for the canonical `arrByProduct[]`,
 * `whitespaceByProduct[]`, etc. Each product has its own SF fields that
 * hold the ARR/whitespace/active-user data for that product.
 */
export interface ProductFieldMapping {
  /** Stable product id from AppConfig.products. */
  productId: string;
  /** SF field on Account holding ARR for this product. */
  accountArrField?: string;
  /** SF field on Account holding unrealized expansion potential for this product. */
  accountWhitespaceField?: string;
  /** SF field on Opportunity holding amount for this product. */
  opportunityAmountField?: string;
}

export interface AppConfig {
  riskRules: RiskRule[];
  priorityScoring: PriorityConfig;
  fieldMappings: FieldMapping[];
  /** Tenant-defined product catalog. Replaces hardcoded SKU references
   *  (Learn/Comms/Tasks/Max). Empty by default — admins add products that
   *  match their company's product lines. */
  products: Product[];
  /** Per-product field mappings — one entry per product in `products`. */
  productFieldMappings: ProductFieldMapping[];
  opportunityStages?: string[]; // Sales stages to include in filters and queries
  roleMapping: Array<{
    salesforceProfile: string;
    appRole: 'ae' | 'am' | 'csm' | 'admin' | 'executive' | 'sales-leader';
  }>;
  userRoleOverrides: Array<{
    userName: string;
    appRole: 'ae' | 'am' | 'csm' | 'admin' | 'executive' | 'sales-leader';
  }>;
  displaySettings: {
    accountsPerPage: number;
    dealsPerPage: number;
    defaultSort: string;
    viewMode: 'table' | 'cards';
  };
  scopeDefaults: ScopeDefaults;
  lastModified?: {
    by: string;
    date: string;
  };
}

// Default configuration
const defaultConfig: AppConfig = {
  riskRules: [
    {
      id: 'rule_low_health',
      name: 'Low Health Score',
      objectType: 'Account',
      conditions: [
        { field: 'Current_Gainsight_Score__c', operator: '<', value: 60 },
      ],
      logic: 'AND',
      flag: 'at-risk',
      active: true,
    },
    {
      id: 'rule_stuck_deal',
      name: 'Stuck in Stage',
      objectType: 'Opportunity',
      conditions: [
        { field: 'LastModifiedDate', operator: '>', value: 14 }, // days
        { field: 'MEDDPICC_Overall_Score__c', operator: '<', value: 60 },
      ],
      logic: 'AND',
      flag: 'at-risk',
      active: true,
    },
    {
      id: 'rule_critical_deal',
      name: 'Critical Deal Risk',
      objectType: 'Opportunity',
      conditions: [
        { field: 'LastModifiedDate', operator: '>', value: 30 }, // days
      ],
      logic: 'OR',
      flag: 'critical',
      active: true,
    },
  ],
  priorityScoring: {
    components: [
      {
        id: 'comp_intent',
        name: 'Intent Score',
        weight: 40,
        field: 'accountIntentScore6sense__c',
      },
      {
        id: 'comp_employee_count',
        name: 'Employee Count',
        weight: 30,
        scoreRanges: [
          { min: 200, max: 2000, score: 100 },
          { min: 100, max: 200, score: 75 },
          { min: 50, max: 100, score: 50 },
          { min: 2000, max: 999999, score: 60 },
        ],
      },
      {
        id: 'comp_signal_recency',
        name: 'Signal Recency',
        weight: 30,
        scoreRanges: [
          { min: 0, max: 7, score: 100 },
          { min: 7, max: 14, score: 75 },
          { min: 14, max: 30, score: 50 },
          { min: 30, max: 9999, score: 25 },
        ],
      },
    ],
    thresholds: {
      hot: { min: 85, max: 100 },
      warm: { min: 65, max: 84 },
      cool: { min: 40, max: 64 },
      cold: { min: 0, max: 39 },
    },
  },
  fieldMappings: [
    // Clay Enrichment
    { conceptName: 'Employee Count', category: 'clay', salesforceField: 'Clay_Employee_Count__c', calculateInApp: false },
    { conceptName: 'Employee Growth', category: 'clay', salesforceField: 'Clay_Employee_Growth_Pct__c', calculateInApp: false },
    { conceptName: 'Current LMS', category: 'clay', salesforceField: 'LMS_System_s__c', calculateInApp: false },
    { conceptName: 'Active Signals', category: 'clay', salesforceField: 'Clay_Active_Signals__c', calculateInApp: false },

    // 6sense Data
    { conceptName: 'Buying Stage', category: '6sense', salesforceField: 'accountBuyingStage6sense__c', calculateInApp: false },
    { conceptName: 'Intent Score', category: '6sense', salesforceField: 'accountIntentScore6sense__c', calculateInApp: false },

    // Health & Status
    { conceptName: 'Health Score', category: 'health', salesforceField: 'Current_Gainsight_Score__c', calculateInApp: false },
    { conceptName: 'Renewal Date', category: 'health', salesforceField: 'Agreement_Expiry_Date__c', calculateInApp: false },

    // Command of the Message
    { conceptName: 'Before Scenario', category: 'command', salesforceField: 'COM_Before_Scenario__c', calculateInApp: false },
    { conceptName: 'After Scenario', category: 'command', salesforceField: 'COM_After_Scenario__c', calculateInApp: false },
    { conceptName: 'Required Capabilities', category: 'command', salesforceField: 'COM_Required_Capabilities__c', calculateInApp: false },
    { conceptName: 'Metrics', category: 'command', salesforceField: 'COM_Metrics__c', calculateInApp: false },

    // MEDDPICC
    { conceptName: 'Economic Buyer', category: 'meddpicc', salesforceField: 'MEDDPICCR_Economic_Buyer__c', calculateInApp: false },
    { conceptName: 'Decision Criteria', category: 'meddpicc', salesforceField: 'MEDDPICCR_Decision_Criteria__c', calculateInApp: false },
    { conceptName: 'Decision Process', category: 'meddpicc', salesforceField: 'MEDDPICCR_Decision_Process__c', calculateInApp: false },
    { conceptName: 'Paper Process', category: 'meddpicc', salesforceField: 'MEDDPICCR_Paper_Process__c', calculateInApp: false },
    { conceptName: 'Identified Pain', category: 'meddpicc', salesforceField: 'MEDDPICCR_Implicate_Pain__c', calculateInApp: false },
    { conceptName: 'Champion', category: 'meddpicc', salesforceField: 'MEDDPICCR_Champion__c', calculateInApp: false },
    { conceptName: 'Competition', category: 'meddpicc', salesforceField: 'MEDDPICCR_Competition__c', calculateInApp: false },
    { conceptName: 'MEDDPICC Score', category: 'meddpicc', salesforceField: null, calculateInApp: true },

    // User Quota & Territory
    { conceptName: 'Annual Quota', category: 'quota', salesforceField: 'Annual_Quota__c', calculateInApp: false },
    { conceptName: 'Quarterly Quota', category: 'quota', salesforceField: 'Quarterly_Quota__c', calculateInApp: false },
    { conceptName: 'Monthly Quota', category: 'quota', salesforceField: 'Monthly_Quota__c', calculateInApp: false },

    // ──── Canonical concept mappings (Phase 1) ──────────────────────
    // These cover the full canonical Account/Opportunity/AccountHealth
    // model. salesforceField defaults reflect the fields FormationIQ
    // historically used; each tenant can override via the admin UI.

    // Account — identity & ownership
    { conceptName: 'Industry', category: 'account', salesforceField: 'Industry', calculateInApp: false },
    { conceptName: 'Account Type', category: 'account', salesforceField: 'Type', calculateInApp: false },
    { conceptName: 'Region', category: 'account', salesforceField: null, calculateInApp: false },
    { conceptName: 'Number of Employees', category: 'account', salesforceField: 'NumberOfEmployees', calculateInApp: false },
    { conceptName: 'Annual Revenue', category: 'account', salesforceField: 'AnnualRevenue', calculateInApp: false },
    { conceptName: 'Account Owner Id', category: 'account', salesforceField: 'OwnerId', calculateInApp: false },
    { conceptName: 'Account Owner Name', category: 'account', salesforceField: null, calculateInApp: false },

    // Account — contract & ARR
    { conceptName: 'Customer Stage', category: 'account', salesforceField: 'Customer_Stage__c', calculateInApp: false },
    { conceptName: 'Contract Start Date', category: 'account', salesforceField: 'Launch_Date__c', calculateInApp: false },
    { conceptName: 'Contract End Date', category: 'account', salesforceField: 'Agreement_Expiry_Date__c', calculateInApp: false },
    { conceptName: 'Total ARR', category: 'account', salesforceField: 'Total_ARR__c', calculateInApp: false },
    { conceptName: 'Total Whitespace', category: 'account', salesforceField: null, calculateInApp: true },

    // Account — health & risk
    { conceptName: 'Account Risk Flag', category: 'health', salesforceField: 'Risk__c', calculateInApp: false },
    { conceptName: 'CSM Sentiment', category: 'health', salesforceField: null, calculateInApp: false },
    { conceptName: 'Last QBR Date', category: 'health', salesforceField: 'Last_QBR__c', calculateInApp: false },
    { conceptName: 'Last Exec Check-In', category: 'health', salesforceField: 'Last_Exec_Check_In__c', calculateInApp: false },
    { conceptName: 'Total Licensed Seats', category: 'health', salesforceField: 'Contract_Total_License_Seats__c', calculateInApp: false },
    { conceptName: 'Active User Count', category: 'health', salesforceField: 'Total_Active_Users__c', calculateInApp: false },

    // Account — notes
    { conceptName: 'Strategy Notes', category: 'account', salesforceField: 'Strategy_Notes__c', calculateInApp: false },
    { conceptName: 'Risk Notes', category: 'account', salesforceField: 'Risk_Notes__c', calculateInApp: false },
    { conceptName: 'Contract Notes', category: 'account', salesforceField: 'Contract_Notes__c', calculateInApp: false },
    { conceptName: 'Health Notes', category: 'account', salesforceField: 'Overall_Customer_Health_Notes__c', calculateInApp: false },
    { conceptName: 'Sponsorship Notes', category: 'account', salesforceField: 'Sponsorship_Notes__c', calculateInApp: false },
    { conceptName: 'Support Notes', category: 'account', salesforceField: 'Support_Notes__c', calculateInApp: false },

    // Account — 6sense extended
    { conceptName: 'Previous Buying Stage', category: '6sense', salesforceField: 'Previous_6sense_Account_Buying_Stage__c', calculateInApp: false },
    { conceptName: 'Profile Fit', category: '6sense', salesforceField: 'accountProfileFit6sense__c', calculateInApp: false },
    { conceptName: 'Profile Score', category: '6sense', salesforceField: 'accountProfileScore6sense__c', calculateInApp: false },
    { conceptName: 'Reach Score', category: '6sense', salesforceField: 'accountReachScore6sense__c', calculateInApp: false },
    { conceptName: 'Segments', category: '6sense', salesforceField: 'X6Sense_Segments__c', calculateInApp: false },
    { conceptName: '6sense Last Updated', category: '6sense', salesforceField: 'accountUpdateDate6sense__c', calculateInApp: false },

    // Account — Clay extended
    { conceptName: 'Clay Revenue', category: 'clay', salesforceField: 'Clay_Revenue__c', calculateInApp: false },
    { conceptName: 'Clay Industry', category: 'clay', salesforceField: 'Clay_Industry__c', calculateInApp: false },
    { conceptName: 'Clay Total Locations', category: 'clay', salesforceField: 'Clay_Total_Locations__c', calculateInApp: false },
    { conceptName: 'Clay City', category: 'clay', salesforceField: 'Clay_City__c', calculateInApp: false },
    { conceptName: 'Clay State', category: 'clay', salesforceField: 'Clay_State__c', calculateInApp: false },
    { conceptName: 'Clay Country', category: 'clay', salesforceField: 'Clay_Country__c', calculateInApp: false },
    { conceptName: 'Clay NAICS Code', category: 'clay', salesforceField: 'Clay_NAICS_code__c', calculateInApp: false },
    { conceptName: 'Clay Is Franchise', category: 'clay', salesforceField: 'Clay_Franchise__c', calculateInApp: false },
    { conceptName: 'Clay Is Parent Company', category: 'clay', salesforceField: 'Clay_Is_the_Parent_Company__c', calculateInApp: false },
    { conceptName: 'Clay Enriched At', category: 'clay', salesforceField: 'Last_Enriched_by_Clay__c', calculateInApp: false },

    // Opportunity — commercial
    { conceptName: 'Opportunity Type', category: 'opportunity', salesforceField: 'Type', calculateInApp: false },
    { conceptName: 'Opportunity Amount', category: 'opportunity', salesforceField: 'Amount', calculateInApp: false },
    { conceptName: 'Opportunity ARR', category: 'opportunity', salesforceField: 'ARR__c', calculateInApp: false },
    { conceptName: 'New ARR', category: 'opportunity', salesforceField: null, calculateInApp: false },
    { conceptName: 'Renewal ARR', category: 'opportunity', salesforceField: null, calculateInApp: false },
    { conceptName: 'Renewal Amount Due', category: 'opportunity', salesforceField: null, calculateInApp: false },
    { conceptName: 'Total Contract Value', category: 'opportunity', salesforceField: 'Total_Contract_Value__c', calculateInApp: false },
    { conceptName: 'Duration (months)', category: 'opportunity', salesforceField: 'Duration__c', calculateInApp: false },
    { conceptName: 'License Seats', category: 'opportunity', salesforceField: 'License_Seats__c', calculateInApp: false },
    { conceptName: 'Weighted Forecast ARR', category: 'opportunity', salesforceField: null, calculateInApp: true },

    // Opportunity — pipeline state
    { conceptName: 'Stage', category: 'opportunity', salesforceField: 'StageName', calculateInApp: false },
    { conceptName: 'Stage Probability', category: 'opportunity', salesforceField: 'Probability', calculateInApp: false },
    { conceptName: 'Forecast Category', category: 'opportunity', salesforceField: 'ForecastCategoryName', calculateInApp: false },
    { conceptName: 'Days In Stage', category: 'opportunity', salesforceField: 'DaysInStage__c', calculateInApp: false },

    // Opportunity — dates
    { conceptName: 'Close Date', category: 'opportunity', salesforceField: 'CloseDate', calculateInApp: false },
    { conceptName: 'Renewal Due Date', category: 'opportunity', salesforceField: null, calculateInApp: false },
    { conceptName: 'Date of Churn', category: 'opportunity', salesforceField: null, calculateInApp: false },

    // Opportunity — coaching / notes
    { conceptName: 'Next Step', category: 'opportunity', salesforceField: 'NextStep', calculateInApp: false },
    { conceptName: 'Description', category: 'opportunity', salesforceField: 'Description', calculateInApp: false },
    { conceptName: 'Forecast Notes', category: 'opportunity', salesforceField: null, calculateInApp: false },
    { conceptName: 'Lost Reason', category: 'opportunity', salesforceField: null, calculateInApp: false },

    // Opportunity — risk
    { conceptName: 'Opportunity Risk Flag', category: 'opportunity', salesforceField: 'Risk__c', calculateInApp: false },
    { conceptName: 'Unresolved Risk Count', category: 'opportunity', salesforceField: 'Unresolved_Risks__c', calculateInApp: false },
    { conceptName: 'Is At Risk', category: 'opportunity', salesforceField: 'IsAtRisk__c', calculateInApp: true },

    // Opportunity — MEDDPICC extended
    { conceptName: 'Economic Buyer Name', category: 'meddpicc', salesforceField: 'Economic_Buyer_Name__c', calculateInApp: false },
    { conceptName: 'Economic Buyer Title', category: 'meddpicc', salesforceField: 'Economic_Buyer_Title__c', calculateInApp: false },
    { conceptName: 'MEDDPICC Risks', category: 'meddpicc', salesforceField: 'MEDDPICCR_Risks__c', calculateInApp: false },
    // 'MEDDPICC Metrics' is the M in MEDDPICC. Distinct from the legacy
    // 'Metrics' entry (category 'command') above, which collides on the
    // conceptName lookup. New code should read 'MEDDPICC Metrics'.
    { conceptName: 'MEDDPICC Metrics', category: 'meddpicc', salesforceField: 'COM_Metrics__c', calculateInApp: false },

    // Opportunity — Command of the Message extended
    { conceptName: 'Why Do Anything', category: 'command', salesforceField: 'Command_Why_Do_Anything__c', calculateInApp: false },
    { conceptName: 'Why Now', category: 'command', salesforceField: 'Command_Why_Now__c', calculateInApp: false },
    { conceptName: 'Why Us', category: 'command', salesforceField: 'Command_Why_Us__c', calculateInApp: false },
    { conceptName: 'Why Trust', category: 'command', salesforceField: 'Command_Why_Trust__c', calculateInApp: false },
    { conceptName: 'Why Pay That', category: 'command', salesforceField: 'Command_Why_Pay_That__c', calculateInApp: false },
    { conceptName: 'Command Overall Score', category: 'command', salesforceField: 'Command_Overall_Score__c', calculateInApp: false },
    { conceptName: 'Command Confidence', category: 'command', salesforceField: 'Command_Confidence_Level__c', calculateInApp: false },

    // Opportunity — Gong call insights
    { conceptName: 'Gong Call Count', category: 'gong', salesforceField: 'Gong_Call_Count__c', calculateInApp: false },
    { conceptName: 'Gong Last Call Date', category: 'gong', salesforceField: 'Gong_Last_Call_Date__c', calculateInApp: false },
    { conceptName: 'Gong Sentiment', category: 'gong', salesforceField: 'Gong_Sentiment__c', calculateInApp: false },
    { conceptName: 'Gong Competitor Mentions', category: 'gong', salesforceField: 'Gong_Competitor_Mentions__c', calculateInApp: false },
    { conceptName: 'Gong Call Recording URL', category: 'gong', salesforceField: 'Gong_Call_Recording_URL__c', calculateInApp: false },
  ],
  products: [],
  productFieldMappings: [],
  opportunityStages: ['Prospecting', 'Discovery', 'Value Confirmation', 'Technical Evaluation', 'Negotiation'],
  roleMapping: [
    { salesforceProfile: 'Sales User', appRole: 'ae' },
    { salesforceProfile: 'Client Sales', appRole: 'am' },
    { salesforceProfile: 'Customer Success Manager', appRole: 'csm' },
    { salesforceProfile: 'System Administrator', appRole: 'admin' },
  ],
  userRoleOverrides: [],
  displaySettings: {
    accountsPerPage: 10,
    dealsPerPage: 8,
    defaultSort: 'priority',
    viewMode: 'table',
  },
  scopeDefaults: {
    ae: 'my',
    am: 'my',
    csm: 'my',
    'sales-leader': 'team',
    executive: 'all',
    unknown: 'my',
  },
};

// In-memory configuration (will be replaced with database/Salesforce storage)
let currentConfig: AppConfig = { ...defaultConfig };

/**
 * Get current configuration
 */
export function getConfig(): AppConfig {
  return { ...currentConfig };
}

/**
 * Update entire configuration
 */
export function updateConfig(newConfig: Partial<AppConfig>, modifiedBy: string): AppConfig {
  currentConfig = {
    ...currentConfig,
    ...newConfig,
    lastModified: {
      by: modifiedBy,
      date: new Date().toISOString(),
    },
  };
  return { ...currentConfig };
}

/**
 * Update risk rules
 */
export function updateRiskRules(rules: RiskRule[], modifiedBy: string): AppConfig {
  currentConfig.riskRules = rules;
  currentConfig.lastModified = {
    by: modifiedBy,
    date: new Date().toISOString(),
  };
  return { ...currentConfig };
}

/**
 * Update priority scoring configuration
 */
export function updatePriorityScoring(config: PriorityConfig, modifiedBy: string): AppConfig {
  // Validate default weights sum to 100
  const totalWeight = config.components.reduce((sum, comp) => sum + comp.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`Default component weights must sum to 100%. Current total: ${totalWeight}%`);
  }

  // Validate role-specific weights sum to 100 for each role
  if (config.roleConfigs) {
    for (const [role, roleConfig] of Object.entries(config.roleConfigs)) {
      const roleWeights = Object.values(roleConfig.componentWeights);
      if (roleWeights.length > 0) {
        const roleTotal = roleWeights.reduce((sum, w) => sum + w, 0);
        if (Math.abs(roleTotal - 100) > 0.01) {
          throw new Error(`${role.toUpperCase()} component weights must sum to 100%. Current total: ${roleTotal}%`);
        }
      }
    }
  }

  currentConfig.priorityScoring = config;
  currentConfig.lastModified = {
    by: modifiedBy,
    date: new Date().toISOString(),
  };
  return { ...currentConfig };
}

/**
 * Update field mappings
 */
export function updateFieldMappings(mappings: FieldMapping[], modifiedBy: string): AppConfig {
  currentConfig.fieldMappings = mappings;
  currentConfig.lastModified = {
    by: modifiedBy,
    date: new Date().toISOString(),
  };
  return { ...currentConfig };
}

/**
 * Update opportunity stages
 */
export function updateOpportunityStages(stages: string[], modifiedBy: string): AppConfig {
  currentConfig.opportunityStages = stages;
  currentConfig.lastModified = {
    by: modifiedBy,
    date: new Date().toISOString(),
  };
  return { ...currentConfig };
}

/**
 * Reset configuration to defaults
 */
export function resetToDefaults(): AppConfig {
  currentConfig = { ...defaultConfig };
  return { ...currentConfig };
}

/**
 * Export configuration as JSON
 */
export function exportConfig(): string {
  return JSON.stringify(currentConfig, null, 2);
}

/**
 * Import configuration from JSON
 */
export function importConfig(jsonString: string, modifiedBy: string): AppConfig {
  const newConfig = JSON.parse(jsonString) as AppConfig;

  // Basic validation
  if (!newConfig.riskRules || !newConfig.priorityScoring || !newConfig.fieldMappings) {
    throw new Error('Invalid configuration JSON');
  }

  currentConfig = {
    ...newConfig,
    lastModified: {
      by: modifiedBy,
      date: new Date().toISOString(),
    },
  };

  return { ...currentConfig };
}

/**
 * Get configured quota field name for User object
 */
export function getQuotaFieldName(quotaType: 'annual' | 'quarterly' | 'monthly' = 'annual'): string {
  const quotaMapping: Record<string, string> = {
    annual: 'Annual_Quota__c',
    quarterly: 'Quarterly_Quota__c',
    monthly: 'Monthly_Quota__c',
  };

  // Check if user has configured a different field name
  const mapping = currentConfig.fieldMappings.find(
    (m) => m.category === 'quota' && m.conceptName === `${quotaType.charAt(0).toUpperCase() + quotaType.slice(1)} Quota`
  );

  return mapping?.salesforceField || quotaMapping[quotaType];
}
