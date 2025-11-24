import { Pool } from 'pg';

export interface AIProviderConfig {
  provider: 'anthropic' | 'openai' | 'gemini' | 'none';
  apiKey?: string;
  model?: string;
  customEndpoint?: string; // For Azure OpenAI or custom deployments
  enabled: boolean;
}

export interface AdminSettings {
  aiProvider: AIProviderConfig;
  updatedAt: string;
  updatedBy: string;
}

export class AdminSettingsService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async initializeSettingsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS admin_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR(255)
      );

      -- Create default AI provider setting if not exists
      INSERT INTO admin_settings (setting_key, setting_value, updated_by)
      VALUES ('ai_provider', '{"provider": "none", "enabled": false}'::jsonb, 'system')
      ON CONFLICT (setting_key) DO NOTHING;
    `;

    await this.pool.query(query);
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

  async getAllSettings(userId: string): Promise<AdminSettings> {
    const aiConfig = await this.getAIProviderConfig();

    const result = await this.pool.query(
      'SELECT updated_at, updated_by FROM admin_settings WHERE setting_key = $1',
      ['ai_provider']
    );

    return {
      aiProvider: aiConfig,
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
