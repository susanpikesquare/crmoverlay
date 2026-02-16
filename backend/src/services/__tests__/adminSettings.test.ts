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

describe('getHubLayoutConfig', () => {
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
