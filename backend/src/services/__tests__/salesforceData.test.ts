import {
  getHighPriorityAccounts,
  getAllAccounts,
  getAccountById,
  getAtRiskOpportunities,
  getAllOpportunities,
  getClosedOpportunities,
  getOpportunitiesByAccountId,
  getOpportunityById,
  getAccountPlanData,
  getDashboardStats,
} from '../salesforceData';

// Mock AdminSettingsService for getOpportunityById
jest.mock('../adminSettings', () => ({
  AdminSettingsService: jest.fn().mockImplementation(() => ({
    getOpportunityDetailConfig: jest.fn().mockResolvedValue({
      sections: [
        {
          id: 'meddpicc',
          label: 'MEDDPICC',
          enabled: true,
          fields: [
            { label: 'Metrics', salesforceField: 'MEDDPICC_Metrics__c', fieldType: 'score' },
          ],
        },
      ],
    }),
  })),
}));

function createMockConnection() {
  return {
    query: jest.fn().mockResolvedValue({ records: [], totalSize: 0 }),
  } as any;
}

// ============================================================
// getHighPriorityAccounts
// ============================================================

describe('getHighPriorityAccounts', () => {
  it('returns accounts with 6sense field mapping', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [{
        Id: 'a1',
        Name: 'HighIntent Co',
        Industry: 'Technology',
        accountIntentScore6sense__c: 85,
        accountBuyingStage6sense__c: 'Decision',
        Clay_Employee_Count__c: 500,
      }],
    });

    const result = await getHighPriorityAccounts(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].Priority_Score__c).toBe(85);
    expect(result[0].SixSense_Intent_Score__c).toBe(85);
    expect(result[0].SixSense_Buying_Stage__c).toBe('Decision');
  });

  it('falls back on INVALID_FIELD error', async () => {
    const conn = createMockConnection();
    const err = new Error('No such column');
    (err as any).errorCode = 'INVALID_FIELD';
    conn.query
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({
        records: [{
          Id: 'a2',
          Name: 'BasicCo',
          Industry: 'Finance',
        }],
      });

    const result = await getHighPriorityAccounts(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].Name).toBe('BasicCo');
    expect(conn.query).toHaveBeenCalledTimes(2);
  });

  it('handles null 6sense fields with coalescing', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [{
        Id: 'a3',
        Name: 'NullFieldsCo',
        accountIntentScore6sense__c: null,
        accountBuyingStage6sense__c: null,
        Priority_Score__c: 60,
        Priority_Tier__c: 'Warm',
      }],
    });

    const result = await getHighPriorityAccounts(conn, 'u1');

    expect(result).toHaveLength(1);
    // Falls back to existing Priority_Score__c
    expect(result[0].Priority_Score__c).toBe(60);
  });
});

// ============================================================
// getAllAccounts
// ============================================================

describe('getAllAccounts', () => {
  it('returns mapped accounts list', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [
        { Id: 'a1', Name: 'TestCo', accountIntentScore6sense__c: 70, NumberOfEmployees: 200 },
        { Id: 'a2', Name: 'OtherCo', accountIntentScore6sense__c: 45, NumberOfEmployees: 50 },
      ],
    });

    const result = await getAllAccounts(conn, 'u1');

    expect(result).toHaveLength(2);
    expect(result[0].Priority_Score__c).toBe(70);
    expect(result[0].Clay_Employee_Count__c).toBe(200); // Falls back to NumberOfEmployees
  });

  it('returns empty array when no accounts', async () => {
    const conn = createMockConnection();

    const result = await getAllAccounts(conn, 'u1');

    expect(result).toEqual([]);
  });
});

// ============================================================
// getAccountById
// ============================================================

describe('getAccountById', () => {
  it('returns account with extended fields', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [{
        Id: 'a1',
        Name: 'DetailedCo',
        Industry: 'Technology',
        accountIntentScore6sense__c: 90,
        accountBuyingStage6sense__c: 'Purchase',
        Clay_Employee_Count__c: 1000,
        Total_ARR__c: 500000,
      }],
    });

    const result = await getAccountById(conn, 'a1');

    expect(result).not.toBeNull();
    expect(result!.Name).toBe('DetailedCo');
    expect(result!.Priority_Score__c).toBe(90);
    expect(result!.SixSense_Buying_Stage__c).toBe('Purchase');
  });

  it('returns null when account not found', async () => {
    const conn = createMockConnection();

    const result = await getAccountById(conn, 'nonexistent');

    expect(result).toBeNull();
  });

  it('handles null fields gracefully', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [{
        Id: 'a1',
        Name: 'MinimalCo',
        accountIntentScore6sense__c: null,
        Clay_Employee_Count__c: null,
        NumberOfEmployees: 50,
      }],
    });

    const result = await getAccountById(conn, 'a1');

    expect(result).not.toBeNull();
    expect(result!.Clay_Employee_Count__c).toBe(50); // Falls back to NumberOfEmployees
  });
});

// ============================================================
// getAtRiskOpportunities
// ============================================================

