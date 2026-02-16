import { AdminSettingsService } from '../adminSettings';
import { createMockPool } from '../../__tests__/helpers/mocks';

let pool: ReturnType<typeof createMockPool>;
let service: AdminSettingsService;

beforeEach(() => {
  pool = createMockPool();
  service = new AdminSettingsService(pool as any);
});

describe('getAIProviderConfig', () => {
  it('returns stored config when present', async () => {
    const stored = { provider: 'anthropic', enabled: true, model: 'claude-3' };
    pool.query.mockResolvedValueOnce({ rows: [{ setting_value: stored }] });

    const result = await service.getAIProviderConfig();
    expect(result).toEqual(stored);
  });

  it('returns env-based fallback when no rows', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.getAIProviderConfig();
    // Should return a config object (either env-based or none)
    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('enabled');
  });
});

describe('getAccountTierOverrides', () => {
  it('returns empty object when no overrides stored', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.getAccountTierOverrides();
    expect(result).toEqual({});
  });

  it('returns stored overrides', async () => {
    const overrides = {
      '001ABC': { accountId: '001ABC', tier: 'hot', overriddenBy: 'admin', overriddenAt: '2025-01-01' },
    };
    pool.query.mockResolvedValueOnce({ rows: [{ setting_value: overrides }] });

    const result = await service.getAccountTierOverrides();
    expect(result['001ABC'].tier).toBe('hot');
  });
});

describe('setAccountTierOverride', () => {
  it('upserts an override into the map', async () => {
    // First call: getAccountTierOverrides returns empty
    pool.query.mockResolvedValueOnce({ rows: [] });
    // Second call: upsert
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.setAccountTierOverride('001X', { tier: 'warm', reason: 'Strategic' }, 'admin');
    expect(result['001X']).toBeDefined();
    expect(result['001X'].tier).toBe('warm');
    expect(result['001X'].reason).toBe('Strategic');
  });

  it('removes override when tier is null', async () => {
    const existing = {
      '001X': { accountId: '001X', tier: 'hot', overriddenBy: 'admin', overriddenAt: '2025-01-01' },
    };
    pool.query.mockResolvedValueOnce({ rows: [{ setting_value: existing }] });
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.setAccountTierOverride('001X', { tier: null }, 'admin');
    expect(result['001X']).toBeUndefined();
  });
});

describe('getForecastConfig', () => {
  it('returns defaults when no rows exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.getForecastConfig();
    expect(result.forecastMethod).toBe('forecastCategory');
    expect(result.commitProbability).toBe(90);
    expect(result.quotaSource).toBe('none');
    expect(result.defaultQuota).toBe(0);
  });

  it('fills in missing fields with defaults', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ setting_value: { forecastMethod: 'probability' } }],
    });

    const result = await service.getForecastConfig();
    expect(result.forecastMethod).toBe('probability');
    expect(result.commitProbability).toBe(90); // default filled in
  });
});

describe('getSalesforceFieldConfig', () => {
  it('returns stored config', async () => {
    const stored = { opportunityAmountField: 'New_ARR__c', forecastCategoryField: 'Custom_FC__c' };
    pool.query.mockResolvedValueOnce({ rows: [{ setting_value: stored }] });

    const result = await service.getSalesforceFieldConfig();
    expect(result.opportunityAmountField).toBe('New_ARR__c');
    expect(result.forecastCategoryField).toBe('Custom_FC__c');
  });

  it('returns defaults when no rows', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.getSalesforceFieldConfig();
    expect(result.opportunityAmountField).toBe('Amount');
    expect(result.forecastCategoryField).toBe('Forecast_Category__c');
  });

  it('fills in missing forecastCategoryField with default', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ setting_value: { opportunityAmountField: 'ARR__c' } }] });

    const result = await service.getSalesforceFieldConfig();
    expect(result.opportunityAmountField).toBe('ARR__c');
    expect(result.forecastCategoryField).toBe('Forecast_Category__c');
  });
});

describe('setAIProviderConfig', () => {
  it('upserts AI provider config', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await service.setAIProviderConfig({ provider: 'openai', enabled: true, model: 'gpt-4' }, 'admin');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_settings'),
      expect.arrayContaining(['ai_provider'])
    );
  });
});

describe('getBrandingConfig', () => {
  it('returns null when no branding stored', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.getBrandingConfig();
    expect(result).toBeNull();
  });

  it('returns stored branding', async () => {
    const branding = { brandName: 'TestCo', logoBase64: 'abc', logoHeight: 40 };
    pool.query.mockResolvedValueOnce({ rows: [{ setting_value: branding }] });

    const result = await service.getBrandingConfig();
    expect(result!.brandName).toBe('TestCo');
  });
});

describe('setBrandingConfig', () => {
  it('deletes branding when config is null', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await service.setBrandingConfig(null, 'admin');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE'),
      ['branding']
    );
  });

  it('upserts branding when config is provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await service.setBrandingConfig({ brandName: 'Test', logoBase64: 'x', logoHeight: 30 }, 'admin');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_settings'),
      expect.arrayContaining(['branding'])
    );
  });
});

describe('getOpportunityDetailConfig', () => {
  it('returns default config when no rows', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.getOpportunityDetailConfig();
    expect(result.sections).toBeDefined();
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.sections[0].id).toBe('meddpicc');
  });

  it('returns stored config', async () => {
    const stored = { sections: [{ id: 'custom', label: 'Custom', enabled: true, order: 1, fields: [] }] };
    pool.query.mockResolvedValueOnce({ rows: [{ setting_value: stored }] });

    const result = await service.getOpportunityDetailConfig();
    expect(result.sections[0].id).toBe('custom');
  });
});

