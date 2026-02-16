import { generateWordDocument } from '../documentExport';

function makeExportData(overrides: Record<string, any> = {}) {
  return {
    planName: 'Test Account Plan',
    planDate: '2025-06-15',
    status: 'Active',
    accountSnapshot: {
      Name: 'TestCo',
      Industry: 'Technology',
      BillingCity: 'Austin',
      BillingState: 'TX',
      BillingCountry: 'USA',
      Owner: { Name: 'Jane Doe' },
      Total_ARR__c: 120000,
      Customer_Success_Score__c: 85,
      Agreement_Expiry_Date__c: '2026-03-01',
      Risk__c: 'Low',
      CreatedDate: '2023-01-10',
      ...overrides.accountSnapshot,
    },
    renewalOppsSnapshot: overrides.renewalOppsSnapshot ?? [],
    expansionOppsSnapshot: overrides.expansionOppsSnapshot ?? [],
    contactsSnapshot: overrides.contactsSnapshot ?? [],
    executiveSummary: overrides.executiveSummary ?? 'Strong account performance.',
    retentionStrategy: overrides.retentionStrategy ?? 'Maintain engagement.',
    growthStrategy: overrides.growthStrategy ?? '',
    keyInitiatives: overrides.keyInitiatives ?? '',
    risksAndMitigations: overrides.risksAndMitigations ?? '',
    nextSteps: overrides.nextSteps ?? 'Follow up next quarter.',
    additionalNotes: overrides.additionalNotes ?? '',
  };
}

describe('generateWordDocument', () => {
  it('returns a Buffer with minimal data', async () => {
    const data = makeExportData();
    const buffer = await generateWordDocument(data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles empty renewal/expansion/contacts arrays', async () => {
    const data = makeExportData({
      renewalOppsSnapshot: [],
      expansionOppsSnapshot: [],
      contactsSnapshot: [],
    });
    const buffer = await generateWordDocument(data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('handles renewal opportunities with MEDDPICC fields', async () => {
    const data = makeExportData({
      renewalOppsSnapshot: [{
        Name: 'Renewal Opp',
        Amount: 50000,
        StageName: 'Negotiation',
        CloseDate: '2025-12-01',
        COM_Metrics__c: 'Revenue growth',
        MEDDPICCR_Economic_Buyer__c: 'VP of Sales',
        MEDDPICCR_Champion__c: 'Director of Ops',
      }],
    });
    const buffer = await generateWordDocument(data);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles expansion opportunities', async () => {
    const data = makeExportData({
      expansionOppsSnapshot: [{
        Name: 'Expansion Opp',
        Type: 'Upsell',
        Amount: 30000,
        StageName: 'Discovery',
        CloseDate: '2025-09-01',
      }],
    });
    const buffer = await generateWordDocument(data);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles contacts snapshot', async () => {
    const data = makeExportData({
      contactsSnapshot: [
        { Name: 'John Smith', Title: 'CEO', Email: 'john@test.com', Phone: '555-1234' },
        { FirstName: 'Jane', LastName: 'Doe', Title: 'CTO', Email: 'jane@test.com' },
      ],
    });
    const buffer = await generateWordDocument(data);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles strategy fields with multi-line content', async () => {
    const data = makeExportData({
      executiveSummary: 'Line 1\nLine 2\nLine 3',
      retentionStrategy: 'Keep customers happy',
      growthStrategy: 'Expand into new markets',
      keyInitiatives: 'Initiative A\nInitiative B',
      risksAndMitigations: 'Risk: churn\nMitigation: engage',
      nextSteps: 'Step 1\nStep 2',
      additionalNotes: 'Note 1',
    });
    const buffer = await generateWordDocument(data);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles null/missing account fields gracefully', async () => {
    const data = makeExportData({
      accountSnapshot: { Name: 'Minimal' },
    });
    const buffer = await generateWordDocument(data);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles account with risk and health notes', async () => {
    const data = makeExportData({
      accountSnapshot: {
        Name: 'RiskyCo',
        Risk__c: 'High',
        Risk_Notes__c: 'Champion left',
        Overall_Customer_Health_Notes__c: 'Declining usage',
        Support_Notes__c: 'Open P1 ticket',
        Strategy_Notes__c: 'Focus on retention',
        Contract_Notes__c: 'Auto-renew clause',
        Current_Gainsight_Score__c: 45,
        License_Utilization_Max__c: 72.5,
        Launch_Date__c: '2023-06-01',
      },
    });
    const buffer = await generateWordDocument(data);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