describe('getAtRiskOpportunities', () => {
  it('maps Account.Name correctly', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [{
        Id: 'o1',
        Name: 'Risky Deal',
        Account: { Name: 'RiskyCo' },
        Amount: 100000,
        StageName: 'Negotiation',
      }],
    });

    const result = await getAtRiskOpportunities(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].Account?.Name).toBe('RiskyCo');
  });

  it('defaults Account.Name to Unknown Account when null', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [{
        Id: 'o2',
        Name: 'Orphan Deal',
        Account: null,
        Amount: 50000,
      }],
    });

    const result = await getAtRiskOpportunities(conn, 'u1');

    expect(result[0].Account?.Name).toBe('Unknown Account');
  });
});

// ============================================================
// getAllOpportunities
// ============================================================

describe('getAllOpportunities', () => {
  it('returns opportunities with Account and Owner mapping', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [
        {
          Id: 'o1',
          Name: 'Deal 1',
          Account: { Name: 'TestCo' },
          Owner: { Name: 'Rep One' },
          Amount: 200000,
          StageName: 'Proposal',
        },
        {
          Id: 'o2',
          Name: 'Deal 2',
          Account: null,
          Owner: null,
          Amount: 100000,
          StageName: 'Discovery',
        },
      ],
    });

    const result = await getAllOpportunities(conn, 'u1');

    expect(result).toHaveLength(2);
    expect(result[0].Account?.Name).toBe('TestCo');
    expect(result[0].Owner?.Name).toBe('Rep One');
    expect(result[1].Account?.Name).toBe('Unknown Account');
    expect(result[1].Owner?.Name).toBe('Unknown Owner');
  });
});

// ============================================================
// getClosedOpportunities
// ============================================================

describe('getClosedOpportunities', () => {
  it('returns closed opportunities with mapping', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [{
        Id: 'o1',
        Name: 'Won Deal',
        Account: { Name: 'WinCo' },
        Owner: { Name: 'Star Rep' },
        StageName: 'Closed Won',
        Amount: 300000,
      }],
    });

    const result = await getClosedOpportunities(conn, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].Account?.Name).toBe('WinCo');
    expect(result[0].Owner?.Name).toBe('Star Rep');
  });
});

// ============================================================
// getOpportunitiesByAccountId
// ============================================================

describe('getOpportunitiesByAccountId', () => {
  it('returns opportunities for a specific account', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [
        { Id: 'o1', Name: 'Deal A', Amount: 100000, StageName: 'Proposal' },
        { Id: 'o2', Name: 'Deal B', Amount: 50000, StageName: 'Discovery' },
      ],
    });

    const result = await getOpportunitiesByAccountId(conn, 'a1');

    expect(result).toHaveLength(2);
    expect(result[0].Name).toBe('Deal A');
  });

  it('returns empty array when no opportunities', async () => {
    const conn = createMockConnection();

    const result = await getOpportunitiesByAccountId(conn, 'a1');

    expect(result).toEqual([]);
  });
});

// ============================================================
// getOpportunityById
// ============================================================

describe('getOpportunityById', () => {
  it('returns opportunity with Account and Owner mapping', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [{
        Id: 'o1',
        Name: 'Detail Deal',
        AccountId: 'a1',
        Account: { Name: 'TestCo' },
        Owner: { Name: 'Rep', Email: 'rep@test.com' },
        Amount: 200000,
        StageName: 'Negotiation',
      }],
    });

    const result = await getOpportunityById(conn, 'o1');

    expect(result).not.toBeNull();
    expect(result!.Account?.Name).toBe('TestCo');
    expect(result!.Account?.Id).toBe('a1');
    expect(result!.Owner?.Name).toBe('Rep');
    expect(result!.Owner?.Email).toBe('rep@test.com');
  });

  it('returns null when not found', async () => {
    const conn = createMockConnection();

    const result = await getOpportunityById(conn, 'nonexistent');

    expect(result).toBeNull();
  });

  it('uses AdminSettingsService for custom field selection when pool provided', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [{
        Id: 'o1',
        Name: 'Custom Fields Deal',
        AccountId: 'a1',
        Account: { Name: 'TestCo' },
        Owner: { Name: 'Rep' },
        MEDDPICC_Metrics__c: 80,
      }],
    });
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) } as any;

    const result = await getOpportunityById(conn, 'o1', pool);

    expect(result).not.toBeNull();
    // The query should include custom fields from config
    const queryArg = conn.query.mock.calls[0][0];
    expect(queryArg).toContain('MEDDPICC_Metrics__c');
  });

  it('handles null Account and Owner gracefully', async () => {
    const conn = createMockConnection();
    conn.query.mockResolvedValueOnce({
      records: [{
        Id: 'o1',
        Name: 'Orphan',
        AccountId: 'a1',
        Account: null,
        Owner: null,
      }],
    });

    const result = await getOpportunityById(conn, 'o1');

    expect(result!.Account?.Name).toBe('Unknown Account');
    expect(result!.Owner?.Name).toBe('Unknown Owner');
  });
});

// ============================================================
// getAccountPlanData
// ============================================================

