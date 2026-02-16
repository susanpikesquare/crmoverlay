import {
  extractDomainKey,
  groupAccountsByDomain,
  calculateMEDDPICCScore,
  daysBetween,
  getAEMetrics,
  getPriorityAccounts,
  getAtRiskDeals,
  getRenewalAccounts,
  getAMMetrics,
  getCSMMetrics,
  getAtRiskAccounts,
  getOpportunityTimeline,
  getExecutiveMetrics,
  getUnderutilizedAccounts,
  getExecutiveAtRiskDeals,
} from '../hubData';

// Mock agentforce to avoid real AI calls
jest.mock('../agentforceService', () => ({
  getRecommendation: jest.fn().mockResolvedValue({
    text: 'AI recommendation text',
    confidence: 0.9,
    actions: [],
  }),
  clearRecommendationCache: jest.fn(),
}));

// Mock AdminSettingsService
jest.mock('../adminSettings', () => ({
  AdminSettingsService: jest.fn().mockImplementation(() => ({
    getSalesforceFieldConfig: jest.fn().mockResolvedValue({
      opportunityAmountField: 'Amount',
      forecastCategoryField: 'ForecastCategory',
    }),
  })),
  // Re-export AccountTierOverrides type as empty for compatibility
}));

function createMockConnection(queryResponses: Record<string, any> = {}) {
  let callIndex = 0;
  const responses = Object.values(queryResponses);
  return {
    query: jest.fn().mockImplementation(() => {
      if (callIndex < responses.length) {
        return Promise.resolve(responses[callIndex++]);
      }
      return Promise.resolve({ records: [], totalSize: 0 });
    }),
    sobject: jest.fn(),
  } as any;
}

function createMockPool() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  } as any;
}

// ============================================================
// Pure utility tests
// ============================================================

describe('daysBetween', () => {
  it('returns 0 for the same date', () => {
    expect(daysBetween('2025-01-15', '2025-01-15')).toBe(0);
  });

  it('returns correct number of days', () => {
    expect(daysBetween('2025-01-01', '2025-01-11')).toBe(10);
  });

  it('is symmetric (order does not matter)', () => {
    expect(daysBetween('2025-03-01', '2025-01-01')).toBe(daysBetween('2025-01-01', '2025-03-01'));
  });

  it('handles Date objects', () => {
    expect(daysBetween(new Date('2025-06-01'), new Date('2025-06-08'))).toBe(7);
  });
});

describe('extractDomainKey', () => {
  it('removes common suffixes like Inc, LLC', () => {
    expect(extractDomainKey('Acme Inc')).toBe('acme');
  });

  it('extracts last significant word for multi-word names', () => {
    expect(extractDomainKey('Park Hyatt')).toBe('hyatt');
    expect(extractDomainKey('Grand Hyatt')).toBe('hyatt');
  });

  it('returns full cleaned name for short last words', () => {
    // last word "AI" is only 2 chars
    expect(extractDomainKey('Open AI')).toBe('openai');
  });

  it('removes Corp suffix', () => {
    expect(extractDomainKey('TechCorp Corp')).toBe('techcorp');
  });
});

describe('groupAccountsByDomain', () => {
  it('returns single accounts ungrouped', () => {
    const accounts = [{ Name: 'UniqueCompany Inc', intentScore: 80 }];
    const result = groupAccountsByDomain(accounts);
    expect(result).toHaveLength(1);
    expect(result[0].isGroup).toBeUndefined();
  });

  it('groups accounts sharing the same domain key', () => {
    const accounts = [
      { Name: 'Park Hyatt', intentScore: 90 },
      { Name: 'Grand Hyatt', intentScore: 60 },
    ];
    const result = groupAccountsByDomain(accounts);
    expect(result).toHaveLength(1);
    expect(result[0].isGroup).toBe(true);
    expect(result[0].groupCount).toBe(2);
  });

  it('uses highest intent score account as representative', () => {
    const accounts = [
      { Name: 'Park Hyatt', intentScore: 50 },
      { Name: 'Grand Hyatt', intentScore: 95 },
    ];
    const result = groupAccountsByDomain(accounts);
    expect(result[0].intentScore).toBe(95);
  });

  it('aggregates employee counts for groups', () => {
    const accounts = [
      { Name: 'Park Hyatt', intentScore: 50, employeeCount: 100 },
      { Name: 'Grand Hyatt', intentScore: 95, employeeCount: 200 },
    ];
    const result = groupAccountsByDomain(accounts);
    expect(result[0].employeeCount).toBe(300);
  });
});

