import {
  mockAccounts,
  mockOpportunities,
  mockActivities,
  mockUser,
  getAccountById,
  getOpportunitiesByAccountId,
  getActivitiesByAccountId,
  getActivitiesByOpportunityId,
  getHighPriorityAccounts,
  getAtRiskOpportunities,
  getRecentActivities,
} from '../mockData';

describe('mock data arrays', () => {
  it('mockAccounts has well-formed entries', () => {
    expect(mockAccounts.length).toBeGreaterThan(0);
    for (const acc of mockAccounts) {
      expect(acc.Id).toBeTruthy();
      expect(acc.Name).toBeTruthy();
      expect(acc.Owner).toHaveProperty('Name');
      expect(typeof acc.Priority_Score__c).toBe('number');
    }
  });

  it('mockOpportunities has well-formed entries', () => {
    expect(mockOpportunities.length).toBeGreaterThan(0);
    for (const opp of mockOpportunities) {
      expect(opp.Id).toBeTruthy();
      expect(opp.AccountId).toBeTruthy();
      expect(typeof opp.Amount).toBe('number');
    }
  });

  it('mockActivities has well-formed entries', () => {
    expect(mockActivities.length).toBeGreaterThan(0);
    for (const act of mockActivities) {
      expect(act.Id).toBeTruthy();
      expect(act.Type).toBeTruthy();
    }
  });

  it('mockUser has required fields', () => {
    expect(mockUser.Id).toBeTruthy();
    expect(mockUser.Name).toBeTruthy();
    expect(mockUser.Email).toBeTruthy();
  });
});

describe('getAccountById', () => {
  it('returns account for known ID', () => {
    const acc = getAccountById('acc001');
    expect(acc).toBeDefined();
    expect(acc!.Name).toBe('RetailCo');
  });

  it('returns undefined for unknown ID', () => {
    expect(getAccountById('nonexistent')).toBeUndefined();
  });
});

describe('getOpportunitiesByAccountId', () => {
  it('returns opportunities for known account', () => {
    const opps = getOpportunitiesByAccountId('acc001');
    expect(opps.length).toBeGreaterThan(0);
    opps.forEach(opp => expect(opp.AccountId).toBe('acc001'));
  });

  it('returns empty array for unknown account', () => {
    expect(getOpportunitiesByAccountId('nonexistent')).toEqual([]);
  });
});

describe('getActivitiesByAccountId', () => {
  it('returns activities for known account', () => {
    const acts = getActivitiesByAccountId('acc001');
    expect(acts.length).toBeGreaterThan(0);
    acts.forEach(act => expect(act.AccountId).toBe('acc001'));
  });

  it('returns empty array for unknown account', () => {
    expect(getActivitiesByAccountId('nonexistent')).toEqual([]);
  });
});

describe('getActivitiesByOpportunityId', () => {
  it('returns activities for known opportunity', () => {
    const acts = getActivitiesByOpportunityId('opp001');
    expect(acts.length).toBeGreaterThan(0);
    acts.forEach(act => expect(act.OpportunityId).toBe('opp001'));
  });

  it('returns empty array for unknown opportunity', () => {
    expect(getActivitiesByOpportunityId('nonexistent')).toEqual([]);
  });
});

describe('getHighPriorityAccounts', () => {
  it('returns only accounts with score >= 85', () => {
    const high = getHighPriorityAccounts();
    expect(high.length).toBeGreaterThan(0);
    high.forEach(acc => expect(acc.Priority_Score__c).toBeGreaterThanOrEqual(85));
  });

  it('returns sorted by score descending', () => {
    const high = getHighPriorityAccounts();
    for (let i = 1; i < high.length; i++) {
      expect(high[i - 1].Priority_Score__c).toBeGreaterThanOrEqual(high[i].Priority_Score__c);
    }
  });
});

describe('getAtRiskOpportunities', () => {
  it('returns only at-risk opportunities', () => {
    const atRisk = getAtRiskOpportunities();
    expect(atRisk.length).toBeGreaterThan(0);
    atRisk.forEach(opp => expect(opp.IsAtRisk__c).toBe(true));
  });
});

describe('getRecentActivities', () => {
  it('returns activities sorted by date descending', () => {
    const recent = getRecentActivities();
    for (let i = 1; i < recent.length; i++) {
      expect(new Date(recent[i - 1].CreatedDate).getTime())
        .toBeGreaterThanOrEqual(new Date(recent[i].CreatedDate).getTime());
    }
  });

  it('respects limit parameter', () => {
    const limited = getRecentActivities(2);
    expect(limited.length).toBeLessThanOrEqual(2);
  });

  it('defaults to max 10', () => {
    const all = getRecentActivities();
    expect(all.length).toBeLessThanOrEqual(10);
  });
});