describe('getAccountPlanData', () => {
  it('returns account, opportunities, and contacts from parallel queries', async () => {
    const conn = createMockConnection();
    // safeQuery is called 4 times in parallel via Promise.all
    // Each call to safeQuery calls conn.query once (primary query)
    conn.query
      .mockResolvedValueOnce({ records: [{ Id: 'a1', Name: 'TestCo', Industry: 'Tech' }] })   // account
      .mockResolvedValueOnce({ records: [{ Id: 'o1', Name: 'Renewal', Type: 'Renewal' }] })    // renewalOpps
      .mockResolvedValueOnce({ records: [{ Id: 'o2', Name: 'Expansion', Type: 'Customer Expansion' }] }) // expansionOpps
      .mockResolvedValueOnce({ records: [{ Id: 'c1', Name: 'John Doe', Title: 'VP' }] });      // contacts

    const result = await getAccountPlanData(conn, 'a1');

    expect(result.account).not.toBeNull();
    expect(result.account!.Name).toBe('TestCo');
    expect(result.renewalOpps).toHaveLength(1);
    expect(result.expansionOpps).toHaveLength(1);
    expect(result.contacts).toHaveLength(1);
  });

  it('returns null account when not found', async () => {
    const conn = createMockConnection();
    conn.query
      .mockResolvedValueOnce({ records: [] })  // account not found
      .mockResolvedValueOnce({ records: [] })  // renewalOpps
      .mockResolvedValueOnce({ records: [] })  // expansionOpps
      .mockResolvedValueOnce({ records: [] }); // contacts

    const result = await getAccountPlanData(conn, 'nonexistent');

    expect(result.account).toBeNull();
    expect(result.renewalOpps).toEqual([]);
    expect(result.expansionOpps).toEqual([]);
    expect(result.contacts).toEqual([]);
  });

  it('falls back gracefully when custom fields fail', async () => {
    const err = new Error('No such column');
    (err as any).errorCode = 'INVALID_FIELD';
    const conn = createMockConnection();
    // First query (account primary) fails, then fallback succeeds
    // The 4 safeQuery calls happen in parallel, so each may independently fail/fallback
    conn.query
      .mockRejectedValueOnce(err) // account primary fails
      .mockRejectedValueOnce(err) // renewal primary fails
      .mockRejectedValueOnce(err) // expansion primary fails
      .mockResolvedValueOnce({ records: [{ Id: 'c1', Name: 'Contact' }] }) // contacts succeed
      .mockResolvedValueOnce({ records: [{ Id: 'a1', Name: 'FallbackCo' }] }) // account fallback
      .mockResolvedValueOnce({ records: [] }) // renewal fallback
      .mockResolvedValueOnce({ records: [] }); // expansion fallback

    const result = await getAccountPlanData(conn, 'a1');

    expect(result.account).not.toBeNull();
    expect(result.contacts).toHaveLength(1);
  });
});

// ============================================================
// getDashboardStats
// ============================================================

describe('getDashboardStats', () => {
  it('aggregates pipeline, closed won, and win rate', async () => {
    const conn = createMockConnection();
    conn.query
      .mockResolvedValueOnce({ records: [{ Id: 'a1' }, { Id: 'a2' }, { Id: 'a3' }] })  // all accounts
      .mockResolvedValueOnce({ records: [{ Id: 'a1' }] })  // high priority accounts
      .mockResolvedValueOnce({ records: [{ Id: 'o1', Amount: 200000 }, { Id: 'o2', Amount: 300000 }] })  // opportunities
      .mockResolvedValueOnce({ records: [{ Id: 'o3' }] });  // at-risk opps

    const result = await getDashboardStats(conn, 'u1');

    expect(result.accounts.total).toBe(3);
    expect(result.accounts.highPriority).toBe(1);
    expect(result.opportunities.total).toBe(2);
    expect(result.opportunities.totalValue).toBe(500000);
    expect(result.opportunities.avgDealSize).toBe(250000);
    expect(result.opportunities.atRisk).toBe(1);
  });

  it('returns zero stats on error', async () => {
    const conn = {
      query: jest.fn().mockRejectedValue(new Error('SF down')),
    } as any;

    const result = await getDashboardStats(conn, 'u1');

    expect(result.accounts.total).toBe(0);
    expect(result.accounts.highPriority).toBe(0);
    expect(result.opportunities.total).toBe(0);
    expect(result.opportunities.totalValue).toBe(0);
    expect(result.opportunities.avgDealSize).toBe(0);
  });

  it('handles empty opportunities with zero average', async () => {
    const conn = createMockConnection();
    conn.query
      .mockResolvedValueOnce({ records: [] })   // accounts
      .mockResolvedValueOnce({ records: [] })   // high priority
      .mockResolvedValueOnce({ records: [] })   // opportunities
      .mockResolvedValueOnce({ records: [] });  // at-risk

    const result = await getDashboardStats(conn, 'u1');

    expect(result.opportunities.avgDealSize).toBe(0);
    expect(result.opportunities.totalValue).toBe(0);
  });
});