describe('calculateMEDDPICCScore', () => {
  it('returns Probability when set', () => {
    const opp = { Probability: 75 } as any;
    expect(calculateMEDDPICCScore(opp)).toBe(75);
  });

  it('returns base score of 30 when no fields present', () => {
    const opp = {} as any;
    expect(calculateMEDDPICCScore(opp)).toBe(30);
  });

  it('adds points for NextStep, Description, and advanced StageName', () => {
    const opp = {
      NextStep: 'Follow up call',
      Description: 'A'.repeat(60),
      StageName: 'Negotiation',
    } as any;
    // 30 base + 20 NextStep + 15 Description + 15 StageName = 80
    expect(calculateMEDDPICCScore(opp)).toBe(80);
  });

  it('caps score at 100', () => {
    const opp = {
      Probability: undefined,
      NextStep: 'Follow up',
      Description: 'A'.repeat(60),
      StageName: 'Negotiation',
    } as any;
    expect(calculateMEDDPICCScore(opp)).toBeLessThanOrEqual(100);
  });
});

// ============================================================
// Async function tests (with mocked dependencies)
// ============================================================

describe('getAEMetrics', () => {
  it('calculates annual metrics correctly', async () => {
    const conn = createMockConnection({
      user: { records: [{ Id: 'u1', Annual_Quota__c: 2000000 }] },
      closedWon: { records: [{ Id: 'o1', Amount: 500000 }, { Id: 'o2', Amount: 300000 }] },
      pipeline: { records: [{ Id: 'o3', Amount: 200000 }, { Id: 'o4', Amount: 400000 }] },
      hotProspects: { records: [{ Id: 'a1' }, { Id: 'a2' }, { Id: 'a3' }] },
    });
    const pool = createMockPool();

    const metrics = await getAEMetrics(conn, 'u1', pool);

    expect(metrics.quotaAttainmentYTD).toBeGreaterThan(0);
    expect(metrics.pipelineCoverage).toBeGreaterThan(0);
    expect(metrics.hotProspectsCount).toBe(3);
    expect(metrics.avgDealSize).toBe(300000); // (200000+400000)/2
  });

  it('returns zero metrics on error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;
    const pool = createMockPool();

    const metrics = await getAEMetrics(conn, 'u1', pool);

    expect(metrics.quotaAttainmentYTD).toBe(0);
    expect(metrics.pipelineCoverage).toBe(0);
    expect(metrics.hotProspectsCount).toBe(0);
    expect(metrics.avgDealSize).toBe(0);
  });

  it('handles quarterly timeframe', async () => {
    const conn = createMockConnection({
      user: { records: [] },
      closedWon: { records: [] },
      pipeline: { records: [] },
      hotProspects: { records: [] },
    });
    const pool = createMockPool();

    const metrics = await getAEMetrics(conn, 'u1', pool, 'quarterly');

    expect(metrics).toHaveProperty('quotaAttainmentYTD');
    expect(metrics).toHaveProperty('pipelineCoverage');
  });
});

