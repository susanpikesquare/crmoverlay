import { GongAISearchService } from '../gongAISearchService';

// Mock aiService
jest.mock('../aiService', () => ({
  aiService: {
    askWithContext: jest.fn().mockResolvedValue('AI analysis result'),
  },
}));

function createMockGongService() {
  return {
    getCallsPaginated: jest.fn().mockResolvedValue([]),
    getCallsExtensive: jest.fn().mockResolvedValue([]),
    getTranscriptsBatch: jest.fn().mockResolvedValue(new Map()),
    getEmailActivity: jest.fn().mockResolvedValue([]),
    getCalls: jest.fn().mockResolvedValue([]),
  };
}

function makeMockCall(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id || 'call-1',
    title: overrides.title || 'Test Call',
    scheduled: overrides.scheduled || '2025-06-01T10:00:00Z',
    started: overrides.started || '2025-06-01T10:00:00Z',
    duration: overrides.duration || 1800,
    direction: overrides.direction || 'Outbound',
    parties: overrides.parties || [],
    topics: overrides.topics || [],
    crmAssociations: overrides.crmAssociations,
    url: overrides.url,
    ...overrides,
  };
}

describe('GongAISearchService', () => {
  describe('calculateLookbackDays (via search)', () => {
    it('uses 30 days for last30 filter', async () => {
      const gong = createMockGongService();
      const svc = new GongAISearchService(gong as any);

      await svc.search({
        scope: 'global',
        query: 'test',
        filters: { timeRange: 'last30' },
      });

      const callArgs = gong.getCallsPaginated.mock.calls[0][0];
      const from = new Date(callArgs.fromDateTime);
      const diffDays = Math.round((Date.now() - from.getTime()) / 86400000);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it('uses 180 days as default for global scope', async () => {
      const gong = createMockGongService();
      const svc = new GongAISearchService(gong as any);

      await svc.search({ scope: 'global', query: 'test' });

      const callArgs = gong.getCallsPaginated.mock.calls[0][0];
      const from = new Date(callArgs.fromDateTime);
      const diffDays = Math.round((Date.now() - from.getTime()) / 86400000);
      expect(diffDays).toBeCloseTo(180, 0);
    });

    it('uses 730 days as default for account scope', async () => {
      const gong = createMockGongService();
      const svc = new GongAISearchService(gong as any);

      await svc.search({ scope: 'account', query: 'test', accountId: 'acc1' });

      const callArgs = gong.getCallsPaginated.mock.calls[0][0];
      const from = new Date(callArgs.fromDateTime);
      const diffDays = Math.round((Date.now() - from.getTime()) / 86400000);
      expect(diffDays).toBeCloseTo(730, 0);
    });
  });

  describe('selectTopCalls (via search with >15 calls)', () => {
    it('limits to 15 calls for transcript fetch', async () => {
      const gong = createMockGongService();
      const calls = Array.from({ length: 20 }, (_, i) =>
        makeMockCall({
          id: `call-${i}`,
          title: `Call ${i}`,
          started: new Date(Date.now() - i * 86400000).toISOString(),
          duration: 1800,
        })
      );
      gong.getCallsPaginated.mockResolvedValue(calls);

      const svc = new GongAISearchService(gong as any);
      await svc.search({ scope: 'global', query: 'pricing' });

      // getTranscriptsBatch should be called with max 15 IDs
      const transcriptCallIds = gong.getTranscriptsBatch.mock.calls[0][0];
      expect(transcriptCallIds.length).toBeLessThanOrEqual(15);
    });

    it('scores calls with topic relevance higher', async () => {
      const gong = createMockGongService();
      const calls = Array.from({ length: 20 }, (_, i) =>
        makeMockCall({
          id: `call-${i}`,
          title: `Call ${i}`,
          started: new Date(Date.now() - i * 86400000).toISOString(),
          topics: i < 3 ? ['pricing', 'negotiation'] : ['general'],
        })
      );
      gong.getCallsPaginated.mockResolvedValue(calls);

      const svc = new GongAISearchService(gong as any);
      await svc.search({ scope: 'global', query: 'pricing negotiation' });

      const transcriptCallIds = gong.getTranscriptsBatch.mock.calls[0][0];
      // The calls with matching topics should be in the selected set
      expect(transcriptCallIds).toContain('call-0');
      expect(transcriptCallIds).toContain('call-1');
      expect(transcriptCallIds).toContain('call-2');
    });
  });

  describe('search orchestration', () => {
    it('returns complete response structure for global scope', async () => {
      const gong = createMockGongService();
      gong.getCallsPaginated.mockResolvedValue([
        makeMockCall({ id: 'c1', title: 'Intro Call' }),
      ]);
      gong.getTranscriptsBatch.mockResolvedValue(new Map([
        ['c1', { callId: 'c1', transcript: [] }],
      ]));

      const svc = new GongAISearchService(gong as any);
      const result = await svc.search({ scope: 'global', query: 'What are common objections?' });

      expect(result.answer).toBeTruthy();
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].id).toBe('c1');
      expect(result.metadata.callsAnalyzed).toBe(1);
      expect(result.metadata.transcriptsFetched).toBe(1);
      expect(result.metadata.generatedAt).toBeTruthy();
    });

    it('handles account scope with CRM filtering', async () => {
      const gong = createMockGongService();
      const calls = [
        makeMockCall({ id: 'c1', crmAssociations: { accountIds: ['acc1'] } }),
        makeMockCall({ id: 'c2', crmAssociations: { accountIds: ['acc2'] } }),
      ];
      gong.getCallsPaginated.mockResolvedValue(calls);
      gong.getCallsExtensive.mockResolvedValue(calls);

      const svc = new GongAISearchService(gong as any);
      const result = await svc.search({
        scope: 'account',
        query: 'relationship status',
        accountId: 'acc1',
        accountName: 'TestCo',
      });

      expect(result.metadata.callsAnalyzed).toBe(1);
    });

    it('handles opportunity scope with account-level filtering', async () => {
      const gong = createMockGongService();
      const calls = [
        makeMockCall({ id: 'c1', crmAssociations: { accountIds: ['acc1'], opportunityIds: ['opp1'] } }),
      ];
      gong.getCallsPaginated.mockResolvedValue(calls);
      gong.getCallsExtensive.mockResolvedValue(calls);

      const svc = new GongAISearchService(gong as any);
      const result = await svc.search({
        scope: 'opportunity',
        query: 'deal progress',
        accountId: 'acc1',
        opportunityId: 'opp1',
        opportunityName: 'Big Deal',
      });

      expect(result.metadata.callsAnalyzed).toBe(1);
    });

    it('handles name-based fallback when CRM returns 0', async () => {
      const gong = createMockGongService();
      const calls = [
        makeMockCall({ id: 'c1', title: 'Acme Corp Discovery', crmAssociations: {} }),
        makeMockCall({ id: 'c2', title: 'Other Company Call', crmAssociations: {} }),
      ];
      gong.getCallsPaginated.mockResolvedValue(calls);
      gong.getCallsExtensive.mockResolvedValue(calls);

      const svc = new GongAISearchService(gong as any);
      const result = await svc.search({
        scope: 'account',
        query: 'status',
        accountId: 'acc-none',
        accountName: 'Acme Corp',
      });

      // Should find the call with "Acme Corp" in the title via name-based fallback
      expect(result.metadata.callsAnalyzed).toBe(1);
    });

    it('applies participant type filter', async () => {
      const gong = createMockGongService();
      const calls = [
        makeMockCall({ id: 'c1', parties: [{ id: 'p1', affiliation: 'External', name: 'Customer' }] }),
        makeMockCall({ id: 'c2', parties: [{ id: 'p2', affiliation: 'Internal', name: 'Rep' }] }),
      ];
      gong.getCallsPaginated.mockResolvedValue(calls);
      // getCallsExtensive is called for participant filtering; return same calls
      gong.getCallsExtensive.mockResolvedValue(calls);

      const svc = new GongAISearchService(gong as any);
      const result = await svc.search({
        scope: 'global',
        query: 'test',
        filters: { participantType: 'external-only' },
      });

      expect(result.metadata.callsAnalyzed).toBe(1);
    });

    it('handles email fetch failure gracefully', async () => {
      const gong = createMockGongService();
      gong.getCallsPaginated.mockResolvedValue([]);
      gong.getEmailActivity.mockRejectedValue(new Error('email API down'));

      const svc = new GongAISearchService(gong as any);
      const result = await svc.search({ scope: 'global', query: 'test' });

      expect(result.metadata.emailsAnalyzed).toBe(0);
    });

    it('includes emails in metadata count', async () => {
      const gong = createMockGongService();
      gong.getCallsPaginated.mockResolvedValue([]);
      gong.getEmailActivity.mockResolvedValue([
        { id: 'e1', subject: 'Hi', from: 'a@b.com', to: ['c@d.com'], sentAt: '2025-01-01', opened: true, clicked: false, replied: false },
        { id: 'e2', subject: 'Re: Hi', from: 'c@d.com', to: ['a@b.com'], sentAt: '2025-01-02', opened: true, clicked: true, replied: true },
      ]);

      const svc = new GongAISearchService(gong as any);
      const result = await svc.search({ scope: 'global', query: 'emails' });

      expect(result.metadata.emailsAnalyzed).toBe(2);
    });
  });

  describe('internal-only participant filter', () => {
    it('filters to calls with only internal participants', async () => {
      const gong = createMockGongService();
      const calls = [
        makeMockCall({ id: 'c1', parties: [{ id: 'p1', affiliation: 'External', name: 'Customer' }] }),
        makeMockCall({ id: 'c2', parties: [{ id: 'p2', affiliation: 'Internal', name: 'Rep' }] }),
        makeMockCall({ id: 'c3', parties: [
          { id: 'p3', affiliation: 'Internal', name: 'Rep1' },
          { id: 'p4', affiliation: 'Internal', name: 'Rep2' },
        ]}),
      ];
      gong.getCallsPaginated.mockResolvedValue(calls);
      gong.getCallsExtensive.mockResolvedValue(calls);

      const svc = new GongAISearchService(gong as any);
      const result = await svc.search({
        scope: 'global',
        query: 'test',
        filters: { participantType: 'internal-only' },
      });

      // Only c2 and c3 have no external participants
      expect(result.metadata.callsAnalyzed).toBe(2);
    });
  });

  describe('opportunity type filter', () => {
    it('filters calls by opportunity type via SF query', async () => {
      const gong = createMockGongService();
      const calls = [
        makeMockCall({ id: 'c1', crmAssociations: { opportunityIds: ['opp1'] } }),
        makeMockCall({ id: 'c2', crmAssociations: { opportunityIds: ['opp2'] } }),
        makeMockCall({ id: 'c3', crmAssociations: {} }),
      ];
      gong.getCallsPaginated.mockResolvedValue(calls);
      gong.getCallsExtensive.mockResolvedValue(calls);

      const mockSfConnection = {
        query: jest.fn().mockResolvedValue({
          records: [
            { Id: 'opp1', Type: 'New Business' },
            { Id: 'opp2', Type: 'Renewal' },
          ],
        }),
      };

      const svc = new GongAISearchService(gong as any, mockSfConnection as any);
      const result = await svc.search({
        scope: 'global',
        query: 'test',
        filters: { opportunityTypes: ['New Business'] },
      });

      // Only c1 is associated with a 'New Business' opportunity
      expect(result.metadata.callsAnalyzed).toBe(1);
    });

    it('returns all calls when SF query fails', async () => {
      const gong = createMockGongService();
      const calls = [
        makeMockCall({ id: 'c1', crmAssociations: { opportunityIds: ['opp1'] } }),
      ];
      gong.getCallsPaginated.mockResolvedValue(calls);
      gong.getCallsExtensive.mockResolvedValue(calls);

      const mockSfConnection = {
        query: jest.fn().mockRejectedValue(new Error('SF down')),
      };

      const svc = new GongAISearchService(gong as any, mockSfConnection as any);
      const result = await svc.search({
        scope: 'global',
        query: 'test',
        filters: { opportunityTypes: ['New Business'] },
      });

      // Falls back to all calls on error
      expect(result.metadata.callsAnalyzed).toBe(1);
    });

    it('returns 0 calls when no opportunity associations exist', async () => {
      const gong = createMockGongService();
      const calls = [
        makeMockCall({ id: 'c1', crmAssociations: {} }),
      ];
      gong.getCallsPaginated.mockResolvedValue(calls);
      gong.getCallsExtensive.mockResolvedValue(calls);

      const mockSfConnection = { query: jest.fn() };

      const svc = new GongAISearchService(gong as any, mockSfConnection as any);
      const result = await svc.search({
        scope: 'global',
        query: 'test',
        filters: { opportunityTypes: ['New Business'] },
      });

      expect(result.metadata.callsAnalyzed).toBe(0);
    });
  });

  describe('Salesforce context', () => {
    it('fetches opportunity context when scope is opportunity', async () => {
      const gong = createMockGongService();
      const calls = [makeMockCall({ id: 'c1', crmAssociations: { accountIds: ['acc1'] } })];
      gong.getCallsPaginated.mockResolvedValue(calls);
      gong.getCallsExtensive.mockResolvedValue(calls);

      const mockSfConnection = {
        query: jest.fn()
          .mockResolvedValueOnce({
            records: [{
              Name: 'Big Deal',
              StageName: 'Negotiation',
              Amount: 100000,
              CloseDate: '2025-12-01',
              Probability: 75,
              NextStep: 'Contract review',
              Owner: { Name: 'Jane' },
              Account: { Name: 'Acme' },
              Type: 'New Business',
            }],
          })
          .mockResolvedValueOnce({
            records: [{
              Name: 'Acme',
              Industry: 'Tech',
              Type: 'Customer',
              NumberOfEmployees: 500,
              AnnualRevenue: 10000000,
            }],
          }),
      };

      const svc = new GongAISearchService(gong as any, mockSfConnection as any);
      const result = await svc.search({
        scope: 'opportunity',
        query: 'deal status',
        accountId: 'acc1',
        opportunityId: 'opp1',
        opportunityName: 'Big Deal',
      });

      expect(result.answer).toBeTruthy();
      // SF query was called for both opportunity and account
      expect(mockSfConnection.query).toHaveBeenCalledTimes(2);
    });

    it('handles SF context fetch failure gracefully', async () => {
      const gong = createMockGongService();
      gong.getCallsPaginated.mockResolvedValue([]);

      const mockSfConnection = {
        query: jest.fn().mockRejectedValue(new Error('SF timeout')),
      };

      const svc = new GongAISearchService(gong as any, mockSfConnection as any);
      const result = await svc.search({
        scope: 'account',
        query: 'test',
        accountId: 'acc1',
      });

      // Should still return a result even if SF context fails
      expect(result.answer).toBeTruthy();
    });
  });

  describe('buildPrompt coverage', () => {
    it('includes transcript content and participants in prompt', async () => {
      const gong = createMockGongService();
      const calls = [
        makeMockCall({
          id: 'c1',
          title: 'Discovery Call',
          started: '2025-06-01T10:00:00Z',
          duration: 1800,
          parties: [
            { name: 'Alice', affiliation: 'Internal' },
            { name: 'Bob', affiliation: 'External' },
          ],
          topics: ['pricing', 'timeline'],
        }),
      ];
      gong.getCallsPaginated.mockResolvedValue(calls);
      gong.getTranscriptsBatch.mockResolvedValue(new Map([
        ['c1', {
          callId: 'c1',
          transcript: [{
            speakerId: 's1',
            sentences: [
              { start: 0, end: 5, text: 'We discussed pricing.' },
              { start: 5, end: 10, text: 'The timeline is Q4.' },
            ],
          }],
        }],
      ]));

      // Capture the prompt passed to aiService
      const { aiService } = require('../aiService');
      aiService.askWithContext.mockClear();

      const svc = new GongAISearchService(gong as any);
      await svc.search({ scope: 'global', query: 'pricing' });

      const promptArg = aiService.askWithContext.mock.calls[0][0];
      expect(promptArg).toContain('Discovery Call');
      expect(promptArg).toContain('Alice (Internal)');
      expect(promptArg).toContain('Bob (External)');
      expect(promptArg).toContain('pricing, timeline');
      expect(promptArg).toContain('We discussed pricing.');
    });

    it('includes email activity stats in prompt', async () => {
      const gong = createMockGongService();
      gong.getCallsPaginated.mockResolvedValue([]);
      gong.getEmailActivity.mockResolvedValue([
        { id: 'e1', subject: 'Follow up', sentAt: '2025-01-01', opened: true, clicked: false, replied: true },
        { id: 'e2', subject: 'Intro', sentAt: '2025-01-02', opened: true, clicked: true, replied: false },
        { id: 'e3', subject: 'Proposal', sentAt: '2025-01-03', opened: false, clicked: false, replied: false },
      ]);

      const { aiService } = require('../aiService');
      aiService.askWithContext.mockClear();

      const svc = new GongAISearchService(gong as any);
      await svc.search({ scope: 'global', query: 'email engagement' });

      const promptArg = aiService.askWithContext.mock.calls[0][0];
      expect(promptArg).toContain('3 tracked emails');
      expect(promptArg).toContain('2 opened');
      expect(promptArg).toContain('1 clicked');
      expect(promptArg).toContain('1 replied');
    });

    it('uses account scope prompt framing', async () => {
      const gong = createMockGongService();
      gong.getCallsPaginated.mockResolvedValue([]);

      const { aiService } = require('../aiService');
      aiService.askWithContext.mockClear();

      const svc = new GongAISearchService(gong as any);
      await svc.search({ scope: 'account', query: 'test', accountId: 'a1', accountName: 'Acme Corp' });

      const promptArg = aiService.askWithContext.mock.calls[0][0];
      expect(promptArg).toContain('sales intelligence analyst');
      expect(promptArg).toContain('Acme Corp');
    });

    it('uses opportunity scope prompt framing', async () => {
      const gong = createMockGongService();
      gong.getCallsPaginated.mockResolvedValue([]);

      const { aiService } = require('../aiService');
      aiService.askWithContext.mockClear();

      const svc = new GongAISearchService(gong as any);
      await svc.search({
        scope: 'opportunity',
        query: 'test',
        accountId: 'a1',
        opportunityId: 'o1',
        opportunityName: 'Enterprise Deal',
      });

      const promptArg = aiService.askWithContext.mock.calls[0][0];
      expect(promptArg).toContain('deal coach');
      expect(promptArg).toContain('Enterprise Deal');
    });

    it('caps call summaries at 50', async () => {
      const gong = createMockGongService();
      const calls = Array.from({ length: 55 }, (_, i) =>
        makeMockCall({
          id: `call-${i}`,
          title: `Call ${i}`,
          started: new Date(Date.now() - i * 86400000).toISOString(),
        })
      );
      gong.getCallsPaginated.mockResolvedValue(calls);

      const { aiService } = require('../aiService');
      aiService.askWithContext.mockClear();

      const svc = new GongAISearchService(gong as any);
      await svc.search({ scope: 'global', query: 'test' });

      const promptArg = aiService.askWithContext.mock.calls[0][0];
      expect(promptArg).toContain('and 5 more calls');
    });
  });

  describe('getQuarterKey', () => {
    // Access via the search mechanism - verified indirectly through selectTopCalls temporal coverage
    it('provides temporal coverage across quarters', async () => {
      const gong = createMockGongService();
      // Create calls spread across Q1 and Q2
      const calls = [
        ...Array.from({ length: 10 }, (_, i) =>
          makeMockCall({
            id: `q1-${i}`,
            started: '2025-02-15T10:00:00Z',
            topics: ['pricing'],
          })
        ),
        ...Array.from({ length: 10 }, (_, i) =>
          makeMockCall({
            id: `q2-${i}`,
            started: '2025-05-15T10:00:00Z',
            topics: i === 0 ? ['pricing'] : [],
          })
        ),
      ];
      gong.getCallsPaginated.mockResolvedValue(calls);

      const svc = new GongAISearchService(gong as any);
      await svc.search({ scope: 'global', query: 'pricing' });

      const selectedIds = gong.getTranscriptsBatch.mock.calls[0][0] as string[];
      // Should have representation from both Q1 and Q2
      const hasQ1 = selectedIds.some(id => id.startsWith('q1-'));
      const hasQ2 = selectedIds.some(id => id.startsWith('q2-'));
      expect(hasQ1).toBe(true);
      expect(hasQ2).toBe(true);
    });
  });
});
