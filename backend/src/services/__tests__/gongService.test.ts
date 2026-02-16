import { GongService, createGongServiceFromDB } from '../gongService';

// Save original fetch
const originalFetch = global.fetch;

let mockFetch: jest.Mock;
let service: GongService;

beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch;
  service = new GongService('test-access-key', 'test-secret-key');
});

afterAll(() => {
  global.fetch = originalFetch;
});

function mockJsonResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

describe('testConnection', () => {
  it('returns success when API responds', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ totalRecords: 5 }));

    const result = await service.testConnection();
    expect(result.success).toBe(true);
    expect(result.message).toContain('5 recent calls');
  });

  it('returns failure when API throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await service.testConnection();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Network error');
  });
});

describe('getCalls', () => {
  it('returns mapped calls from API', async () => {
    const apiResponse = {
      calls: [
        {
          metaData: { id: 'call1', title: 'Discovery Call', duration: 1800, direction: 'Outbound' },
          parties: [{ id: 'p1', name: 'Alice', affiliation: 'Internal' }],
          content: { topics: [{ name: 'Pricing' }] },
        },
      ],
    };
    mockFetch.mockResolvedValueOnce(mockJsonResponse(apiResponse));

    const calls = await service.getCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe('call1');
    expect(calls[0].title).toBe('Discovery Call');
    expect(calls[0].duration).toBe(1800);
    expect(calls[0].topics).toEqual(['Pricing']);
  });

  it('passes date filters as query params', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ calls: [] }));

    await service.getCalls({ fromDateTime: '2025-01-01', toDateTime: '2025-06-01' });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('fromDateTime=2025-01-01');
    expect(url).toContain('toDateTime=2025-06-01');
  });

  it('returns empty array when no calls', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ calls: [] }));
    const calls = await service.getCalls();
    expect(calls).toEqual([]);
  });
});

describe('getCalls - mapCall with context array CRM associations', () => {
  it('parses CRM associations from context array format', async () => {
    const apiResponse = {
      calls: [
        {
          id: 'call-crm',
          title: 'Deal Call',
          duration: 900,
          context: [
            {
              objects: [
                { objectType: 'Opportunity', objectId: 'opp123' },
                { objectType: 'Account', objectId: 'acc456' },
                { objectType: 'Contact', objectId: 'con789' },
              ],
            },
          ],
        },
      ],
    };
    mockFetch.mockResolvedValueOnce(mockJsonResponse(apiResponse));

    const calls = await service.getCalls();
    expect(calls[0].crmAssociations).toBeDefined();
    expect(calls[0].crmAssociations!.opportunityIds).toContain('opp123');
    expect(calls[0].crmAssociations!.accountIds).toContain('acc456');
    expect(calls[0].crmAssociations!.contactIds).toContain('con789');
  });
});

describe('getCallsExtensive', () => {
  it('returns empty array for empty callIds', async () => {
    const calls = await service.getCallsExtensive([]);
    expect(calls).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends POST with call IDs', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      calls: [{ metaData: { id: 'c1', title: 'Call 1' } }],
    }));

    const calls = await service.getCallsExtensive(['c1']);
    expect(calls).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/calls/extensive'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('getCallsPaginated', () => {
  it('fetches single page when no cursor', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      calls: [{ metaData: { id: 'c1', title: 'Call 1' } }],
    }));

    const calls = await service.getCallsPaginated({}, 100);
    expect(calls).toHaveLength(1);
  });

  it('follows cursor for multiple pages', async () => {
    // Page 1: 100 calls + cursor
    const page1Calls = Array.from({ length: 100 }, (_, i) => ({
      metaData: { id: `c${i}`, title: `Call ${i}` },
    }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      calls: page1Calls,
      records: { cursor: 'page2cursor' },
    }));

    // Page 2: 50 calls, no cursor
    const page2Calls = Array.from({ length: 50 }, (_, i) => ({
      metaData: { id: `c${100 + i}`, title: `Call ${100 + i}` },
    }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      calls: page2Calls,
    }));

    const calls = await service.getCallsPaginated({}, 200);
    expect(calls).toHaveLength(150);
  });

  it('caps at maxCalls', async () => {
    const page1Calls = Array.from({ length: 100 }, (_, i) => ({
      metaData: { id: `c${i}`, title: `Call ${i}` },
    }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      calls: page1Calls,
      records: { cursor: 'next' },
    }));

    const page2Calls = Array.from({ length: 100 }, (_, i) => ({
      metaData: { id: `c${100 + i}`, title: `Call ${100 + i}` },
    }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      calls: page2Calls,
    }));

    const calls = await service.getCallsPaginated({}, 120);
    expect(calls).toHaveLength(120);
  });
});