describe('getPriorityAccounts', () => {
  it('returns priority accounts with calculated scores', async () => {
    const conn = createMockConnection({
      accounts: {
        records: [{
          Id: 'a1',
          Name: 'BigCorp Inc',
          NumberOfEmployees: 2000,
          AnnualRevenue: 15000000,
          Type: 'Prospect',
          Industry: 'Technology',
          LastModifiedDate: new Date(Date.now() - 3 * 86400000).toISOString(),
        }],
      },
    });

    const result = await getPriorityAccounts(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].intentScore).toBeGreaterThanOrEqual(75); // >1000 employees (+20) + >10M revenue (+15) = 85
    expect(result[0].priorityTier).toBe('🔥 Hot');
    expect(result[0].aiRecommendation).toBeTruthy();
  });

  it('assigns warm tier for moderate scores', async () => {
    const conn = createMockConnection({
      accounts: {
        records: [{
          Id: 'a2',
          Name: 'MediumCo',
          NumberOfEmployees: 600,
          AnnualRevenue: 500000,
          Type: 'Customer',
          LastModifiedDate: new Date().toISOString(),
        }],
      },
    });

    const result = await getPriorityAccounts(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].intentScore).toBeGreaterThanOrEqual(60);
    expect(result[0].intentScore).toBeLessThan(75);
    expect(result[0].priorityTier).toBe('🔶 Warm');
  });

  it('applies tier overrides', async () => {
    const conn = createMockConnection({
      accounts: {
        records: [{
          Id: 'a3',
          Name: 'SmallCo',
          NumberOfEmployees: 200,
          AnnualRevenue: 200000,
          Type: 'Prospect',
          LastModifiedDate: new Date().toISOString(),
        }],
      },
    });

    const overrides = {
      a3: { accountId: 'a3', tier: 'hot', overriddenBy: 'admin', overriddenAt: new Date().toISOString() },
    };

    const result = await getPriorityAccounts(conn, 'u1', overrides as any);

    expect(result).toHaveLength(1);
    expect(result[0].priorityTier).toBe('🔥 Hot');
    expect(result[0].isOverridden).toBe(true);
  });

  it('returns empty array on error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;

    const result = await getPriorityAccounts(conn, 'u1');

    expect(result).toEqual([]);
  });
});

describe('getAtRiskDeals', () => {
  it('identifies stale deals with warnings', async () => {
    const staleDate = new Date(Date.now() - 25 * 86400000).toISOString();
    const conn = createMockConnection({
      opps: {
        records: [{
          Id: 'o1',
          Name: 'Stale Deal',
          Amount: 100000,
          StageName: 'Negotiation',
          CloseDate: '2025-12-01',
          LastModifiedDate: staleDate,
          Account: { Name: 'TestCo' },
          NextStep: '',
          Probability: 40,
        }],
      },
    });
    const pool = createMockPool();

    const result = await getAtRiskDeals(conn, 'u1', pool);

    expect(result).toHaveLength(1);
    expect(result[0].daysStale).toBeGreaterThanOrEqual(14);
    expect(result[0].warning).toBeTruthy();
    expect(result[0].aiRecommendation).toBeTruthy();
  });

  it('filters out deals less than 14 days stale', async () => {
    const recentDate = new Date(Date.now() - 5 * 86400000).toISOString();
    const conn = createMockConnection({
      opps: {
        records: [{
          Id: 'o2',
          Name: 'Recent Deal',
          Amount: 50000,
          StageName: 'Discovery',
          CloseDate: '2025-12-01',
          LastModifiedDate: recentDate,
          Account: { Name: 'TestCo' },
          NextStep: 'Follow up',
        }],
      },
    });
    const pool = createMockPool();

    const result = await getAtRiskDeals(conn, 'u1', pool);

    expect(result).toHaveLength(0);
  });

  it('generates different warnings based on staleness level', async () => {
    const stale32 = new Date(Date.now() - 32 * 86400000).toISOString();
    const stale17 = new Date(Date.now() - 17 * 86400000).toISOString();
    const conn = createMockConnection({
      opps: {
        records: [
          {
            Id: 'o3',
            Name: 'Very Stale',
            Amount: 200000,
            StageName: 'Proposal',
            LastModifiedDate: stale32,
            Account: { Name: 'Corp1' },
            NextStep: 'Review proposal',
          },
          {
            Id: 'o4',
            Name: 'Mildly Stale',
            Amount: 75000,
            StageName: 'Discovery',
            LastModifiedDate: stale17,
            Account: { Name: 'Corp2' },
            NextStep: '',
          },
        ],
      },
    });
    const pool = createMockPool();

    const result = await getAtRiskDeals(conn, 'u1', pool);

    expect(result).toHaveLength(2);
    // Very stale (>30 days) gets the strongest warning
    const veryStale = result.find(d => d.Id === 'o3');
    expect(veryStale!.warning).toContain('No activity');
    // Mildly stale with no next step
    const mild = result.find(d => d.Id === 'o4');
    expect(mild!.warning).toContain('days since last update');
    expect(mild!.warning).toContain('No next step');
  });

  it('returns empty array on error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;
    const pool = createMockPool();

    const result = await getAtRiskDeals(conn, 'u1', pool);

    expect(result).toEqual([]);
  });
});

