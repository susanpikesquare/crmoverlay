/**
 * Gong AI Search Service
 *
 * Orchestrates cross-deal intelligence by:
 * 1. Fetching Gong calls (with pagination) for the given scope
 * 2. Smart-selecting top calls for transcript retrieval
 * 3. Batch-fetching transcripts
 * 4. Gathering email activity
 * 5. Building scope-specific AI prompts
 * 6. Returning structured search results
 */

import { GongService, GongCall, GongTranscript, GongEmailActivity } from './gongService';
import { aiService } from './aiService';
import { Connection } from 'jsforce';

export interface GongSearchFilters {
  timeRange?: 'last30' | 'last90' | 'last180' | 'last365' | 'all';
  participantType?: 'all' | 'external-only' | 'internal-only';
  opportunityTypes?: string[];
}

export interface GongSearchRequest {
  scope: 'account' | 'opportunity' | 'global';
  query: string;
  accountId?: string;
  opportunityId?: string;
  accountName?: string;
  opportunityName?: string;
  filters?: GongSearchFilters;
}

export interface GongSearchSource {
  type: 'call' | 'email';
  id: string;
  title: string;
  date: string;
  url?: string;
}

export interface GongSearchResponse {
  answer: string;
  sources: GongSearchSource[];
  metadata: {
    callsAnalyzed: number;
    transcriptsFetched: number;
    emailsAnalyzed: number;
    lookbackDays: number;
    generatedAt: string;
  };
}

export class GongAISearchService {
  private gongService: GongService;
  private sfConnection: Connection | null;

  constructor(gongService: GongService, sfConnection?: Connection) {
    this.gongService = gongService;
    this.sfConnection = sfConnection || null;
  }