describe('getTranscriptsBatch', () => {
  it('returns empty map for empty call IDs', async () => {
    const result = await service.getTranscriptsBatch([]);
    expect(result.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches and maps transcripts', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      callTranscripts: [
        {
          callId: 'c1',
          transcript: [{ speakerId: 's1', sentences: [{ start: 0, end: 5, text: 'Hello' }] }],
        },
      ],
    }));

    const result = await service.getTranscriptsBatch(['c1']);
    expect(result.size).toBe(1);
    expect(result.get('c1')!.callId).toBe('c1');
  });

  it('batches at 100 per request', async () => {
    const callIds = Array.from({ length: 150 }, (_, i) => `c${i}`);
    mockFetch.mockResolvedValue(mockJsonResponse({ callTranscripts: [] }));

    await service.getTranscriptsBatch(callIds);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('getCallsForOpportunity', () => {
  it('returns calls associated with the opportunity', async () => {
    // First call: GET /calls - list call IDs
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      calls: [{ id: 'c1' }, { id: 'c2' }],
    }));
    // Second call: POST /calls/extensive - detailed data with CRM associations
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      calls: [
        {
          metaData: { id: 'c1', title: 'Opp Call' },
          context: [{ objects: [{ objectType: 'Opportunity', objectId: 'opp1' }] }],
        },
        {
          metaData: { id: 'c2', title: 'Other Call' },
          context: [{ objects: [{ objectType: 'Opportunity', objectId: 'opp2' }] }],
        },
      ],
    }));

    const calls = await service.getCallsForOpportunity('opp1');
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe('c1');
  });

  it('returns empty array when no calls exist', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ calls: [] }));

    const calls = await service.getCallsForOpportunity('opp1');
    expect(calls).toEqual([]);
  });

  it('returns empty array on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const calls = await service.getCallsForOpportunity('opp1');
    expect(calls).toEqual([]);
  });
});

describe('getCallsForAccount', () => {
  it('returns calls associated with the account', async () => {
    // First call: GET /calls
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      calls: [{ id: 'c1' }, { id: 'c2' }],
    }));
    // Second call: POST /calls/extensive
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      calls: [
        {
          metaData: { id: 'c1', title: 'Account Call' },
          context: [{ objects: [{ objectType: 'Account', objectId: 'acc1' }] }],
        },
        {
          metaData: { id: 'c2', title: 'Other Account' },
          context: [{ objects: [{ objectType: 'Account', objectId: 'acc2' }] }],
        },
      ],
    }));

    const calls = await service.getCallsForAccount('acc1');
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe('c1');
  });

  it('returns empty array when no calls exist', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ calls: [] }));

    const calls = await service.getCallsForAccount('acc1');
    expect(calls).toEqual([]);
  });

  it('returns empty array on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const calls = await service.getCallsForAccount('acc1');
    expect(calls).toEqual([]);
  });
});

describe('getTranscript', () => {
  it('returns transcript for a call', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      callTranscripts: [{
        callId: 'c1',
        transcript: [{ speakerId: 's1', sentences: [{ start: 0, end: 5, text: 'Hello' }] }],
      }],
    }));

    const result = await service.getTranscript('c1');
    expect(result.callId).toBe('c1');
    expect(result.transcript).toHaveLength(1);
  });

  it('returns empty transcript when no data', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ callTranscripts: [] }));

    const result = await service.getTranscript('c1');
    expect(result.callId).toBe('c1');
    expect(result.transcript).toEqual([]);
  });
});

describe('getEmailActivity', () => {
  it('returns mapped emails', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      emails: [
        {
          id: 'e1',
          subject: 'Follow up',
          from: 'rep@co.com',
          to: ['cust@co.com'],
          sentAt: '2025-01-15',
          opened: true,
          clicked: false,
          replied: true,
          crmAssociations: { accountId: 'acc1' },
        },
      ],
    }));

    const emails = await service.getEmailActivity();
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe('Follow up');
    expect(emails[0].replied).toBe(true);
    expect(emails[0].accountId).toBe('acc1');
  });

  it('returns empty array on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API down'));

    const emails = await service.getEmailActivity();
    expect(emails).toEqual([]);
  });
});

describe('throttledFetch', () => {
  it('includes auth header', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ calls: [] }));

    await service.getCalls();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toMatch(/^Basic /);
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: jest.fn().mockResolvedValue('Rate limited'),
    });

    await expect(service.getCalls()).rejects.toThrow('Gong API error (429)');
  });
});

describe('createGongServiceFromDB', () => {
  it('returns null when no credentials found', async () => {
    jest.mock('../../models/AIApiKey', () => ({
      default: { findOne: jest.fn().mockResolvedValue(null) },
      AIProvider: { GONG: 'gong' },
    }));

    // Since dynamic import is used, this test verifies the function handles null
    const result = await createGongServiceFromDB();
    // Will return null because the mock returns null
    expect(result).toBeNull();
  });
});
