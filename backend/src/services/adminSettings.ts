import { Pool } from 'pg';

export interface AIProviderConfig {
  provider: 'anthropic' | 'openai' | 'gemini' | 'none';
  apiKey?: string;
  model?: string;
  customEndpoint?: string; // For Azure OpenAI or custom deployments
  enabled: boolean;
}

export interface SalesforceFieldConfig {
  opportunityAmountField: string; // Field to use for opportunity amounts (e.g., 'Amount', 'New_ARR__c')
  forecastCategoryField?: string; // Field to use for forecast categories (default: 'ForecastCategory')
}

export interface BrandingConfig {
  brandName: string;
  logoBase64: string;
  logoHeight: number;
}

export interface CustomLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
}

export interface ForecastConfig {
  forecastMethod: 'forecastCategory' | 'probability'; // How to group Commit/BestCase/Pipeline
  commitProbabilityThreshold: number;   // For probability method: >= this = Commit (default 70)
  bestCaseProbabilityThreshold: number; // For probability method: >= this = Best Case (default 50)
  commitProbability: number;      // Weighted forecast % for Commit (default 90)
  bestCaseProbability: number;    // Weighted forecast % for Best Case (default 70)
  pipelineProbability: number;    // Weighted forecast % for Pipeline (default 30)
  stageWeights: Record<string, number>;  // e.g., { "Discovery": 10, "Negotiation": 80 }
  quotaSource: 'salesforce' | 'forecastingQuota' | 'manual' | 'none'; // Where to get quota/target data
  salesforceQuotaField: string;   // SF field name for quota on User object (default 'Quarterly_Quota__c')
  quotaPeriod: 'quarterly' | 'annual'; // Quota period for SF-sourced quotas
  manualQuotas: Record<string, number>; // userId -> quota amount for manual entry
  defaultQuota: number;           // Fallback quota if user not in manualQuotas (0 = no target)
}

