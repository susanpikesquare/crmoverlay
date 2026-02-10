/**
 * Gong API Service
 *
 * Integrates with Gong's REST API to fetch call recordings, transcripts,
 * and Gong Engage email activity for accounts and opportunities.
 *
 * Auth: Basic Auth (access key + secret key)
 * API docs: https://gong.app.gong.io/settings/api/documentation
 * Rate limit: 3 req/sec, 10K req/day
 */

export interface GongCall {
  id: string;
  title: string;
  scheduled: string;
  started: string;
  duration: number; // seconds
  direction: string;
  parties: Array<{
    id: string;
    emailAddress?: string;
    name?: string;
    speakerId?: string;
    affiliation?: string;
  }>;
  url?: string;
  crmAssociations?: {
    opportunityIds?: string[];
    accountIds?: string[];
    contactIds?: string[];
  };
  topics?: string[];
  sentiment?: string;
}

export interface GongTranscript {
  callId: string;
  transcript: Array<{
    speakerId: string;
    topic?: string;
    sentences: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }>;
}

export interface GongEmailActivity {
  id: string;
  subject: string;
  from: string;
  to: string[];
  sentAt: string;
  opened: boolean;
  clicked: boolean;
  replied: boolean;
  accountId?: string;
}

export class GongService {
  private accessKey: string;
  private secretKey: string;
  private baseUrl = 'https://api.gong.io/v2';
  private lastRequestTime = 0;