describe('getRenewalAccounts', () => {
  it('classifies at-risk renewals correctly', async () => {
    const conn = createMockConnection({
      accounts: {
        records: [{
          Id: 'a1',
          Name: 'AtRiskCo',
          Risk__c: 'Red',
          Agreement_Expiry_Date__c: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          Total_ARR__c: 150000,
          Current_Gainsight_Score__c: 40,
          Last_QBR__c: null,
        }],
      },
    });

    const result = await getRenewalAccounts(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].renewalRisk).toBe('At Risk');
    expect(result[0].keySignals).toContain('Low health score: 40');
    expect(result[0].keySignals).toContain('QBR overdue');
    expect(result[0].aiRecommendation).toBeTruthy();
  });

  it('classifies expansion opportunity correctly', async () => {
    const conn = createMockConnection({
      accounts: {
        records: [{
          Id: 'a2',
          Name: 'ExpandCo',
          Risk__c: 'Green',
          Agreement_Expiry_Date__c: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
          Total_ARR__c: 200000,
          Current_Gainsight_Score__c: 90,
          of_Axonify_Users__c: 1000,
          Last_QBR__c: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        }],
      },
    });

    const result = await getRenewalAccounts(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].renewalRisk).toBe('Expansion Opportunity');
  });

  it('classifies on-track renewals correctly', async () => {
    const conn = createMockConnection({
      accounts: {
        records: [{
          Id: 'a3',
          Name: 'SteadyCo',
          Risk__c: 'Green',
          Agreement_Expiry_Date__c: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
          Total_ARR__c: 100000,
          Current_Gainsight_Score__c: 70,
          of_Axonify_Users__c: 200,
          Last_QBR__c: new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0],
        }],
      },
    });

    const result = await getRenewalAccounts(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].renewalRisk).toBe('On Track');
    expect(result[0].aiRecommendation).toContain('Renewal tracking well');
  });

  it('adds risk notes signal when present', async () => {
    const conn = createMockConnection({
      accounts: {
        records: [{
          Id: 'a4',
          Name: 'RiskyCo',
          Risk__c: 'Red',
          Agreement_Expiry_Date__c: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
          Current_Gainsight_Score__c: 50,
          Risk_Notes__c: 'Champion left',
          Last_QBR__c: null,
        }],
      },
    });

    const result = await getRenewalAccounts(conn, 'u1');

    expect(result[0].keySignals).toContain('Has risk notes');
  });

  it('returns empty array on error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;

    const result = await getRenewalAccounts(conn, 'u1');

    expect(result).toEqual([]);
  });
});

describe('getAMMetrics', () => {
  it('returns calculated AM metrics', async () => {
    const conn = createMockConnection({
      renewalsAtRisk: { records: [{ cnt: 3 }] },
      expansionPipeline: { records: [{ total: 500000 }] },
      avgContract: { records: [{ avgValue: 120000 }] },
    });

    const metrics = await getAMMetrics(conn, 'u1');

    expect(metrics.renewalsAtRiskCount).toBe(3);
    expect(metrics.expansionPipeline).toBe(500000);
    expect(metrics.avgContractValue).toBe(120000);
  });

  it('returns zero metrics on error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;

    const metrics = await getAMMetrics(conn, 'u1');

    expect(metrics.renewalsAtRiskCount).toBe(0);
    expect(metrics.expansionPipeline).toBe(0);
    expect(metrics.avgContractValue).toBe(0);
  });

  it('uses configured amount field when pool is provided', async () => {
    const conn = createMockConnection({
      renewalsAtRisk: { records: [{ cnt: 0 }] },
      expansionPipeline: { records: [{ total: 0 }] },
      avgContract: { records: [{ avgValue: 0 }] },
    });
    const pool = createMockPool();

    await getAMMetrics(conn, 'u1', pool);

    // Pool was used for getAmountFieldName
    expect(conn.query).toHaveBeenCalled();
  });
});

