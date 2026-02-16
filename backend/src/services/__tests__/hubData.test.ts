import { extractDomainKey, groupAccountsByDomain, calculateMEDDPICCScore, daysBetween } from '../hubData';

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