  constructor(accessKey: string, secretKey: string) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
  }

  /**
   * Rate-limit aware fetch — ensures max 3 req/sec
   */
  private async throttledFetch(url: string, options: RequestInit): Promise<Response> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 334) { // 1000/3 = ~334ms between requests
      await new Promise(resolve => setTimeout(resolve, 334 - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    const authHeader = 'Basic ' + Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64');

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gong API error (${response.status}): ${errorText}`);
    }

    return response;
  }

  /**
   * Test the Gong API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.throttledFetch(`${this.baseUrl}/calls?fromDateTime=${new Date(Date.now() - 86400000).toISOString()}&toDateTime=${new Date().toISOString()}`, {
        method: 'GET',
      });
      const data: any = await response.json();
      return {
        success: true,
        message: `Connected to Gong. Found ${data.totalRecords ?? 0} recent calls.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Gong connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Get calls with optional date filtering
   */
  async getCalls(filters: {
    fromDateTime?: string;
    toDateTime?: string;
  } = {}): Promise<GongCall[]> {
    const params = new URLSearchParams();
    if (filters.fromDateTime) params.set('fromDateTime', filters.fromDateTime);
    if (filters.toDateTime) params.set('toDateTime', filters.toDateTime);

    const url = `${this.baseUrl}/calls?${params.toString()}`;
    const response = await this.throttledFetch(url, { method: 'GET' });
    const data: any = await response.json();

    return (data.calls || []).map(this.mapCall);
  }

  /**
   * Get extensive call data including CRM associations for specific call IDs
   */
  async getCallsExtensive(callIds: string[]): Promise<GongCall[]> {
    if (callIds.length === 0) return [];

    const response = await this.throttledFetch(`${this.baseUrl}/calls/extensive`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          callIds,
        },
        contentSelector: {
          exposedFields: {
            collaboration: {
              publicComments: true,
            },
            content: {
              topics: true,
            },
            interaction: {
              parties: true,
            },
          },
        },
      }),
    });

    const data: any = await response.json();
    return (data.calls || []).map(this.mapCall);
  }

  /**
   * Get calls associated with a Salesforce opportunity
   * Uses the CRM associations in Gong's call data
   */
  async getCallsForOpportunity(opportunityId: string): Promise<GongCall[]> {
    // Gong stores CRM associations — fetch recent calls with CRM context
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const now = new Date().toISOString();

    // First get call IDs from CRM associations
    try {
      const response = await this.throttledFetch(`${this.baseUrl}/calls`, {
        method: 'GET',
      });
      const listData: any = await response.json();

      if (!listData.calls || listData.calls.length === 0) return [];

      // Get extensive data with CRM associations for these calls
      const callIds = listData.calls.map((c: any) => c.id).slice(0, 100);
      const extensiveResponse = await this.throttledFetch(`${this.baseUrl}/calls/extensive`, {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            callIds,
            fromDateTime: thirtyDaysAgo,
            toDateTime: now,
          },
          contentSelector: {
            exposedFields: {
              collaboration: { publicComments: true },
              content: { topics: true },
              interaction: { parties: true },
            },
          },
        }),
      });

      const extensiveData: any = await extensiveResponse.json();
      const calls = (extensiveData.calls || [])
        .map(this.mapCall)
        .filter((call: GongCall) => {
          const crm = call.crmAssociations || {};
          return (crm.opportunityIds || []).includes(opportunityId);
        });

      return calls;
    } catch (error) {
      console.error('Error fetching Gong calls for opportunity:', error);
      return [];
    }
  }

  /**
   * Get calls associated with a Salesforce account
   */
  async getCallsForAccount(accountId: string): Promise<GongCall[]> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
      const now = new Date().toISOString();

      const response = await this.throttledFetch(`${this.baseUrl}/calls`, {
        method: 'GET',
      });
      const listData: any = await response.json();

      if (!listData.calls || listData.calls.length === 0) return [];

      const callIds = listData.calls.map((c: any) => c.id).slice(0, 100);
      const extensiveResponse = await this.throttledFetch(`${this.baseUrl}/calls/extensive`, {
        method: 'POST',
        body: JSON.stringify({
          filter: {
            callIds,
            fromDateTime: thirtyDaysAgo,
            toDateTime: now,
          },
          contentSelector: {
            exposedFields: {
              collaboration: { publicComments: true },
              content: { topics: true },
              interaction: { parties: true },
            },
          },
        }),
      });

      const extensiveData: any = await extensiveResponse.json();
      const calls = (extensiveData.calls || [])
        .map(this.mapCall)
        .filter((call: GongCall) => {
          const crm = call.crmAssociations || {};
          return (crm.accountIds || []).includes(accountId);
        });

      return calls;
    } catch (error) {
      console.error('Error fetching Gong calls for account:', error);
      return [];
    }
  }

  /**
   * Get transcript for a specific call
   */
  async getTranscript(callId: string): Promise<GongTranscript> {
    const response = await this.throttledFetch(`${this.baseUrl}/calls/transcript`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          callIds: [callId],
        },
      }),
    });

    const data: any = await response.json();
    const callTranscript = data.callTranscripts?.[0];

    return {
      callId,
      transcript: callTranscript?.transcript || [],
    };
  }

  /**
   * Get Gong Engage email activity
   */
  async getEmailActivity(filters: {
    fromDateTime?: string;
    toDateTime?: string;
  } = {}): Promise<GongEmailActivity[]> {
    try {
      const params = new URLSearchParams();
      if (filters.fromDateTime) params.set('fromDateTime', filters.fromDateTime);
      if (filters.toDateTime) params.set('toDateTime', filters.toDateTime);

      const response = await this.throttledFetch(
        `${this.baseUrl}/engage/emails?${params.toString()}`,
        { method: 'GET' }
      );
      const data: any = await response.json();

      return (data.emails || []).map((email: any) => ({
        id: email.id,
        subject: email.subject || 'No Subject',
        from: email.from || '',
        to: email.to || [],
        sentAt: email.sentAt || '',
        opened: email.opened || false,
        clicked: email.clicked || false,
        replied: email.replied || false,
        accountId: email.crmAssociations?.accountId,
      }));
    } catch (error) {
      console.error('Error fetching Gong email activity:', error);
      return [];
    }
  }

  /**
   * Get calls with cursor pagination for large date ranges.
   * Handles Gong's cursor-based pagination, caps at maxCalls total.
   */
  async getCallsPaginated(filters: {
    fromDateTime?: string;
    toDateTime?: string;
  } = {}, maxCalls: number = 1000): Promise<GongCall[]> {
    const allCalls: GongCall[] = [];
    let cursor: string | undefined;

    while (allCalls.length < maxCalls) {
      const params = new URLSearchParams();
      if (filters.fromDateTime) params.set('fromDateTime', filters.fromDateTime);
      if (filters.toDateTime) params.set('toDateTime', filters.toDateTime);
      if (cursor) params.set('cursor', cursor);

      const url = `${this.baseUrl}/calls?${params.toString()}`;
      const response = await this.throttledFetch(url, { method: 'GET' });
      const data: any = await response.json();

      const calls = (data.calls || []).map(this.mapCall);
      allCalls.push(...calls);

      // Check for next page
      if (data.records?.cursor) {
        cursor = data.records.cursor;
      } else {
        break;
      }

      // Safety: stop if we got fewer than a full page
      if (calls.length < 100) break;
    }

    return allCalls.slice(0, maxCalls);
  }

  /**
   * Batch fetch transcripts for multiple call IDs in a single API request.
   * Gong's /calls/transcript endpoint accepts an array of callIds.
   * Returns a Map of callId -> GongTranscript.
   */
  async getTranscriptsBatch(callIds: string[]): Promise<Map<string, GongTranscript>> {
    const result = new Map<string, GongTranscript>();
    if (callIds.length === 0) return result;

    // Batch up to 100 per request
    for (let i = 0; i < callIds.length; i += 100) {
      const batch = callIds.slice(i, i + 100);

      try {
        const response = await this.throttledFetch(`${this.baseUrl}/calls/transcript`, {
          method: 'POST',
          body: JSON.stringify({
            filter: { callIds: batch },
          }),
        });

        const data: any = await response.json();
        for (const ct of (data.callTranscripts || [])) {
          result.set(ct.callId, {
            callId: ct.callId,
            transcript: ct.transcript || [],
          });
        }
      } catch (error) {
        console.error(`[Gong] Error fetching transcript batch (${batch.length} calls):`, error);
      }
    }

    return result;
  }

  /**
   * Map raw Gong API call data to our GongCall interface
   */
  private mapCall = (call: any): GongCall => {
    const metaData = call.metaData || call;

    // Parse CRM associations from Gong's context array format
    let crmAssociations = metaData.crmAssociations || call.crmAssociations;
    if (!crmAssociations && Array.isArray(call.context)) {
      const opportunityIds: string[] = [];
      const accountIds: string[] = [];
      const contactIds: string[] = [];
      for (const ctx of call.context) {
        for (const obj of (ctx.objects || [])) {
          if (obj.objectType === 'Opportunity') opportunityIds.push(obj.objectId);
          else if (obj.objectType === 'Account') accountIds.push(obj.objectId);
          else if (obj.objectType === 'Contact' || obj.objectType === 'Lead') contactIds.push(obj.objectId);
        }
      }
      if (opportunityIds.length > 0 || accountIds.length > 0 || contactIds.length > 0) {
        crmAssociations = { opportunityIds, accountIds, contactIds };
      }
    }

    return {
      id: metaData.id || call.id,
      title: metaData.title || call.title || 'Untitled Call',
      scheduled: metaData.scheduled || '',
      started: metaData.started || metaData.scheduled || '',
      duration: metaData.duration || 0,
      direction: metaData.direction || 'unknown',
      parties: (call.parties || metaData.parties || []).map((p: any) => ({
        id: p.id || '',
        emailAddress: p.emailAddress,
        name: p.name,
        speakerId: p.speakerId,
        affiliation: p.affiliation,
      })),
      url: metaData.url || metaData.media?.audioUrl,
      crmAssociations,
      topics: call.content?.topics?.map((t: any) => t.name) || [],
      sentiment: call.content?.sentiment || undefined,
    };
  };
}

/**
 * Create a GongService from stored credentials
 */
export async function createGongServiceFromDB(): Promise<GongService | null> {
  try {
    // Import dynamically to avoid circular dependencies
    const { default: AIApiKey, AIProvider } = await import('../models/AIApiKey');

    const DEMO_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000';
    const gongKey = await AIApiKey.findOne({
      where: {
        customerId: DEMO_CUSTOMER_ID,
        provider: AIProvider.GONG,
        isActive: true,
      },
    });

    if (!gongKey) return null;

    const credentials = JSON.parse(gongKey.getDecryptedApiKey());
    return new GongService(credentials.accessKey, credentials.secretKey);
  } catch (error) {
    console.error('Error creating Gong service from DB:', error);
    return null;
  }
}
