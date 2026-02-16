import { Router, Request, Response, json } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { isAdmin } from '../middleware/adminAuth';
import * as configService from '../services/configService';
import { createConnection } from '../config/salesforce';
import { pool } from '../config/database';
import { AdminSettingsService, ForecastConfig } from '../services/adminSettings';
import AIApiKey, { AIProvider } from '../models/AIApiKey';
import { aiService } from '../services/aiService';

const router = Router();
const adminSettings = new AdminSettingsService(pool);

// All admin routes require authentication and admin privileges
router.use(isAuthenticated);
router.use(isAdmin);

// Hydrate in-memory config from the database.
// Always reads fresh from DB to ensure saved changes are reflected.
async function hydrateConfigFromDB(): Promise<void> {
  try {
    const dbAppConfig = await adminSettings.getAppConfig();
    if (dbAppConfig) {
      configService.updateConfig(dbAppConfig, dbAppConfig.lastModified?.by || 'system');
    }
  } catch (err) {
    console.error('Failed to hydrate config from database:', err);
  }
}

// Persist the current in-memory AppConfig to the database.
// IMPORTANT: Callers must hydrate BEFORE applying their in-memory update,
// then call this AFTER. Do NOT hydrate here — it would overwrite the
// in-memory changes that were just applied.
async function persistAppConfig(userId: string): Promise<void> {
  try {
    const config = configService.getConfig();
    await adminSettings.saveAppConfig(config, userId);
  } catch (err) {
    console.error('Failed to persist app config to database:', err);
  }
}