export interface HubSectionConfig {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

export interface HubLayoutConfig {
  ae: {
    sections: HubSectionConfig[];
    customLinks: CustomLink[];
  };
  am: {
    sections: HubSectionConfig[];
    customLinks: CustomLink[];
  };
  csm: {
    sections: HubSectionConfig[];
    customLinks: CustomLink[];
  };
  salesLeader: {
    sections: HubSectionConfig[];
    customLinks: CustomLink[];
  };
}

export interface OpportunityDetailField {
  label: string;
  salesforceField: string;
  fieldType: 'score' | 'text' | 'currency' | 'date' | 'percent' | 'url';
  showProgressBar?: boolean;
}

export interface OpportunityDetailSection {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  fields: OpportunityDetailField[];
}

export interface OpportunityDetailConfig {
  sections: OpportunityDetailSection[];
}

export interface AdminSettings {
  aiProvider: AIProviderConfig;
  salesforceFields: SalesforceFieldConfig;
  hubLayout?: HubLayoutConfig;
  updatedAt: string;
  updatedBy: string;
}

export class AdminSettingsService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async initializeSettingsTable() {
    // Create table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR(255)
      );
    `);

    // Create default AI provider setting if not exists
    await this.pool.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (setting_key) DO NOTHING`,
      ['ai_provider', JSON.stringify({ provider: 'none', enabled: false }), 'system']
    );

    // Create default Salesforce field config if not exists
    await this.pool.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (setting_key) DO NOTHING`,
      ['salesforce_fields', JSON.stringify({ opportunityAmountField: 'Amount' }), 'system']
    );

    // Create default Hub layout config if not exists
    await this.pool.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (setting_key) DO NOTHING`,
      ['hub_layout', JSON.stringify(this.getDefaultHubLayout()), 'system']
    );
  }

  private getDefaultHubLayout(): HubLayoutConfig {
    return {
      ae: {
        sections: [
          { id: 'metrics', name: 'Key Metrics', enabled: true, order: 1 },
          { id: 'ai-assistant', name: 'AI Assistant', enabled: true, order: 2 },
          { id: 'priorities', name: "Today's Priorities", enabled: true, order: 3 },
          { id: 'forecast', name: 'Pipeline Forecast', enabled: true, order: 4 },
          { id: 'priority-accounts', name: 'Priority Actions', enabled: true, order: 5 },
          { id: 'at-risk-deals', name: 'At-Risk Deals', enabled: true, order: 6 },
          { id: 'custom-links', name: 'Quick Links', enabled: true, order: 7 },
        ],
        customLinks: [],
      },
      am: {
        sections: [
          { id: 'metrics', name: 'Key Metrics', enabled: true, order: 1 },
          { id: 'ai-assistant', name: 'AI Assistant', enabled: true, order: 2 },
          { id: 'priorities', name: "Today's Priorities", enabled: true, order: 3 },
          { id: 'renewals', name: 'Upcoming Renewals', enabled: true, order: 4 },
          { id: 'expansion', name: 'Expansion Opportunities', enabled: true, order: 5 },
          { id: 'custom-links', name: 'Quick Links', enabled: true, order: 6 },
        ],
        customLinks: [],
      },
      csm: {
        sections: [
          { id: 'metrics', name: 'Key Metrics', enabled: true, order: 1 },
          { id: 'ai-assistant', name: 'AI Assistant', enabled: true, order: 2 },
          { id: 'priorities', name: "Today's Priorities", enabled: true, order: 3 },
          { id: 'at-risk', name: 'At-Risk Accounts', enabled: true, order: 4 },
          { id: 'health', name: 'Health Score Trends', enabled: true, order: 5 },
          { id: 'custom-links', name: 'Quick Links', enabled: true, order: 6 },
        ],
        customLinks: [],
      },
      salesLeader: {
        sections: [
          { id: 'metrics', name: 'Key Metrics', enabled: true, order: 1 },
          { id: 'ai-assistant', name: 'AI Assistant', enabled: true, order: 2 },
          { id: 'team-performance', name: 'Team Performance', enabled: true, order: 3 },
          { id: 'pipeline', name: 'Pipeline Analysis', enabled: true, order: 4 },
          { id: 'forecasts', name: 'Forecasts', enabled: true, order: 5 },
          { id: 'custom-links', name: 'Quick Links', enabled: true, order: 6 },
        ],
        customLinks: [],
      },
    };
  }

  async getAIProviderConfig(): Promise<AIProviderConfig> {
    const result = await this.pool.query(
      'SELECT setting_value FROM admin_settings WHERE setting_key = $1',
      ['ai_provider']
    );

    if (result.rows.length === 0) {
      // Return environment-based config as fallback
      return this.getEnvBasedConfig();
    }

    return result.rows[0].setting_value as AIProviderConfig;
  }

  async setAIProviderConfig(config: AIProviderConfig, userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()`,
      ['ai_provider', JSON.stringify(config), userId]
    );
  }

  async getSalesforceFieldConfig(): Promise<SalesforceFieldConfig> {
    const result = await this.pool.query(
      'SELECT setting_value FROM admin_settings WHERE setting_key = $1',
      ['salesforce_fields']
    );

    if (result.rows.length === 0) {
      // Return default config
      return {
        opportunityAmountField: 'Amount',
        forecastCategoryField: 'ForecastCategory',
      };
    }

    const config = result.rows[0].setting_value as SalesforceFieldConfig;
    return {
      opportunityAmountField: config.opportunityAmountField || 'Amount',
      forecastCategoryField: config.forecastCategoryField || 'ForecastCategory',
    };
  }

  async setSalesforceFieldConfig(config: SalesforceFieldConfig, userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()`,
      ['salesforce_fields', JSON.stringify(config), userId]
    );
  }

  async getHubLayoutConfig(): Promise<HubLayoutConfig> {
    const result = await this.pool.query(
      'SELECT setting_value FROM admin_settings WHERE setting_key = $1',
      ['hub_layout']
    );

    if (result.rows.length === 0) {
      // Return default config
      return this.getDefaultHubLayout();
    }

    return result.rows[0].setting_value as HubLayoutConfig;
  }

  async setHubLayoutConfig(config: HubLayoutConfig, userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()`,
      ['hub_layout', JSON.stringify(config), userId]
    );
  }

  async getBrandingConfig(): Promise<BrandingConfig | null> {
    const result = await this.pool.query(
      'SELECT setting_value FROM admin_settings WHERE setting_key = $1',
      ['branding']
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].setting_value as BrandingConfig;
  }

  async setBrandingConfig(config: BrandingConfig | null, userId: string): Promise<void> {
    if (config === null) {
      // Remove branding to revert to default
      await this.pool.query(
        'DELETE FROM admin_settings WHERE setting_key = $1',
        ['branding']
      );
      return;
    }

    await this.pool.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()`,
      ['branding', JSON.stringify(config), userId]
    );
  }

  async getForecastConfig(): Promise<ForecastConfig> {
    const result = await this.pool.query(
      'SELECT setting_value FROM admin_settings WHERE setting_key = $1',
      ['forecast_config']
    );

    const defaults: ForecastConfig = {
      forecastMethod: 'forecastCategory',
      commitProbabilityThreshold: 70,
      bestCaseProbabilityThreshold: 50,
      commitProbability: 90,
      bestCaseProbability: 70,
      pipelineProbability: 30,
      stageWeights: {},
      quotaSource: 'none',
      salesforceQuotaField: 'Quarterly_Quota__c',
      quotaPeriod: 'quarterly',
      manualQuotas: {},
      defaultQuota: 0,
    };

    if (result.rows.length === 0) {
      return defaults;
    }

    const config = result.rows[0].setting_value as Partial<ForecastConfig>;
    return {
      forecastMethod: config.forecastMethod ?? defaults.forecastMethod,
      commitProbabilityThreshold: config.commitProbabilityThreshold ?? defaults.commitProbabilityThreshold,
      bestCaseProbabilityThreshold: config.bestCaseProbabilityThreshold ?? defaults.bestCaseProbabilityThreshold,
      commitProbability: config.commitProbability ?? defaults.commitProbability,
      bestCaseProbability: config.bestCaseProbability ?? defaults.bestCaseProbability,
      pipelineProbability: config.pipelineProbability ?? defaults.pipelineProbability,
      stageWeights: config.stageWeights ?? defaults.stageWeights,
      quotaSource: config.quotaSource ?? defaults.quotaSource,
      salesforceQuotaField: config.salesforceQuotaField ?? defaults.salesforceQuotaField,
      quotaPeriod: config.quotaPeriod ?? defaults.quotaPeriod,
      manualQuotas: config.manualQuotas ?? defaults.manualQuotas,
      defaultQuota: config.defaultQuota ?? defaults.defaultQuota,
    };
  }

  async setForecastConfig(config: ForecastConfig, userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()`,
      ['forecast_config', JSON.stringify(config), userId]
    );
  }

  private getDefaultOpportunityDetailConfig(): OpportunityDetailConfig {
    return {
      sections: [
        {
          id: 'meddpicc',
          label: 'MEDDPICC Qualification',
          enabled: true,
          order: 1,
          fields: [
            { label: 'Metrics', salesforceField: 'MEDDPICC_Metrics__c', fieldType: 'score', showProgressBar: true },
            { label: 'Economic Buyer', salesforceField: 'MEDDPICC_Economic_Buyer__c', fieldType: 'score', showProgressBar: true },
            { label: 'Decision Criteria', salesforceField: 'MEDDPICC_Decision_Criteria__c', fieldType: 'score', showProgressBar: true },
            { label: 'Decision Process', salesforceField: 'MEDDPICC_Decision_Process__c', fieldType: 'score', showProgressBar: true },
            { label: 'Paper Process', salesforceField: 'MEDDPICC_Paper_Process__c', fieldType: 'score', showProgressBar: true },
            { label: 'Identify Pain', salesforceField: 'MEDDPICC_Identify_Pain__c', fieldType: 'score', showProgressBar: true },
            { label: 'Champion', salesforceField: 'MEDDPICC_Champion__c', fieldType: 'score', showProgressBar: true },
            { label: 'Competition', salesforceField: 'MEDDPICC_Competition__c', fieldType: 'score', showProgressBar: true },
          ],
        },
        {
          id: 'command',
          label: 'Command of the Message',
          enabled: true,
          order: 2,
          fields: [
            { label: 'Why Do Anything?', salesforceField: 'Command_Why_Do_Anything__c', fieldType: 'text' },
            { label: 'Why Now?', salesforceField: 'Command_Why_Now__c', fieldType: 'text' },
            { label: 'Why Us?', salesforceField: 'Command_Why_Us__c', fieldType: 'text' },
            { label: 'Why Trust?', salesforceField: 'Command_Why_Trust__c', fieldType: 'text' },
            { label: 'Why Pay That?', salesforceField: 'Command_Why_Pay_That__c', fieldType: 'text' },
          ],
        },
        {
          id: 'details',
          label: 'Details',
          enabled: true,
          order: 3,
          fields: [
            { label: 'Description', salesforceField: 'Description', fieldType: 'text' },
            { label: 'Next Step', salesforceField: 'NextStep', fieldType: 'text' },
          ],
        },
        {
          id: 'competitive',
          label: 'Competitive Encounters',
          enabled: true,
          order: 4,
          fields: [],
        },
      ],
    };
  }

  async getOpportunityDetailConfig(): Promise<OpportunityDetailConfig> {
    const result = await this.pool.query(
      'SELECT setting_value FROM admin_settings WHERE setting_key = $1',
      ['opportunity_detail_config']
    );

    if (result.rows.length === 0) {
      return this.getDefaultOpportunityDetailConfig();
    }

    return result.rows[0].setting_value as OpportunityDetailConfig;
  }

  async setOpportunityDetailConfig(config: OpportunityDetailConfig, userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()`,
      ['opportunity_detail_config', JSON.stringify(config), userId]
    );
  }

  async getAppConfig(): Promise<Record<string, any> | null> {
    const result = await this.pool.query(
      'SELECT setting_value FROM admin_settings WHERE setting_key = $1',
      ['app_config']
    );
    if (result.rows.length === 0) return null;
    return result.rows[0].setting_value as Record<string, any>;
  }

  async saveAppConfig(config: Record<string, any>, userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()`,
      ['app_config', JSON.stringify(config), userId]
    );
  }

  async getAllSettings(userId: string): Promise<AdminSettings> {
    const aiConfig = await this.getAIProviderConfig();
    const sfFieldsConfig = await this.getSalesforceFieldConfig();
    const hubLayout = await this.getHubLayoutConfig();

    const result = await this.pool.query(
      'SELECT updated_at, updated_by FROM admin_settings WHERE setting_key = $1',
      ['ai_provider']
    );

    return {
      aiProvider: aiConfig,
      salesforceFields: sfFieldsConfig,
      hubLayout,
      updatedAt: result.rows[0]?.updated_at || new Date().toISOString(),
      updatedBy: result.rows[0]?.updated_by || 'system',
    };
  }

  private getEnvBasedConfig(): AIProviderConfig {
    // Fallback to environment variables if no DB config exists
    if (process.env.ANTHROPIC_API_KEY) {
      return {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-5-sonnet-20241022',
        enabled: true,
      };
    } else if (process.env.OPENAI_API_KEY) {
      return {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4-turbo-preview',
        customEndpoint: process.env.AZURE_OPENAI_ENDPOINT, // For Azure OpenAI
        enabled: true,
      };
    } else if (process.env.GOOGLE_AI_API_KEY) {
      return {
        provider: 'gemini',
        apiKey: process.env.GOOGLE_AI_API_KEY,
        model: 'gemini-pro',
        enabled: true,
      };
    }

    return {
      provider: 'none',
      enabled: false,
    };
  }

  // Test the AI provider configuration
  async testAIProvider(config: AIProviderConfig): Promise<{ success: boolean; message: string }> {
    try {
      // Import AI service dynamically to test configuration
      const { AIService } = await import('./aiService');
      const testService = new AIService(config);

      // Try a simple test prompt
      const testData = {
        Name: 'Test Opportunity',
        Account: { Name: 'Test Account' },
        StageName: 'Discovery',
        Amount: 50000,
        CloseDate: new Date().toISOString().split('T')[0],
        DaysInStage__c: 5,
        MEDDPICC_Overall_Score__c: 75,
      };

      await testService.generateDealSummary(testData, []);

      return {
        success: true,
        message: `Successfully connected to ${config.provider}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to connect: ${error.message}`,
      };
    }
  }
}