describe('getCSMMetrics', () => {
  it('returns calculated CSM metrics', async () => {
    const conn = createMockConnection({
      atRisk: { records: [{ total: 5 }] },
      avgHealth: { records: [{ avg: 72 }] },
      upcomingRenewals: { records: [{ total: 8 }] },
    });

    const metrics = await getCSMMetrics(conn, 'u1');

    expect(metrics.accountsAtRisk).toBe(5);
    expect(metrics.avgHealthScore).toBe(72);
    expect(metrics.upcomingRenewals).toBe(8);
    expect(metrics.adoptionTrend).toBe(0);
  });

  it('returns zero metrics on error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;

    const metrics = await getCSMMetrics(conn, 'u1');

    expect(metrics.accountsAtRisk).toBe(0);
    expect(metrics.avgHealthScore).toBe(0);
    expect(metrics.upcomingRenewals).toBe(0);
  });

  it('handles team member IDs filter', async () => {
    const conn = createMockConnection({
      atRisk: { records: [{ total: 2 }] },
      avgHealth: { records: [{ avg: 65 }] },
      upcomingRenewals: { records: [{ total: 3 }] },
    });

    const metrics = await getCSMMetrics(conn, 'u1', ['u1', 'u2', 'u3']);

    expect(metrics.accountsAtRisk).toBe(2);
    // Verify the query included team member IDs
    expect(conn.query).toHaveBeenCalledTimes(3);
  });
});

describe('getAtRiskAccounts', () => {
  it('returns accounts with risk factors', async () => {
    const conn = createMockConnection({
      accounts: {
        records: [{
          Id: 'a1',
          Name: 'RiskyCo',
          Current_Gainsight_Score__c: 35,
          Risk__c: 'Red',
          Total_ARR__c: 100000,
          Agreement_Expiry_Date__c: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
          LastActivityDate: null,
          Customer_Success_Manager__r: { Name: 'Jane Doe' },
        }],
      },
    });

    const result = await getAtRiskAccounts(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('RiskyCo');
    expect(result[0].healthScore).toBe(35);
    expect(result[0].riskFactors).toContain('Critical health score');
    expect(result[0].riskFactors).toContain('Flagged as at-risk');
    expect(result[0].riskFactors).toContain('Renewal in <30 days');
    expect(result[0].riskFactors).toContain('No activity recorded');
    expect(result[0].csm).toBe('Jane Doe');
  });

  it('uses fallback query when custom fields do not exist', async () => {
    let callCount = 0;
    const conn = {
      query: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Primary query fails with INVALID_FIELD
          const err = new Error('No such column');
          (err as any).errorCode = 'INVALID_FIELD';
          return Promise.reject(err);
        }
        // Fallback query succeeds
        return Promise.resolve({
          records: [{
            Id: 'a2',
            Name: 'BasicCo',
            LastActivityDate: new Date(Date.now() - 100 * 86400000).toISOString(),
          }],
        });
      }),
    } as any;

    const result = await getAtRiskAccounts(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].healthScore).toBe(50); // Default when no health score
    expect(result[0].riskFactors).toContain('No activity in 90+ days');
  });

  it('returns empty array on non-recoverable error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF connection timeout')),
    } as any;

    const result = await getAtRiskAccounts(conn, 'u1');

    expect(result).toEqual([]);
  });

  it('handles accounts with low engagement in fallback mode', async () => {
    let callCount = 0;
    const conn = {
      query: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('No such column');
          (err as any).errorCode = 'INVALID_FIELD';
          return Promise.reject(err);
        }
        return Promise.resolve({
          records: [{
            Id: 'a3',
            Name: 'LowEngageCo',
            LastActivityDate: new Date(Date.now() - 70 * 86400000).toISOString(),
          }],
        });
      }),
    } as any;

    const result = await getAtRiskAccounts(conn, 'u1');

    expect(result[0].riskFactors).toContain('Low engagement');
  });

  it('handles team member IDs', async () => {
    const conn = createMockConnection({
      accounts: { records: [] },
    });

    const result = await getAtRiskAccounts(conn, 'u1', ['u1', 'u2']);

    expect(result).toEqual([]);
    expect(conn.query).toHaveBeenCalled();
  });
});