/**
 * GET /api/admin/config
 * Get current application configuration
 */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    // Hydrate in-memory config from database (survives server restarts)
    await hydrateConfigFromDB();
    const config = configService.getConfig();

    // Add database-backed settings (these are already persisted separately)
    const salesforceFields = await adminSettings.getSalesforceFieldConfig();
    const hubLayout = await adminSettings.getHubLayoutConfig();
    const forecastConfig = await adminSettings.getForecastConfig();
    const opportunityDetailConfig = await adminSettings.getOpportunityDetailConfig();
    const buyingSignalConfig = await adminSettings.getBuyingSignalConfig();

    res.json({
      success: true,
      data: {
        ...config,
        salesforceFields,
        hubLayout,
        forecastConfig,
        opportunityDetailConfig,
        buyingSignalConfig,
      },
    });
  } catch (error: any) {
    console.error('Error fetching config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/risk-rules
 * Update risk rules configuration
 */
router.put('/config/risk-rules', async (req: Request, res: Response) => {
  try {
    const { rules } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    await hydrateConfigFromDB();
    const updatedConfig = configService.updateRiskRules(rules, modifiedBy);
    await persistAppConfig(modifiedBy);

    res.json({
      success: true,
      data: updatedConfig.riskRules,
      message: 'Risk rules updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating risk rules:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update risk rules',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/config/risk-rules/parse
 * Parse a natural language description into a structured RiskRule using AI
 */
router.post('/config/risk-rules/parse', async (req: Request, res: Response) => {
  try {
    const { description } = req.body;

    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'A description string is required',
      });
    }

    // Optionally fetch available SF field names to give AI context
    let fieldContext = '';
    try {
      const session = req.session as any;
      if (session.accessToken && session.instanceUrl) {
        const { createConnection } = await import('../config/salesforce');
        const connection = createConnection(session.accessToken, session.instanceUrl, session.refreshToken);
        const accountDescribe = await connection.sobject('Account').describe();
        const oppDescribe = await connection.sobject('Opportunity').describe();

        const accountFieldNames = accountDescribe.fields.map((f: any) => `${f.name} (${f.label})`).join(', ');
        const oppFieldNames = oppDescribe.fields.map((f: any) => `${f.name} (${f.label})`).join(', ');
        fieldContext = `\n\nAvailable Account fields: ${accountFieldNames}\n\nAvailable Opportunity fields: ${oppFieldNames}`;
      }
    } catch {
      // Field context is best-effort, proceed without it
    }

    const prompt = `You are a CRM configuration assistant. Convert the following natural language rule description into a structured JSON risk rule.

The JSON must match this exact schema:
{
  "name": "string - short descriptive name for the rule",
  "objectType": "Account" or "Opportunity",
  "conditions": [
    {
      "field": "Salesforce API field name (e.g. Current_Gainsight_Score__c, Amount, StageName)",
      "operator": "=" | "!=" | "<" | ">" | "<=" | ">=" | "IN" | "NOT IN" | "contains",
      "value": "the value to compare against (use numbers for numeric fields, strings for text)"
    }
  ],
  "logic": "AND" or "OR",
  "flag": "at-risk" | "critical" | "warning",
  "active": true
}
${fieldContext}

User's rule description: "${description}"

Return ONLY the JSON object, no explanation or markdown.`;

    const aiResponse = await aiService.askWithContext(prompt, 1000);

    // Strip markdown code blocks if present
    let cleaned = aiResponse.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    const parsed = JSON.parse(cleaned);

    // Add an ID and timestamp
    const rule = {
      id: `rule_${Date.now()}`,
      ...parsed,
      active: parsed.active !== false,
    };

    res.json({
      success: true,
      data: rule,
    });
  } catch (error: any) {
    console.error('Error parsing NL risk rule:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to parse rule description',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/priority-scoring
 * Update priority scoring configuration
 */
router.put('/config/priority-scoring', async (req: Request, res: Response) => {
  try {
    const { priorityScoring } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    await hydrateConfigFromDB();
    const updatedConfig = configService.updatePriorityScoring(priorityScoring, modifiedBy);
    await persistAppConfig(modifiedBy);

    res.json({
      success: true,
      data: updatedConfig.priorityScoring,
      message: 'Priority scoring updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating priority scoring:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update priority scoring',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/field-mappings
 * Update field mappings configuration.
 * Also syncs MEDDPICC and Command of the Message mappings into the
 * opportunity detail config so they are actually queried and displayed.
 */
router.put('/config/field-mappings', async (req: Request, res: Response) => {
  try {
    const { mappings } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';
    const userId = session.userId || 'Unknown';

    await hydrateConfigFromDB();
    const updatedConfig = configService.updateFieldMappings(mappings, modifiedBy);
    await persistAppConfig(modifiedBy);

    // Sync meddpicc & command field mappings into the opportunity detail config
    try {
      const detailConfig = await adminSettings.getOpportunityDetailConfig();

      const meddpiccMappings = (mappings as configService.FieldMapping[])
        .filter((m: configService.FieldMapping) => m.category === 'meddpicc' && m.salesforceField);
      const commandMappings = (mappings as configService.FieldMapping[])
        .filter((m: configService.FieldMapping) => m.category === 'command' && m.salesforceField);

      let changed = false;

      // Sync MEDDPICC section
      if (meddpiccMappings.length > 0) {
        let meddpiccSection = detailConfig.sections.find(s => s.id === 'meddpicc');
        if (!meddpiccSection) {
          meddpiccSection = { id: 'meddpicc', label: 'MEDDPICC Qualification', enabled: true, order: 1, fields: [] };
          detailConfig.sections.push(meddpiccSection);
        }
        meddpiccSection.enabled = true;
        meddpiccSection.fields = meddpiccMappings.map((m: configService.FieldMapping) => ({
          label: m.conceptName,
          salesforceField: m.salesforceField!,
          fieldType: 'score' as const,
          showProgressBar: true,
        }));
        changed = true;
      }

      // Sync Command of the Message section
      if (commandMappings.length > 0) {
        let commandSection = detailConfig.sections.find(s => s.id === 'command');
        if (!commandSection) {
          commandSection = { id: 'command', label: 'Command of the Message', enabled: true, order: 2, fields: [] };
          detailConfig.sections.push(commandSection);
        }
        commandSection.enabled = true;
        commandSection.fields = commandMappings.map((m: configService.FieldMapping) => ({
          label: m.conceptName,
          salesforceField: m.salesforceField!,
          fieldType: 'text' as const,
        }));
        changed = true;
      }

      if (changed) {
        await adminSettings.setOpportunityDetailConfig(detailConfig, userId);
      }
    } catch (syncErr) {
      console.error('Error syncing field mappings to opportunity detail config:', syncErr);
      // Don't fail the request — field mappings were saved successfully
    }

    res.json({
      success: true,
      data: updatedConfig.fieldMappings,
      message: 'Field mappings updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating field mappings:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update field mappings',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/role-mappings
 * Update role mappings configuration
 */
router.put('/config/role-mappings', async (req: Request, res: Response) => {
  try {
    const { mappings } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    await hydrateConfigFromDB();
    const updatedConfig = configService.updateConfig({ roleMapping: mappings }, modifiedBy);
    await persistAppConfig(modifiedBy);

    res.json({
      success: true,
      data: updatedConfig.roleMapping,
      message: 'Role mappings updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating role mappings:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update role mappings',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/user-role-overrides
 * Update user-name-based role overrides
 */
router.put('/config/user-role-overrides', async (req: Request, res: Response) => {
  try {
    const { overrides } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    await hydrateConfigFromDB();
    const updatedConfig = configService.updateConfig({ userRoleOverrides: overrides }, modifiedBy);
    await persistAppConfig(modifiedBy);

    res.json({
      success: true,
      data: updatedConfig.userRoleOverrides,
      message: 'User role overrides updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating user role overrides:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update user role overrides',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/display-settings
 * Update display settings configuration
 */
router.put('/config/display-settings', async (req: Request, res: Response) => {
  try {
    const { displaySettings } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    await hydrateConfigFromDB();
    const updatedConfig = configService.updateConfig({ displaySettings }, modifiedBy);
    await persistAppConfig(modifiedBy);

    res.json({
      success: true,
      data: updatedConfig.displaySettings,
      message: 'Display settings updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating display settings:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update display settings',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/opportunity-stages
 * Update opportunity stages configuration
 */
router.put('/config/opportunity-stages', async (req: Request, res: Response) => {
  try {
    const { stages } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || session.userInfo?.user_id || 'Unknown';

    await hydrateConfigFromDB();
    const updatedConfig = configService.updateOpportunityStages(stages, modifiedBy);
    await persistAppConfig(modifiedBy);

    res.json({
      success: true,
      data: updatedConfig.opportunityStages,
      message: 'Opportunity stages updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating opportunity stages:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update opportunity stages',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/salesforce-fields
 * Update Salesforce field configuration
 */
router.put('/config/salesforce-fields', async (req: Request, res: Response) => {
  try {
    const { opportunityAmountField, forecastCategoryField, excludedOpportunityTypes } = req.body;
    const session = req.session as any;
    const userId = session.userId || 'Unknown';

    const configToSave = {
      opportunityAmountField: opportunityAmountField || 'Amount',
      forecastCategoryField: forecastCategoryField || 'ForecastCategory',
      excludedOpportunityTypes: excludedOpportunityTypes || [],
    };

    await adminSettings.setSalesforceFieldConfig(configToSave, userId);

    res.json({
      success: true,
      data: configToSave,
      message: 'Salesforce field settings updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating Salesforce field settings:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update Salesforce field settings',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/forecast
 * Update forecast configuration (probabilities and stage weights)
 */
router.put('/config/forecast', async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId || 'Unknown';

    // Merge incoming fields with current config to support partial updates
    const current = await adminSettings.getForecastConfig();
    const config: ForecastConfig = {
      forecastMethod: req.body.forecastMethod ?? current.forecastMethod,
      commitProbabilityThreshold: req.body.commitProbabilityThreshold ?? current.commitProbabilityThreshold,
      bestCaseProbabilityThreshold: req.body.bestCaseProbabilityThreshold ?? current.bestCaseProbabilityThreshold,
      commitProbability: req.body.commitProbability ?? current.commitProbability,
      bestCaseProbability: req.body.bestCaseProbability ?? current.bestCaseProbability,
      pipelineProbability: req.body.pipelineProbability ?? current.pipelineProbability,
      stageWeights: req.body.stageWeights ?? current.stageWeights,
      quotaSource: req.body.quotaSource ?? current.quotaSource,
      salesforceQuotaField: req.body.salesforceQuotaField ?? current.salesforceQuotaField,
      quotaPeriod: req.body.quotaPeriod ?? current.quotaPeriod,
      manualQuotas: req.body.manualQuotas ?? current.manualQuotas,
      defaultQuota: req.body.defaultQuota ?? current.defaultQuota,
    };

    await adminSettings.setForecastConfig(config, userId);

    res.json({
      success: true,
      data: config,
      message: 'Forecast configuration updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating forecast config:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update forecast configuration',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/opportunity-detail
 * Update opportunity detail page layout configuration
 */
router.put('/config/opportunity-detail', async (req: Request, res: Response) => {
  try {
    const { sections } = req.body;
    const session = req.session as any;
    const userId = session.userId || 'Unknown';

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        error: 'sections array is required',
      });
    }

    const config = { sections };
    await adminSettings.setOpportunityDetailConfig(config, userId);

    res.json({
      success: true,
      data: config,
      message: 'Opportunity detail configuration updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating opportunity detail config:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update opportunity detail configuration',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/hub-layout
 * Update Hub layout configuration
 */
router.put('/config/hub-layout', async (req: Request, res: Response) => {
  try {
    const { hubLayout } = req.body;
    const session = req.session as any;
    const userId = session.userId || 'Unknown';

    await adminSettings.setHubLayoutConfig(hubLayout, userId);

    res.json({
      success: true,
      data: hubLayout,
      message: 'Hub layout configuration updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating Hub layout configuration:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update Hub layout configuration',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/config/branding
 * Get current branding configuration
 */
router.get('/config/branding', async (_req: Request, res: Response) => {
  try {
    const branding = await adminSettings.getBrandingConfig();

    res.json({
      success: true,
      data: branding,
    });
  } catch (error: any) {
    console.error('Error fetching branding config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch branding configuration',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/config/branding
 * Save branding configuration (with increased body size for base64 images)
 */
router.put('/config/branding', json({ limit: '2mb' }), async (req: Request, res: Response) => {
  try {
    const { brandName, logoBase64, logoHeight } = req.body;
    const session = req.session as any;
    const userId = session.userId || 'Unknown';


    // If no branding data provided, remove branding (revert to default)
    if (!brandName && !logoBase64) {
      await adminSettings.setBrandingConfig(null, userId);
      res.json({
        success: true,
        data: null,
        message: 'Branding removed, reverted to default',
      });
      return;
    }

    const config = {
      brandName: brandName || '',
      logoBase64: logoBase64 || '',
      logoHeight: logoHeight || 32,
    };

    await adminSettings.setBrandingConfig(config, userId);

    res.json({
      success: true,
      data: config,
      message: 'Branding configuration updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating branding config:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update branding configuration',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/salesforce/fields
 * Get available Salesforce custom fields for Account and Opportunity
 */
router.get('/salesforce/fields', async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const connection = createConnection(
      session.accessToken,
      session.instanceUrl,
      session.refreshToken
    );

    // Describe Account object
    const accountDescribe = await connection.sobject('Account').describe();
    const standardAccountFields = [
      'Name', 'Industry', 'Type', 'AnnualRevenue', 'NumberOfEmployees',
      'OwnerId', 'Owner.Name', 'Website', 'Phone', 'BillingState',
      'BillingCountry', 'Rating', 'AccountSource', 'Description',
      'LastActivityDate', 'LastModifiedDate', 'CreatedDate',
      'ParentId', 'Sic', 'TickerSymbol',
    ];
    const accountFields = accountDescribe.fields
      .filter((field: any) => field.custom || standardAccountFields.includes(field.name))
      .map((field: any) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        custom: field.custom,
      }));

    // Describe Opportunity object
    const standardOppFields = [
      'Name', 'StageName', 'Amount', 'CloseDate', 'Probability',
      'ForecastCategory', 'Type', 'LeadSource', 'NextStep',
      'OwnerId', 'Owner.Name', 'IsClosed', 'IsWon',
      'LastActivityDate', 'LastModifiedDate', 'CreatedDate',
      'ExpectedRevenue', 'TotalOpportunityQuantity', 'Description',
      'AccountId', 'CampaignId', 'Pricebook2Id',
    ];
    const opportunityDescribe = await connection.sobject('Opportunity').describe();
    const opportunityFields = opportunityDescribe.fields
      .filter((field: any) => field.custom || standardOppFields.includes(field.name))
      .map((field: any) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        custom: field.custom,
      }));

    res.json({
      success: true,
      data: {
        accountFields,
        opportunityFields,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Salesforce fields:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Salesforce fields',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/config/export
 * Export configuration as JSON
 */
router.get('/config/export', (_req: Request, res: Response) => {
  try {
    const configJson = configService.exportConfig();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=crm-overlay-config.json');
    res.send(configJson);
  } catch (error: any) {
    console.error('Error exporting config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export configuration',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/config/import
 * Import configuration from JSON
 */
router.post('/config/import', async (req: Request, res: Response) => {
  try {
    const { configJson } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    await hydrateConfigFromDB();
    const updatedConfig = configService.importConfig(configJson, modifiedBy);
    await persistAppConfig(modifiedBy);

    res.json({
      success: true,
      data: updatedConfig,
      message: 'Configuration imported successfully',
    });
  } catch (error: any) {
    console.error('Error importing config:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to import configuration',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/config/reset
 * Reset configuration to defaults
 */
router.post('/config/reset', async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    const config = configService.resetToDefaults();
    await persistAppConfig(modifiedBy);

    res.json({
      success: true,
      data: config,
      message: 'Configuration reset to defaults',
    });
  } catch (error: any) {
    console.error('Error resetting config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset configuration',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/ai-api-keys
 * Get all configured AI API keys (without exposing the actual keys)
 */
router.get('/ai-api-keys', async (_req: Request, res: Response) => {
  try {
    // For now, use a default customer ID of '00000000-0000-0000-0000-000000000000'
    // This will be updated when proper multi-tenancy is implemented
    const DEMO_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000';

    const keys = await AIApiKey.findAll({
      where: {
        customerId: DEMO_CUSTOMER_ID,
      },
      attributes: ['id', 'provider', 'isActive', 'lastUsedAt', 'createdAt', 'updatedAt'],
    });

    res.json({
      success: true,
      data: keys,
    });
  } catch (error: any) {
    console.error('Error fetching AI API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AI API keys',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/ai-api-keys
 * Save or update an AI API key
 */
router.post('/ai-api-keys', async (req: Request, res: Response) => {
  try {
    const { provider, apiKey } = req.body;

    if (!provider || !apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Provider and apiKey are required',
      });
    }

    if (!Object.values(AIProvider).includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider',
        message: `Provider must be one of: ${Object.values(AIProvider).join(', ')}`,
      });
    }

    // For now, use a default customer ID
    const DEMO_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000';

    // Check if key already exists for this provider
    const existingKey = await AIApiKey.findOne({
      where: {
        customerId: DEMO_CUSTOMER_ID,
        provider,
      },
    });

    if (existingKey) {
      // Update existing key
      existingKey.apiKey = apiKey; // Will be encrypted by the setter
      existingKey.isActive = true;
      await existingKey.save();

      // Reinitialize AI service to pick up the new key
      await aiService.reinitialize();

      res.json({
        success: true,
        data: {
          id: existingKey.id,
          provider: existingKey.provider,
          isActive: existingKey.isActive,
        },
        message: `${provider} API key updated successfully`,
      });
    } else {
      // Create new key
      const newKey = await AIApiKey.create({
        customerId: DEMO_CUSTOMER_ID,
        provider,
        apiKey, // Will be encrypted by the setter
        isActive: true,
        lastUsedAt: null,
      });

      // Reinitialize AI service to pick up the new key
      await aiService.reinitialize();

      res.json({
        success: true,
        data: {
          id: newKey.id,
          provider: newKey.provider,
          isActive: newKey.isActive,
        },
        message: `${provider} API key saved successfully`,
      });
    }
  } catch (error: any) {
    console.error('Error saving AI API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save AI API key',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/admin/ai-api-keys/:provider
 * Delete an AI API key for a specific provider
 */
router.delete('/ai-api-keys/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;

    if (!Object.values(AIProvider).includes(provider as AIProvider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider',
        message: `Provider must be one of: ${Object.values(AIProvider).join(', ')}`,
      });
    }

    const DEMO_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000';

    const deleted = await AIApiKey.destroy({
      where: {
        customerId: DEMO_CUSTOMER_ID,
        provider,
      },
    });

    if (deleted) {
      // Reinitialize AI service to reflect the removed key
      await aiService.reinitialize();

      res.json({
        success: true,
        message: `${provider} API key deleted successfully`,
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Not found',
        message: `No API key found for provider: ${provider}`,
      });
    }
  } catch (error: any) {
    console.error('Error deleting AI API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete AI API key',
      message: error.message,
    });
  }
});

// ==========================================
// Buying Signal Config Routes
// ==========================================

/**
 * GET /api/admin/config/buying-signals
 * Get buying signal configuration
 */
router.get('/config/buying-signals', async (_req: Request, res: Response) => {
  try {
    const config = await adminSettings.getBuyingSignalConfig();
    res.json({ success: true, data: config });
  } catch (error: any) {
    console.error('Error fetching buying signal config:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch buying signal config', message: error.message });
  }
});

/**
 * PUT /api/admin/config/buying-signals
 * Save buying signal configuration
 */
router.put('/config/buying-signals', async (req: Request, res: Response) => {
  try {
    const session = req.session as any;
    const userId = session.userId || 'Unknown';
    const config = req.body;

    await adminSettings.setBuyingSignalConfig(config, userId);

    res.json({ success: true, data: config, message: 'Buying signal configuration updated' });
  } catch (error: any) {
    console.error('Error saving buying signal config:', error);
    res.status(400).json({ success: false, error: 'Failed to save buying signal config', message: error.message });
  }
});

/**
 * Async test job store — holds in-progress and completed test results.
 * Jobs expire after 5 minutes to prevent memory leaks.
 */
const testJobs = new Map<string, { status: 'processing' | 'done' | 'error'; data?: any; message?: string; createdAt: number }>();

// Cleanup expired jobs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of testJobs) {
    if (now - job.createdAt > 5 * 60 * 1000) testJobs.delete(id);
  }
}, 5 * 60 * 1000);

/**
 * POST /api/admin/config/buying-signals/test
 * Start an async news search test. Returns a jobId to poll for results.
 */
router.post('/config/buying-signals/test', async (req: Request, res: Response) => {
  try {
    const { accountName } = req.body;

    if (!accountName) {
      return res.status(400).json({ success: false, error: 'accountName is required' });
    }

    const config = await adminSettings.getBuyingSignalConfig();
    const { searchNewsForAccount } = await import('../services/newsSignalService');

    // Build prompt from config
    let prompt = config.newsPromptTemplate || '';
    const activeCategories = (config.signalCategories || []).filter(c => c.active);
    if (activeCategories.length > 0) {
      prompt += '\n\nSpecifically look for:\n';
      for (const cat of activeCategories) {
        prompt += `- ${cat.name}: ${cat.description}`;
        if (cat.keywords?.length > 0) prompt += ` (keywords: ${cat.keywords.join(', ')})`;
        prompt += '\n';
      }
    }

    // Generate a job ID and start the search in the background
    const jobId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    testJobs.set(jobId, { status: 'processing', createdAt: Date.now() });

    // Fire and forget — result stored in testJobs when done
    searchNewsForAccount(accountName, prompt, pool)
      .then(result => {
        testJobs.set(jobId, { status: 'done', data: result, createdAt: Date.now() });
      })
      .catch(error => {
        let message = error.message || 'Unknown error';
        const status = error?.status || error?.statusCode;
        if (status === 503 || message.includes('503')) {
          message = 'The AI service is temporarily overloaded. Please try again in a few minutes.';
        } else if (status === 401 || message.includes('401') || message.includes('authentication')) {
          message = 'Anthropic API key is invalid or expired. Please check your key in Admin > AI Config.';
        } else if (message.includes('not initialized') || message.includes('not configured')) {
          message = 'An Anthropic API key is required for web search. Please configure one in Admin > AI Config.';
        }
        console.error('Error testing news search:', error);
        testJobs.set(jobId, { status: 'error', message, createdAt: Date.now() });
      });

    // Return immediately with the job ID — frontend will poll
    res.json({ success: true, jobId, status: 'processing' });
  } catch (error: any) {
    console.error('Error starting news search test:', error);
    res.status(500).json({ success: false, error: 'Test search failed', message: error.message });
  }
});

/**
 * GET /api/admin/config/buying-signals/test/:jobId
 * Poll for async test results.
 */
router.get('/config/buying-signals/test/:jobId', async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = testJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found or expired' });
  }

  if (job.status === 'processing') {
    return res.json({ success: true, status: 'processing' });
  }

  if (job.status === 'error') {
    testJobs.delete(jobId);
    return res.json({ success: false, status: 'error', message: job.message });
  }

  // Done — return results and clean up
  testJobs.delete(jobId);
  res.json({ success: true, status: 'done', data: job.data });
});

/**
 * POST /api/admin/config/buying-signals/run-now
 * Trigger an immediate batch run
 */
router.post('/config/buying-signals/run-now', async (_req: Request, res: Response) => {
  try {
    const { runNightlyBatch } = await import('../services/signalScheduler');
    const result = await runNightlyBatch(pool);

    res.json({
      success: true,
      data: result,
      message: `Batch complete. Gong: ${result.gongCount}, News: ${result.newsCount}${result.errors.length > 0 ? `, Errors: ${result.errors.length}` : ''}`,
    });
  } catch (error: any) {
    console.error('Error running batch:', error);
    res.status(500).json({ success: false, error: 'Batch run failed', message: error.message });
  }
});

// ==========================================
// Gong Integration Admin Routes
// ==========================================

/**
 * PUT /api/admin/config/gong
 * Save Gong API credentials
 */
router.put('/config/gong', async (req: Request, res: Response) => {
  try {
    const { accessKey, secretKey } = req.body;
    const session = req.session as any;

    if (!accessKey || !secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Both accessKey and secretKey are required',
      });
    }

    const DEMO_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000';
    const credentials = JSON.stringify({ accessKey, secretKey });

    // Upsert Gong credentials
    const existing = await AIApiKey.findOne({
      where: { customerId: DEMO_CUSTOMER_ID, provider: AIProvider.GONG },
    });

    if (existing) {
      existing.apiKey = credentials;
      existing.isActive = true;
      await existing.save();
    } else {
      await AIApiKey.create({
        customerId: DEMO_CUSTOMER_ID,
        provider: AIProvider.GONG,
        apiKey: credentials,
        isActive: true,
      });
    }

    res.json({
      success: true,
      message: 'Gong credentials saved successfully',
    });
  } catch (error: any) {
    console.error('Error saving Gong credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save Gong credentials',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/config/gong/test
 * Test Gong API connection
 */
router.post('/config/gong/test', async (req: Request, res: Response) => {
  try {
    const { accessKey, secretKey } = req.body;

    if (!accessKey || !secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Both accessKey and secretKey are required',
      });
    }

    const { GongService } = await import('../services/gongService');
    const gongService = new GongService(accessKey, secretKey);
    const result = await gongService.testConnection();

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error testing Gong connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Gong connection',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/admin/config/gong
 * Remove Gong integration
 */
router.delete('/config/gong', async (req: Request, res: Response) => {
  try {
    const DEMO_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000';
    await AIApiKey.destroy({
      where: { customerId: DEMO_CUSTOMER_ID, provider: AIProvider.GONG },
    });

    res.json({
      success: true,
      message: 'Gong integration removed',
    });
  } catch (error: any) {
    console.error('Error removing Gong integration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove Gong integration',
      message: error.message,
    });
  }
});

export default router;
