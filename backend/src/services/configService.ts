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
  conceptName: string;
  category: string; // 'clay', '6sense', 'health', 'meddpicc', etc.
  salesforceField: string | null;
  calculateInApp: boolean;
}

export interface AppConfig {
  riskRules: RiskRule[];
  priorityScoring: PriorityConfig;
  fieldMappings: FieldMapping[];
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
  ],
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