describe('getOpportunityTimeline', () => {
  it('returns tasks, events, and stage changes', async () => {
    const conn = createMockConnection({
      tasks: {
        records: [{
          Id: 't1',
          Subject: 'Follow up call',
          Description: 'Discussed pricing',
          ActivityDate: '2025-06-01',
          Status: 'Completed',
          CreatedDate: '2025-06-01',
          Type: 'Call',
          Who: { Name: 'John Doe' },
        }],
      },
      events: {
        records: [{
          Id: 'ev1',
          Subject: 'Discovery Meeting',
          Description: 'Initial meeting',
          StartDateTime: '2025-06-02T10:00:00Z',
          Who: { Name: 'Jane Smith' },
        }],
      },
      history: {
        records: [{
          Id: 'h1',
          Field: 'StageName',
          OldValue: 'Discovery',
          NewValue: 'Proposal',
          CreatedDate: '2025-06-03',
          CreatedBy: { Name: 'Admin User' },
        }],
      },
    });

    const timeline = await getOpportunityTimeline(conn, 'opp1');

    expect(timeline).toHaveLength(3);
    // Should include all three types
    const types = timeline.map(t => t.type);
    expect(types).toContain('call');
    expect(types).toContain('meeting');
    expect(types).toContain('stage_change');
  });

  it('handles email task type', async () => {
    const conn = createMockConnection({
      tasks: {
        records: [{
          Id: 't2',
          Subject: 'Sent proposal',
          ActivityDate: '2025-06-01',
          Type: 'Email',
          Status: 'Completed',
          CreatedDate: '2025-06-01',
        }],
      },
      events: { records: [] },
      history: { records: [] },
    });

    const timeline = await getOpportunityTimeline(conn, 'opp1');

    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe('email');
  });

  it('handles history query failure gracefully', async () => {
    let callCount = 0;
    const conn = {
      query: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 3) {
          // History query fails
          return Promise.reject(new Error('Field not accessible'));
        }
        return Promise.resolve({ records: [] });
      }),
    } as any;

    const timeline = await getOpportunityTimeline(conn, 'opp1');

    // Should still return results (just no history)
    expect(timeline).toEqual([]);
  });

  it('returns empty array on complete error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;

    const timeline = await getOpportunityTimeline(conn, 'opp1');

    expect(timeline).toEqual([]);
  });
});

describe('getExecutiveMetrics', () => {
  it('returns calculated executive metrics', async () => {
    const conn = createMockConnection({
      pipeline: { records: [{ total: 5000000 }] },
      closedWon: { records: [{ total: 2000000 }] },
      renewalsAtRisk: { records: [{ cnt: 4 }] },
      avgHealth: { records: [{ avg: 73.5 }] },
      atRiskCount: { records: [{ cnt: 8 }] },
      expansion: { records: [{ total: 800000 }] },
      upcomingRenewals: { records: [{ cnt: 12 }] },
    });
    const pool = createMockPool();

    const metrics = await getExecutiveMetrics(conn, pool);

    expect(metrics.totalPipeline).toBe(5000000);
    expect(metrics.closedWonYTD).toBe(2000000);
    expect(metrics.renewalsAtRisk).toBe(4);
    expect(metrics.avgHealthScore).toBe(74); // Rounded from 73.5
    expect(metrics.atRiskAccountCount).toBe(8);
    expect(metrics.expansionPipeline).toBe(800000);
    expect(metrics.upcomingRenewals).toBe(12);
  });

  it('returns zero metrics on error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;
    const pool = createMockPool();

    const metrics = await getExecutiveMetrics(conn, pool);

    expect(metrics.totalPipeline).toBe(0);
    expect(metrics.closedWonYTD).toBe(0);
  });
});