  async search(request: GongSearchRequest): Promise<GongSearchResponse> {
    const { scope, query, accountId, opportunityId, accountName, opportunityName, filters } = request;

    const lookbackDays = this.calculateLookbackDays(scope, filters?.timeRange);
    const fromDateTime = new Date(Date.now() - lookbackDays * 86400000).toISOString();
    const toDateTime = new Date().toISOString();

    console.log(`[Gong AI Search] scope=${scope}, query="${query}", lookback=${lookbackDays}d, filters=${JSON.stringify(filters || {})}`);

    // Step 1: Fetch all calls in the date range
    const allCalls = await this.gongService.getCallsPaginated({ fromDateTime, toDateTime });
    console.log(`[Gong AI Search] Fetched ${allCalls.length} calls from paginated endpoint`);

    // Step 2: Filter by scope
    // For opportunity scope, search at the account level for call discovery — Gong
    // rarely links calls to specific opportunities but does link to accounts.
    // The opportunity context is still passed to the AI prompt for deal-focused analysis.
    let scopedCalls = allCalls;
    const needsExtensiveData = scope !== 'global' ||
      (filters?.participantType && filters.participantType !== 'all') ||
      (filters?.opportunityTypes && filters.opportunityTypes.length > 0);

    if (needsExtensiveData && allCalls.length > 0) {
      // Get extensive data with CRM associations and party affiliations
      const callIds = allCalls.map(c => c.id);
      const batchSize = 100;
      const extensiveCalls: GongCall[] = [];
      for (let i = 0; i < callIds.length; i += batchSize) {
        const batch = callIds.slice(i, i + batchSize);
        const extensiveResult = await this.gongService.getCallsExtensive(batch);
        extensiveCalls.push(...extensiveResult);
      }

      if (scope !== 'global') {
        // For both opportunity and account scope, match by account CRM association
        if (accountId) {
          scopedCalls = extensiveCalls.filter(call => {
            const crm = call.crmAssociations || {};
            return (crm.accountIds || []).includes(accountId);
          });
          console.log(`[Gong AI Search] Account CRM filter: ${scopedCalls.length} calls for accountId ${accountId}`);
        }

        // Fallback: if CRM matching returned 0, try name-based matching on call title/participants
        // This handles cases where Gong has no CRM associations configured
        if (scopedCalls.length === 0) {
          const matchName = (accountName || '').toLowerCase();
          if (matchName && matchName.length >= 3) {
            const nameTokens = matchName.split(/\s+/).filter(t => t.length > 2);
            // Require at least 2 tokens to match to avoid false positives on short/generic words
            const minMatches = Math.min(2, nameTokens.length);
            scopedCalls = extensiveCalls.filter(call => {
              const titleLower = (call.title || '').toLowerCase();
              const titleMatches = nameTokens.filter(token => titleLower.includes(token)).length;
              if (titleMatches >= minMatches) return true;
              // Also check participant email domains (e.g., @navyfederal.org)
              if (call.parties) {
                const partiesStr = call.parties.map(p => `${p.name || ''} ${p.emailAddress || ''}`).join(' ').toLowerCase();
                const partyMatches = nameTokens.filter(token => partiesStr.includes(token)).length;
                if (partyMatches >= minMatches) return true;
              }
              return false;
            });
            if (scopedCalls.length > 0) {
              console.log(`[Gong AI Search] CRM returned 0, name-based fallback: ${scopedCalls.length} calls matching "${nameTokens.join(', ')}"`);
            }
          }
        }
      } else {
        // Global scope with filters — use extensive data for filtering
        scopedCalls = extensiveCalls;
      }

      console.log(`[Gong AI Search] Final: ${scopedCalls.length} scoped calls for ${scope}`);
    }

    // Step 2b: Apply participant type filter
    if (filters?.participantType && filters.participantType !== 'all') {
      const before = scopedCalls.length;
      if (filters.participantType === 'external-only') {
        scopedCalls = scopedCalls.filter(call =>
          call.parties?.some(p => p.affiliation === 'External')
        );
      } else if (filters.participantType === 'internal-only') {
        scopedCalls = scopedCalls.filter(call =>
          !call.parties?.some(p => p.affiliation === 'External')
        );
      }
      console.log(`[Gong AI Search] Participant filter (${filters.participantType}): ${before} → ${scopedCalls.length} calls`);
    }

    // Step 2c: Apply opportunity type filter
    if (filters?.opportunityTypes && filters.opportunityTypes.length > 0 && this.sfConnection) {
      scopedCalls = await this.filterByOpportunityType(scopedCalls, filters.opportunityTypes);
    }

    // Step 3: Smart-select top 15 calls for transcript fetch
    const selectedCalls = this.selectTopCalls(scopedCalls, query, 15);
    console.log(`[Gong AI Search] Selected ${selectedCalls.length} calls for transcript fetch`);

    // Step 4: Batch fetch transcripts
    const selectedIds = selectedCalls.map(c => c.id);
    const transcripts = await this.gongService.getTranscriptsBatch(selectedIds);
    console.log(`[Gong AI Search] Fetched ${transcripts.size} transcripts`);

    // Step 5: Fetch email activity
    let emails: GongEmailActivity[] = [];
    try {
      emails = await this.gongService.getEmailActivity({ fromDateTime, toDateTime });
    } catch (err) {
      console.warn('[Gong AI Search] Email activity fetch failed:', err);
    }
    console.log(`[Gong AI Search] Fetched ${emails.length} emails`);

    // Step 6: Fetch Salesforce context if available
    let sfContext = '';
    if (this.sfConnection) {
      sfContext = await this.getSalesforceContext(scope, accountId, opportunityId);
    }

    // Step 7: Build prompt and call AI
    const prompt = this.buildPrompt(
      scope, query, scopedCalls, selectedCalls, transcripts, emails, sfContext,
      accountName, opportunityName
    );

    const answer = await aiService.askWithContext(prompt, 2000);

    // Step 8: Build sources list
    const sources: GongSearchSource[] = selectedCalls.map(call => ({
      type: 'call' as const,
      id: call.id,
      title: call.title,
      date: call.started || call.scheduled || '',
      url: call.url,
    }));

    return {
      answer,
      sources,
      metadata: {
        callsAnalyzed: scopedCalls.length,
        transcriptsFetched: transcripts.size,
        emailsAnalyzed: emails.length,
        lookbackDays,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Score and select top N calls for transcript retrieval.
   * Scoring: topic relevance to query + recency + duration.
   * Ensures temporal coverage (at least 1 per quarter if available).
   */
  private selectTopCalls(calls: GongCall[], query: string, maxCalls: number): GongCall[] {
    if (calls.length <= maxCalls) return calls;

    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const now = Date.now();

    // Score each call
    const scored = calls.map(call => {
      let score = 0;

      // Topic relevance: +10 per matching query term in topics
      if (call.topics && queryTerms.length > 0) {
        const topicsLower = call.topics.map(t => t.toLowerCase()).join(' ');
        for (const term of queryTerms) {
          if (topicsLower.includes(term)) score += 10;
        }
      }

      // Title relevance: +5 per matching query term in title
      const titleLower = (call.title || '').toLowerCase();
      for (const term of queryTerms) {
        if (titleLower.includes(term)) score += 5;
      }

      // Recency: newer calls score higher (0-20 based on age)
      const callDate = new Date(call.started || call.scheduled || 0).getTime();
      const ageMs = now - callDate;
      const ageDays = ageMs / 86400000;
      score += Math.max(0, 20 - (ageDays / 36.5)); // 20 for today, 0 for 730 days ago

      // Duration: longer calls likely have more substance (0-10)
      const durationMin = (call.duration || 0) / 60;
      score += Math.min(10, durationMin / 6); // cap at 10 for 60+ min calls

      return { call, score, callDate };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Pick top calls with temporal coverage
    const selected: GongCall[] = [];
    const quarterCoverage = new Map<string, boolean>();

    // First pass: take top-scored calls
    for (const { call, callDate } of scored) {
      if (selected.length >= maxCalls) break;
      selected.push(call);
      const q = this.getQuarterKey(new Date(callDate));
      quarterCoverage.set(q, true);
    }

    // Second pass: ensure temporal coverage — swap lowest-scored for quarter representatives
    const allQuarters = new Set(scored.map(s => this.getQuarterKey(new Date(s.callDate))));
    for (const quarter of allQuarters) {
      if (quarterCoverage.has(quarter)) continue;
      // Find best call from this quarter not already selected
      const candidate = scored.find(s =>
        this.getQuarterKey(new Date(s.callDate)) === quarter &&
        !selected.includes(s.call)
      );
      if (candidate && selected.length >= maxCalls) {
        // Replace the lowest-scored selected call
        selected[selected.length - 1] = candidate.call;
        quarterCoverage.set(quarter, true);
      }
    }

    return selected;
  }

  private getQuarterKey(date: Date): string {
    return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  }

  private calculateLookbackDays(scope: string, timeRange?: string): number {
    if (timeRange) {
      switch (timeRange) {
        case 'last30': return 30;
        case 'last90': return 90;
        case 'last180': return 180;
        case 'last365': return 365;
        case 'all': return 3650;
      }
    }
    return scope === 'global' ? 180 : 730;
  }

  private async filterByOpportunityType(calls: GongCall[], oppTypes: string[]): Promise<GongCall[]> {
    if (!this.sfConnection) return calls;

    // Collect all opportunity IDs from calls
    const allOppIds = new Set<string>();
    for (const call of calls) {
      const ids = call.crmAssociations?.opportunityIds || [];
      ids.forEach(id => allOppIds.add(id));
    }

    if (allOppIds.size === 0) {
      console.log(`[Gong AI Search] Opp type filter: no opportunity associations found, returning 0 calls`);
      return [];
    }

    try {
      // Query Salesforce for opportunity types
      const oppIdList = Array.from(allOppIds).map(id => `'${id}'`).join(',');
      const result = await this.sfConnection.query<{ Id: string; Type: string }>(
        `SELECT Id, Type FROM Opportunity WHERE Id IN (${oppIdList})`
      );

      const matchingOppIds = new Set(
        result.records
          .filter(r => r.Type && oppTypes.includes(r.Type))
          .map(r => r.Id)
      );

      const before = calls.length;
      const filtered = calls.filter(call => {
        const ids = call.crmAssociations?.opportunityIds || [];
        return ids.some(id => matchingOppIds.has(id));
      });

      console.log(`[Gong AI Search] Opp type filter (${oppTypes.join(', ')}): ${before} → ${filtered.length} calls`);
      return filtered;
    } catch (error) {
      console.warn('[Gong AI Search] Opportunity type filter query failed:', error);
      return calls;
    }
  }

  /**
   * Fetch Salesforce context for the given scope
   */
  private async getSalesforceContext(
    scope: string,
    accountId?: string,
    opportunityId?: string
  ): Promise<string> {
    if (!this.sfConnection) return '';

    try {
      let context = '';

      if (scope === 'opportunity' && opportunityId) {
        const result = await this.sfConnection.query<any>(
          `SELECT Name, StageName, Amount, CloseDate, NextStep, Type, Probability,
           Owner.Name, Account.Name
           FROM Opportunity WHERE Id = '${opportunityId}' LIMIT 1`
        );
        const opp = result.records?.[0];
        if (opp) {
          context += `\nSalesforce Opportunity: ${opp.Name}`;
          context += `\n  Account: ${opp.Account?.Name || 'N/A'}`;
          context += `\n  Stage: ${opp.StageName} | Amount: $${opp.Amount?.toLocaleString() || 0}`;
          context += `\n  Close Date: ${opp.CloseDate || 'N/A'} | Probability: ${opp.Probability || 'N/A'}%`;
          context += `\n  Next Step: ${opp.NextStep || 'N/A'}`;
          context += `\n  Owner: ${opp.Owner?.Name || 'N/A'} | Type: ${opp.Type || 'N/A'}`;
        }
      }

      if ((scope === 'account' || scope === 'opportunity') && accountId) {
        const result = await this.sfConnection.query<any>(
          `SELECT Name, Industry, Type, Website, NumberOfEmployees, AnnualRevenue
           FROM Account WHERE Id = '${accountId}' LIMIT 1`
        );
        const acct = result.records?.[0];
        if (acct) {
          context += `\nSalesforce Account: ${acct.Name}`;
          context += `\n  Industry: ${acct.Industry || 'N/A'} | Type: ${acct.Type || 'N/A'}`;
          context += `\n  Employees: ${acct.NumberOfEmployees || 'N/A'} | Revenue: $${acct.AnnualRevenue?.toLocaleString() || 'N/A'}`;
        }
      }

      return context;
    } catch (error) {
      console.warn('[Gong AI Search] Salesforce context fetch failed:', error);
      return '';
    }
  }

  /**
   * Build scope-specific AI prompt
   */
  private buildPrompt(
    scope: string,
    query: string,
    allCalls: GongCall[],
    selectedCalls: GongCall[],
    transcripts: Map<string, GongTranscript>,
    emails: GongEmailActivity[],
    sfContext: string,
    accountName?: string,
    opportunityName?: string
  ): string {
    let prompt = '';

    // Role and instruction based on scope
    if (scope === 'account') {
      prompt += `You are a sales intelligence analyst. Analyze Gong call data for the account "${accountName || 'this account'}". `;
      prompt += `Focus on relationship health, stakeholder patterns, sentiment trends, and key themes across conversations.\n\n`;
    } else if (scope === 'opportunity') {
      prompt += `You are a deal coach analyzing Gong call data for the opportunity "${opportunityName || 'this deal'}". `;
      prompt += `Focus on deal progression, objections raised, buying signals, competitive mentions, and recommended next steps.\n\n`;
    } else {
      prompt += `You are a sales analytics expert. Analyze Gong call data across all deals from the last 6 months. `;
      prompt += `Focus on cross-deal trends, quantified themes, strategic patterns, and actionable recommendations.\n\n`;
    }

    prompt += `User's question: "${query}"\n\n`;

    // Salesforce context
    if (sfContext) {
      prompt += `--- Salesforce Context ---${sfContext}\n\n`;
    }

    // Call summaries for all calls (1-line each)
    if (allCalls.length > 0) {
      prompt += `--- All Calls Analyzed (${allCalls.length} total) ---\n`;
      allCalls.forEach((call, idx) => {
        if (idx < 50) { // Cap summaries at 50 to keep prompt manageable
          const date = call.started ? new Date(call.started).toLocaleDateString() : 'Unknown';
          const dur = call.duration ? `${Math.round(call.duration / 60)}m` : '';
          const topics = call.topics?.length ? ` [${call.topics.join(', ')}]` : '';
          prompt += `${idx + 1}. "${call.title}" — ${date} ${dur}${topics}\n`;
        }
      });
      if (allCalls.length > 50) {
        prompt += `... and ${allCalls.length - 50} more calls\n`;
      }
      prompt += `\n`;
    }

    // Detailed transcripts for selected calls
    if (selectedCalls.length > 0) {
      prompt += `--- Detailed Call Transcripts (${selectedCalls.length} key calls) ---\n`;
      selectedCalls.forEach((call, idx) => {
        const transcript = transcripts.get(call.id);
        const date = call.started ? new Date(call.started).toLocaleDateString() : 'Unknown';
        const dur = call.duration ? `${Math.round(call.duration / 60)} min` : '';

        prompt += `\n### Call ${idx + 1}: "${call.title}" — ${date} (${dur})\n`;

        // Participants
        if (call.parties && call.parties.length > 0) {
          const participants = call.parties
            .filter(p => p.name)
            .map(p => `${p.name}${p.affiliation ? ` (${p.affiliation})` : ''}`)
            .join(', ');
          if (participants) prompt += `Participants: ${participants}\n`;
        }

        if (call.topics?.length) {
          prompt += `Topics: ${call.topics.join(', ')}\n`;
        }

        // Transcript content (truncated to ~1500 chars)
        if (transcript && transcript.transcript.length > 0) {
          let text = '';
          for (const segment of transcript.transcript) {
            for (const sentence of segment.sentences) {
              text += sentence.text + ' ';
              if (text.length > 1500) break;
            }
            if (text.length > 1500) break;
          }
          prompt += `Transcript:\n${text.trim().substring(0, 1500)}\n`;
        }
      });
      prompt += `\n`;
    }

    // Email activity summary
    if (emails.length > 0) {
      prompt += `--- Email Activity (${emails.length} tracked emails) ---\n`;
      const replied = emails.filter(e => e.replied).length;
      const opened = emails.filter(e => e.opened).length;
      const clicked = emails.filter(e => e.clicked).length;
      prompt += `Stats: ${opened} opened, ${clicked} clicked, ${replied} replied\n`;
      // Sample subjects (up to 10)
      const sampleEmails = emails.slice(0, 10);
      sampleEmails.forEach(e => {
        prompt += `- "${e.subject}" (${new Date(e.sentAt).toLocaleDateString()}) ${e.replied ? '[replied]' : e.opened ? '[opened]' : ''}\n`;
      });
      prompt += `\n`;
    }

    // Anti-hallucination instruction
    prompt += `---\nIMPORTANT: Answer based ONLY on the data provided above. Cite specific calls by name and date when referencing insights. Do NOT fabricate or guess information not present in the data. If the data is insufficient to answer the question, say so clearly. Provide a structured, actionable answer.`;

    return prompt;
  }
}