describe('getAppConfig / saveAppConfig', () => {
  it('returns null when no app config', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await service.getAppConfig();
    expect(result).toBeNull();
  });

  it('returns stored app config', async () => {
    const config = { theme: 'dark' };
    pool.query.mockResolvedValueOnce({ rows: [{ setting_value: config }] });
    const result = await service.getAppConfig();
    expect(result).toEqual(config);
  });

  it('saves app config', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await service.saveAppConfig({ theme: 'light' }, 'admin');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_settings'),
      expect.arrayContaining(['app_config'])
    );
  });
});

describe('initializeSettingsTable', () => {
  it('creates table and inserts defaults', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await service.initializeSettingsTable();

    // Should call query for: CREATE TABLE, ai_provider, salesforce_fields, hub_layout
    expect(pool.query).toHaveBeenCalledTimes(4);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS admin_settings'),
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (setting_key) DO NOTHING'),
      expect.arrayContaining(['ai_provider']),
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (setting_key) DO NOTHING'),
      expect.arrayContaining(['salesforce_fields']),
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (setting_key) DO NOTHING'),
      expect.arrayContaining(['hub_layout']),
    );
  });
});

describe('getAllSettings', () => {
  it('aggregates all settings', async () => {
    // getAIProviderConfig query
    pool.query.mockResolvedValueOnce({
      rows: [{ setting_value: { provider: 'anthropic', enabled: true } }],
    });
    // getSalesforceFieldConfig query
    pool.query.mockResolvedValueOnce({
      rows: [{ setting_value: { opportunityAmountField: 'Amount' } }],
    });
    // getHubLayoutConfig query
    pool.query.mockResolvedValueOnce({ rows: [] });
    // getAllSettings own query for updated_at/updated_by
    pool.query.mockResolvedValueOnce({
      rows: [{ updated_at: '2025-06-01', updated_by: 'admin' }],
    });

    const result = await service.getAllSettings('admin');
    expect(result.aiProvider).toEqual({ provider: 'anthropic', enabled: true });
    expect(result.salesforceFields.opportunityAmountField).toBe('Amount');
    expect(result.hubLayout).toBeDefined();
    expect(result.updatedAt).toBe('2025-06-01');
    expect(result.updatedBy).toBe('admin');
  });

  it('uses defaults when no updated_at row exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // ai provider
    pool.query.mockResolvedValueOnce({ rows: [] }); // sf fields
    pool.query.mockResolvedValueOnce({ rows: [] }); // hub layout
    pool.query.mockResolvedValueOnce({ rows: [] }); // updated_at query

    const result = await service.getAllSettings('admin');
    expect(result.updatedBy).toBe('system');
    expect(result.updatedAt).toBeTruthy();
  });
});

describe('getEnvBasedConfig (via getAIProviderConfig)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns anthropic config when ANTHROPIC_API_KEY is set', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // no stored config
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;

    const result = await service.getAIProviderConfig();
    expect(result.provider).toBe('anthropic');
    expect(result.enabled).toBe(true);
    expect(result.model).toBe('claude-3-5-sonnet-20241022');
  });

  it('returns openai config when OPENAI_API_KEY is set', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.GOOGLE_AI_API_KEY;

    const result = await service.getAIProviderConfig();
    expect(result.provider).toBe('openai');
    expect(result.enabled).toBe(true);
    expect(result.model).toBe('gpt-4-turbo-preview');
  });

  it('returns openai with Azure endpoint when configured', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://my-azure.openai.azure.com';
    delete process.env.GOOGLE_AI_API_KEY;

    const result = await service.getAIProviderConfig();
    expect(result.provider).toBe('openai');
    expect(result.customEndpoint).toBe('https://my-azure.openai.azure.com');
  });

  it('returns gemini config when GOOGLE_AI_API_KEY is set', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.GOOGLE_AI_API_KEY = 'test-gemini-key';

    const result = await service.getAIProviderConfig();
    expect(result.provider).toBe('gemini');
    expect(result.enabled).toBe(true);
    expect(result.model).toBe('gemini-pro');
  });

  it('returns none when no API keys are set', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;

    const result = await service.getAIProviderConfig();
    expect(result.provider).toBe('none');
    expect(result.enabled).toBe(false);
  });
});

describe('getHubLayoutConfig', () => {
  it('migrates missing priorities and at-risk-deals in existing executive config', async () => {
    const stored = {
      ae: { sections: [], customLinks: [] },
      am: { sections: [], customLinks: [] },
      csm: { sections: [], customLinks: [] },
      salesLeader: { sections: [], customLinks: [] },
      executive: {
        sections: [{ id: 'metrics', name: 'Metrics', enabled: true, order: 1 }],
        customLinks: [],
      },
    };
    pool.query.mockResolvedValueOnce({ rows: [{ setting_value: stored }] });

    const result = await service.getHubLayoutConfig();
    const sectionIds = result.executive.sections.map((s: any) => s.id);
    expect(sectionIds).toContain('priorities');
    expect(sectionIds).toContain('at-risk-deals');
  });

  it('adds executive config when missing (backward compat)', async () => {
    const stored = {
      ae: { sections: [], customLinks: [] },
      am: { sections: [], customLinks: [] },
      csm: { sections: [], customLinks: [] },
      salesLeader: { sections: [], customLinks: [] },
      // executive intentionally missing
    };
    pool.query.mockResolvedValueOnce({ rows: [{ setting_value: stored }] });

    const result = await service.getHubLayoutConfig();
    expect(result.executive).toBeDefined();
    expect(result.executive.sections.length).toBeGreaterThan(0);
  });

  it('returns default layout when no rows', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.getHubLayoutConfig();
    expect(result.ae).toBeDefined();
    expect(result.executive).toBeDefined();
  });
});