describe('getUnderutilizedAccounts', () => {
  it('returns underutilized accounts below threshold', async () => {
    const conn = createMockConnection({
      accounts: {
        records: [
          {
            Id: 'a1',
            Name: 'LowUsageCo',
            Contract_Total_License_Seats__c: 1000,
            Total_Active_Users__c: 200,
            License_Utilization_Max__c: 20,
            Current_Gainsight_Score__c: 55,
            Total_ARR__c: 100000,
            Agreement_Expiry_Date__c: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
            Active_Users_Learn__c: 150,
            License_Utilization_Learn__c: 15,
          },
          {
            Id: 'a2',
            Name: 'HighUsageCo',
            Contract_Total_License_Seats__c: 500,
            Total_Active_Users__c: 450,
            License_Utilization_Max__c: 90,
            Current_Gainsight_Score__c: 85,
            Total_ARR__c: 200000,
          },
        ],
      },
    });

    const result = await getUnderutilizedAccounts(conn, 'u1');

    // Only the low usage account should be included (90% > 60% threshold)
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('LowUsageCo');
    expect(result[0].riskLevel).toBe('critical'); // 20% < 30%
    expect(result[0].utilizationPercent).toBe(20);
  });

  it('uses fallback query when custom fields do not exist', async () => {
    let callCount = 0;
    const conn = {
      query: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('No such column');
          (err as any).errorCode = 'INVALID_FIELD';
          return Promise.reject(err);
        }
        return Promise.resolve({ records: [] });
      }),
    } as any;

    const result = await getUnderutilizedAccounts(conn, 'u1');

    expect(result).toEqual([]);
    expect(conn.query).toHaveBeenCalledTimes(2);
  });

  it('returns empty array on error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;

    const result = await getUnderutilizedAccounts(conn, 'u1');

    expect(result).toEqual([]);
  });
});

describe('getExecutiveAtRiskDeals', () => {
  it('identifies at-risk deals with risk factors', async () => {
    const conn = createMockConnection({
      opps: {
        records: [
          {
            Id: 'o1',
            Name: 'Big Stale Deal',
            Account: { Name: 'BigCo' },
            Owner: { Name: 'Sales Rep' },
            Amount: 500000,
            StageName: 'Negotiation',
            CloseDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            LastModifiedDate: new Date(Date.now() - 20 * 86400000).toISOString(),
            NextStep: '',
            Probability: 30,
          },
          {
            Id: 'o2',
            Name: 'Healthy Deal',
            Account: { Name: 'HealthyCo' },
            Owner: { Name: 'Good Rep' },
            Amount: 300000,
            StageName: 'Proposal',
            CloseDate: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
            LastModifiedDate: new Date(Date.now() - 5 * 86400000).toISOString(),
            NextStep: 'Review contract',
            Probability: 80,
          },
        ],
      },
    });

    const result = await getExecutiveAtRiskDeals(conn);

    // Only o1 should be at risk (stale, no next step, low probability)
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Big Stale Deal');
    expect(result[0].riskFactors.length).toBeGreaterThan(0);
    expect(result[0].riskFactors).toContain('No Next Step');
  });

  it('detects overdue close date', async () => {
    const conn = createMockConnection({
      opps: {
        records: [{
          Id: 'o3',
          Name: 'Overdue Deal',
          Account: { Name: 'LateCo' },
          Owner: { Name: 'Rep' },
          Amount: 100000,
          StageName: 'Closed Lost',
          CloseDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
          LastModifiedDate: new Date().toISOString(),
          NextStep: 'Follow up',
          Probability: 50,
        }],
      },
    });

    const result = await getExecutiveAtRiskDeals(conn);

    expect(result).toHaveLength(1);
    expect(result[0].riskFactors).toContain('Overdue close');
  });

  it('returns empty array on error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;

    const result = await getExecutiveAtRiskDeals(conn);

    expect(result).toEqual([]);
  });
});
