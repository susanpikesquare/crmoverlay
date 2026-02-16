import { getRecommendation, clearRecommendationCache } from '../agentforceService';

// Ensure rule-based mode (not Agentforce)
beforeAll(() => {
  process.env.AGENTFORCE_ENABLED = 'false';
});

// Clear cache before each test
beforeEach(() => {
  clearRecommendationCache();
});

const mockConnection = {
  request: jest.fn(),
  query: jest.fn(),
} as any;

describe('getRecommendation', () => {
  it('returns rule-based recommendation when Agentforce disabled', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'acc001',
      data: { intentScore: 90, buyingStage: 'Decision' },
      promptType: 'ae_priority_account',
    });
    expect(result.text).toBeTruthy();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('returns cached recommendation on second call', async () => {
    const context = {
      objectType: 'Account' as const,
      recordId: 'cache-test',
      data: { intentScore: 85, buyingStage: 'Decision' },
      promptType: 'ae_priority_account',
    };
    const first = await getRecommendation(mockConnection, context);
    const second = await getRecommendation(mockConnection, context);
    expect(second).toEqual(first);
  });

  it('returns default recommendation for unknown prompt type', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'acc-unknown',
      data: {},
      promptType: 'unknown_type',
    });
    expect(result.text).toContain('Review this record');
    expect(result.confidence).toBe(0.5);
  });
});

describe('clearRecommendationCache', () => {
  it('clears cache for specific record', async () => {
    await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'clear-test',
      data: { intentScore: 90, buyingStage: 'Decision' },
      promptType: 'ae_priority_account',
    });
    clearRecommendationCache('clear-test');
    // No error, cache cleared successfully
  });

  it('clears all cache', () => {
    clearRecommendationCache();
    // No error, all cache cleared
  });
});

describe('ae_priority_account recommendations', () => {
  it('high intent + Decision stage', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'ae-high-decision',
      data: { intentScore: 90, buyingStage: 'Decision', industry: 'Tech' },
      promptType: 'ae_priority_account',
    });
    expect(result.text).toContain('High-priority');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.actions!.length).toBeGreaterThan(0);
  });

  it('high intent + Consideration stage', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'ae-high-consid',
      data: { intentScore: 82, buyingStage: 'Consideration', industry: 'Healthcare' },
      promptType: 'ae_priority_account',
    });
    expect(result.text).toContain('Strong buying intent');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('moderate intent', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'ae-mod',
      data: { intentScore: 72, buyingStage: 'Awareness' },
      promptType: 'ae_priority_account',
    });
    expect(result.text).toContain('Moderate intent');
  });

  it('adds signal-based insight for new hire', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'ae-signal',
      data: { intentScore: 90, buyingStage: 'Decision', signals: 'New VP hired recently' },
      promptType: 'ae_priority_account',
    });
    expect(result.text).toContain('executive hire');
  });

  it('adds large enterprise insight', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'ae-large',
      data: { intentScore: 90, buyingStage: 'Decision', employeeCount: 5000 },
      promptType: 'ae_priority_account',
    });
    expect(result.text).toContain('Large enterprise');
  });
});

describe('ae_at_risk_deal recommendations', () => {
  it('urgent stale deal (>21 days)', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Opportunity',
      recordId: 'ae-risk-stale',
      data: { daysSinceActivity: 25, meddpiccScore: 40 },
      promptType: 'ae_at_risk_deal',
    });
    expect(result.text).toContain('URGENT');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('needs attention (14-21 days)', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Opportunity',
      recordId: 'ae-risk-warn',
      data: { daysSinceActivity: 16, meddpiccScore: 65 },
      promptType: 'ae_at_risk_deal',
    });
    expect(result.text).toContain('needs attention');
  });

  it('low MEDDPICC with missing elements', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Opportunity',
      recordId: 'ae-risk-meddpicc',
      data: {
        daysSinceActivity: 5,
        meddpiccScore: 35,
        missingElements: ['Economic Buyer', 'Champion', 'Decision Process'],
      },
      promptType: 'ae_at_risk_deal',
    });
    expect(result.text).toContain('Economic Buyer');
    expect(result.text).toContain('Champion');
  });

  it('high-value deal escalation', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Opportunity',
      recordId: 'ae-risk-hv',
      data: { daysSinceActivity: 25, meddpiccScore: 60, amount: 500000 },
      promptType: 'ae_at_risk_deal',
    });
    expect(result.text).toContain('escalate');
  });
});

