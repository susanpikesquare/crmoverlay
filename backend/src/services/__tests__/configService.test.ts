import {
  getConfig,
  updateConfig,
  updatePriorityScoring,
  updateRiskRules,
  resetToDefaults,
  importConfig,
  exportConfig,
  getQuotaFieldName,
  AppConfig,
  PriorityConfig,
  RiskRule,
} from '../configService';

// Reset to clean state before each test
beforeEach(() => {
  resetToDefaults();
});

describe('getConfig', () => {
  it('returns a config with expected top-level keys', () => {
    const config = getConfig();
    expect(config).toHaveProperty('riskRules');
    expect(config).toHaveProperty('priorityScoring');
    expect(config).toHaveProperty('fieldMappings');
    expect(config).toHaveProperty('roleMapping');
    expect(config).toHaveProperty('displaySettings');
    expect(Array.isArray(config.riskRules)).toBe(true);
  });

  it('returns a copy, not the original reference', () => {
    const a = getConfig();
    const b = getConfig();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe('updateConfig', () => {
  it('merges partial config and sets lastModified', () => {
    const result = updateConfig({ displaySettings: { accountsPerPage: 25, dealsPerPage: 8, defaultSort: 'priority', viewMode: 'table' } }, 'admin@test.com');
    expect(result.displaySettings.accountsPerPage).toBe(25);
    expect(result.lastModified).toBeDefined();
    expect(result.lastModified!.by).toBe('admin@test.com');
  });
});

describe('updatePriorityScoring', () => {
  it('throws when default weights do not sum to 100', () => {
    const badConfig: PriorityConfig = {
      components: [
        { id: 'a', name: 'A', weight: 50 },
        { id: 'b', name: 'B', weight: 30 },
      ],
      thresholds: { hot: { min: 85, max: 100 }, warm: { min: 65, max: 84 }, cool: { min: 40, max: 64 }, cold: { min: 0, max: 39 } },
    };
    expect(() => updatePriorityScoring(badConfig, 'user')).toThrow('must sum to 100%');
  });

  it('throws when role-specific weights do not sum to 100', () => {
    const config: PriorityConfig = {
      components: [
        { id: 'a', name: 'A', weight: 60 },
        { id: 'b', name: 'B', weight: 40 },
      ],
      thresholds: { hot: { min: 85, max: 100 }, warm: { min: 65, max: 84 }, cool: { min: 40, max: 64 }, cold: { min: 0, max: 39 } },
      roleConfigs: {
        ae: {
          componentWeights: { a: 70, b: 20 },
          thresholds: { hot: { min: 85, max: 100 }, warm: { min: 65, max: 84 }, cool: { min: 40, max: 64 }, cold: { min: 0, max: 39 } },
        },
      },
    };
    expect(() => updatePriorityScoring(config, 'user')).toThrow('AE component weights must sum to 100%');
  });

  it('accepts valid config with weights summing to 100', () => {
    const config: PriorityConfig = {
      components: [
        { id: 'a', name: 'A', weight: 60 },
        { id: 'b', name: 'B', weight: 40 },
      ],
      thresholds: { hot: { min: 85, max: 100 }, warm: { min: 65, max: 84 }, cool: { min: 40, max: 64 }, cold: { min: 0, max: 39 } },
    };
    const result = updatePriorityScoring(config, 'user');
    expect(result.priorityScoring.components).toHaveLength(2);
  });
});

describe('updateRiskRules', () => {
  it('replaces the rules array', () => {
    const newRules: RiskRule[] = [
      {
        id: 'test_rule',
        name: 'Test Rule',
        objectType: 'Account',
        conditions: [{ field: 'Rating', operator: '=', value: 'Cold' }],
        logic: 'AND',
        flag: 'warning',
        active: true,
      },
    ];
    const result = updateRiskRules(newRules, 'admin');
    expect(result.riskRules).toHaveLength(1);
    expect(result.riskRules[0].id).toBe('test_rule');
  });
});

describe('resetToDefaults', () => {
  it('restores defaults after modification', () => {
    const original = getConfig();
    updateConfig({ displaySettings: { accountsPerPage: 99, dealsPerPage: 99, defaultSort: 'name', viewMode: 'cards' } }, 'user');
    resetToDefaults();
    const restored = getConfig();
    expect(restored.displaySettings.accountsPerPage).toBe(original.displaySettings.accountsPerPage);
    expect(restored.lastModified).toBeUndefined();
  });
});

describe('importConfig / exportConfig', () => {
  it('throws on invalid JSON (missing required keys)', () => {
    const invalid = JSON.stringify({ riskRules: [] });
    expect(() => importConfig(invalid, 'user')).toThrow('Invalid configuration JSON');
  });

  it('round-trips correctly via export then import', () => {
    const exported = exportConfig();
    const imported = importConfig(exported, 'round-trip-user');
    expect(imported.riskRules).toEqual(getConfig().riskRules);
    expect(imported.lastModified!.by).toBe('round-trip-user');
  });
});

describe('getQuotaFieldName', () => {
  it('returns Annual_Quota__c for annual', () => {
    expect(getQuotaFieldName('annual')).toBe('Annual_Quota__c');
  });

  it('returns Quarterly_Quota__c for quarterly', () => {
    expect(getQuotaFieldName('quarterly')).toBe('Quarterly_Quota__c');
  });

  it('returns Monthly_Quota__c for monthly', () => {
    expect(getQuotaFieldName('monthly')).toBe('Monthly_Quota__c');
  });
});
