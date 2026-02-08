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

// All admin routes require authentication and admin privileges
router.use(isAuthenticated);
router.use(isAdmin);

/**
 * GET /api/admin/config
 * Get current application configuration
 */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = configService.getConfig();

    // Add Salesforce field settings and hub layout from database
    const adminSettings = new AdminSettingsService(pool);
    const salesforceFields = await adminSettings.getSalesforceFieldConfig();
    const hubLayout = await adminSettings.getHubLayoutConfig();

    const forecastConfig = await adminSettings.getForecastConfig();

    res.json({
      success: true,
      data: {
        ...config,
        salesforceFields,
        hubLayout,
        forecastConfig,
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
router.put('/config/risk-rules', (req: Request, res: Response) => {
  try {
    const { rules } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    const updatedConfig = configService.updateRiskRules(rules, modifiedBy);

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
 * PUT /api/admin/config/priority-scoring
 * Update priority scoring configuration
 */
router.put('/config/priority-scoring', (req: Request, res: Response) => {
  try {
    const { priorityScoring } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    const updatedConfig = configService.updatePriorityScoring(priorityScoring, modifiedBy);

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
 * Update field mappings configuration
 */
router.put('/config/field-mappings', (req: Request, res: Response) => {
  try {
    const { mappings } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    const updatedConfig = configService.updateFieldMappings(mappings, modifiedBy);

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
router.put('/config/role-mappings', (req: Request, res: Response) => {
  try {
    const { mappings } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    const updatedConfig = configService.updateConfig({ roleMapping: mappings }, modifiedBy);

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
 * PUT /api/admin/config/display-settings
 * Update display settings configuration
 */
router.put('/config/display-settings', (req: Request, res: Response) => {
  try {
    const { displaySettings } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    const updatedConfig = configService.updateConfig({ displaySettings }, modifiedBy);

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
router.put('/config/opportunity-stages', (req: Request, res: Response) => {
  try {
    const { stages } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    const updatedConfig = configService.updateOpportunityStages(stages, modifiedBy);

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
    const { opportunityAmountField, forecastCategoryField } = req.body;
    const session = req.session as any;
    const userId = session.userId || 'Unknown';

    const adminSettings = new AdminSettingsService(pool);
    await adminSettings.setSalesforceFieldConfig(
      {
        opportunityAmountField: opportunityAmountField || 'Amount',
        forecastCategoryField: forecastCategoryField || 'ForecastCategory',
      },
      userId
    );

    res.json({
      success: true,
      data: {
        opportunityAmountField: opportunityAmountField || 'Amount',
        forecastCategoryField: forecastCategoryField || 'ForecastCategory',
      },
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

    const adminSettings = new AdminSettingsService(pool);
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
 * PUT /api/admin/config/hub-layout
 * Update Hub layout configuration
 */
router.put('/config/hub-layout', async (req: Request, res: Response) => {
  try {
    const { hubLayout } = req.body;
    const session = req.session as any;
    const userId = session.userId || 'Unknown';

    const adminSettings = new AdminSettingsService(pool);
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
    const adminSettings = new AdminSettingsService(pool);
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

    const adminSettings = new AdminSettingsService(pool);

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
router.post('/config/import', (req: Request, res: Response) => {
  try {
    const { configJson } = req.body;
    const session = req.session as any;
    const modifiedBy = session.userInfo?.name || 'Unknown';

    const updatedConfig = configService.importConfig(configJson, modifiedBy);

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
router.post('/config/reset', (_req: Request, res: Response) => {
  try {
    const config = configService.resetToDefaults();

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

export default router;