describe('am_renewal_risk recommendations', () => {
  it('critical renewal (<30 days, low health)', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'am-crit',
      data: { daysToRenewal: 20, healthScore: 45, contractValue: 200000 },
      promptType: 'am_renewal_risk',
    });
    expect(result.text).toContain('CRITICAL');
    expect(result.actions!.length).toBeGreaterThanOrEqual(3);
  });

  it('warning renewal (30-60 days)', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'am-warn',
      data: { daysToRenewal: 45, healthScore: 60 },
      promptType: 'am_renewal_risk',
    });
    expect(result.text).toContain('at risk');
  });

  it('champion left risk factor', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'am-champ',
      data: { daysToRenewal: 25, healthScore: 50, riskFactors: ['Champion left'] },
      promptType: 'am_renewal_risk',
    });
    expect(result.text).toContain('Champion departure');
  });

  it('usage down risk factor', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'am-usage',
      data: { daysToRenewal: 25, healthScore: 50, riskFactors: ['Usage down'] },
      promptType: 'am_renewal_risk',
    });
    expect(result.text).toContain('Usage declining');
  });
});

describe('am_expansion recommendations', () => {
  it('perfect expansion opportunity', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'am-exp',
      data: { healthScore: 90, usagePercent: 95, employeeGrowth: 20, currentValue: 100000 },
      promptType: 'am_expansion',
    });
    expect(result.text).toContain('expansion opportunity');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('growth-based expansion', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'am-growth',
      data: { healthScore: 78, usagePercent: 60, employeeGrowth: 25 },
      promptType: 'am_expansion',
    });
    expect(result.text).toContain('growing rapidly');
  });
});

describe('csm_health_intervention recommendations', () => {
  it('critical health score', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'csm-crit',
      data: { healthScore: 30, healthTrend: 'declining', daysSinceTouch: 40 },
      promptType: 'csm_health_intervention',
    });
    expect(result.text).toContain('CRITICAL');
    expect(result.actions!.length).toBeGreaterThanOrEqual(3);
  });

  it('declining health', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'csm-decline',
      data: { healthScore: 55, healthTrend: 'declining' },
      promptType: 'csm_health_intervention',
    });
    expect(result.text).toContain('declining');
  });

  it('missing executive sponsor', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'csm-nosponsor',
      data: { healthScore: 35, riskFactors: ['No executive sponsor'] },
      promptType: 'csm_health_intervention',
    });
    expect(result.text).toContain('executive sponsor');
  });

  it('long time since last touch', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'csm-stale',
      data: { healthScore: 50, healthTrend: 'declining', daysSinceTouch: 45 },
      promptType: 'csm_health_intervention',
    });
    expect(result.text).toContain('45 days ago');
  });
});

describe('csm_adoption recommendations', () => {
  it('low mobile usage for mobile-first industry', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'csm-mobile',
      data: { adoptionRate: 70, mobileUsage: 15, industry: 'Retail' },
      promptType: 'csm_adoption',
    });
    expect(result.text).toContain('mobile usage');
    expect(result.text).toContain('Mobile Learning');
  });

  it('low overall adoption', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'csm-lowadopt',
      data: { adoptionRate: 40, mobileUsage: 50, industry: 'Finance' },
      promptType: 'csm_adoption',
    });
    expect(result.text).toContain('Adoption at 40%');
  });

  it('good adoption with feature expansion opportunity', async () => {
    const result = await getRecommendation(mockConnection, {
      objectType: 'Account',
      recordId: 'csm-expand',
      data: { adoptionRate: 85, featureAdoption: 50, industry: 'Tech' },
      promptType: 'csm_adoption',
    });
    expect(result.text).toContain('Strong adoption');
  });
});
