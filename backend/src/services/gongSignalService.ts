/**
 * Gong Buying Signal Detection Service
 *
 * Analyzes Gong call transcripts with Claude to detect buying signals
 * and risk indicators. Results are cached for 1 hour.
 */

import { Connection } from 'jsforce';
import { Pool } from 'pg';
import { createGongServiceFromDB, GongTranscript } from './gongService';
import { aiService } from './aiService';
import { metadataCache } from './sessionMetadataCache';
import { getSignalsForOpportunities, StoredSignal } from './signalStore';

// --- Types ---

export interface GongDealSignal {
  opportunityId: string;
  opportunityName: string;
  accountId: string;
  accountName: string;
  signals: Array<{
    type: string;
    confidence: 'high' | 'medium' | 'low';
    evidence: string;
    callTitle: string;
  }>;
  momentum: 'accelerating' | 'steady' | 'stalling' | 'unknown';
  summary: string;
  callCount: number;
  lastCallDate: string;
}

const GONG_SIGNALS_NAMESPACE = 'gong-signals';
const GONG_SIGNALS_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get Gong buying signals with caching.
 * Checks persistent DB store first, then in-memory cache, then runs on-demand analysis.
 */
export async function getGongBuyingSignals(
  connection: Connection,
  userId: string,
  pool: Pool
): Promise<GongDealSignal[]> {
  // Check in-memory cache first
  const cached = metadataCache.get<GongDealSignal[]>(userId, 'default', GONG_SIGNALS_NAMESPACE);
  if (cached) {
    return cached;
  }

  // Check persistent store for fresh (non-expired) results
  try {
    // Get user's open opportunity IDs to look up stored signals
    const oppResult = await connection.query(`
      SELECT Id FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsClosed = false
        AND StageName NOT IN ('Prospecting', 'Qualification')
      LIMIT 20
    `);
    const oppIds = (oppResult.records as any[]).map(r => r.Id);

    if (oppIds.length > 0) {
      const storedSignals = await getSignalsForOpportunities(pool, oppIds);
      const gongStored = storedSignals.filter(s => s.source === 'gong');

      if (gongStored.length > 0) {
        const results = gongStored.map(s => s.signalData as GongDealSignal);
        metadataCache.set(userId, 'default', GONG_SIGNALS_NAMESPACE, results, GONG_SIGNALS_TTL_MS);
        return results;
      }
    }
  } catch (error) {
    console.error('[GongSignals] Error checking persistent store:', error);
    // Fall through to on-demand analysis
  }

  const results = await analyzeDealsForBuyingSignals(connection, userId, pool);
  metadataCache.set(userId, 'default', GONG_SIGNALS_NAMESPACE, results, GONG_SIGNALS_TTL_MS);
  return results;
}

/**
 * Analyze open deals for buying signals using Gong transcripts + Claude.
 */
async function analyzeDealsForBuyingSignals(
  connection: Connection,
  userId: string,
  _pool: Pool
): Promise<GongDealSignal[]> {
  // Step 1: Create Gong service — return empty if not configured
  let gongService;
  try {
    gongService = await createGongServiceFromDB();
  } catch {
    return [];
  }
  if (!gongService) return [];

  // Step 2: Get user's open opportunities
  let opportunities: any[];
  try {
    const result = await connection.query(`
      SELECT Id, Name, AccountId, Account.Name, StageName, CloseDate
      FROM Opportunity
      WHERE OwnerId = '${userId}'
        AND IsClosed = false
        AND StageName NOT IN ('Prospecting', 'Qualification')
      ORDER BY Amount DESC NULLS LAST
      LIMIT 10
    `);
    opportunities = result.records as any[];
  } catch (error) {
    console.error('[GongSignals] Error fetching opportunities:', error);
    return [];
  }

  if (opportunities.length === 0) return [];

  // Step 3: Fetch calls for each opportunity
  const dealCallMap = new Map<string, { opp: any; callIds: string[]; callTitles: Map<string, string> }>();
  const allCallIds: string[] = [];

  for (const opp of opportunities) {
    try {
      const calls = await gongService.getCallsForOpportunity(opp.Id);
      if (calls.length === 0) continue;

      // Take top 5 most recent calls
      const recentCalls = calls
        .sort((a, b) => new Date(b.started).getTime() - new Date(a.started).getTime())
        .slice(0, 5);

      const callIds = recentCalls.map(c => c.id);
      const callTitles = new Map<string, string>();
      recentCalls.forEach(c => callTitles.set(c.id, c.title || 'Untitled Call'));

      dealCallMap.set(opp.Id, { opp, callIds, callTitles });
      allCallIds.push(...callIds);
    } catch (error) {
      console.error(`[GongSignals] Error fetching calls for ${opp.Id}:`, error);
      // Skip this deal, continue others
    }
  }

  if (allCallIds.length === 0) return [];

  // Step 4: Batch-fetch transcripts (up to 100 per batch)
  let transcripts: Map<string, GongTranscript>;
  try {
    transcripts = await gongService.getTranscriptsBatch(allCallIds);
  } catch (error) {
    console.error('[GongSignals] Error fetching transcripts:', error);
    return [];
  }

  // Step 5: Analyze each deal with Claude
  const results: GongDealSignal[] = [];

  for (const [oppId, { opp, callIds, callTitles }] of dealCallMap) {
    try {
      const dealSignal = await analyzeDealTranscripts(
        oppId,
        opp.Name,
        opp.AccountId || '',
        opp.Account?.Name || 'Unknown',
        callIds,
        callTitles,
        transcripts
      );
      if (dealSignal) {
        results.push(dealSignal);
      }
    } catch (error) {
      console.error(`[GongSignals] Error analyzing deal ${oppId}:`, error);
      // Skip this deal, continue others
    }
  }

  return results;
}

/**
 * Analyze transcripts for a single deal using Claude.
 * Exported for use by the nightly batch scheduler.
 */
export async function analyzeDealTranscripts(
  opportunityId: string,
  opportunityName: string,
  accountId: string,
  accountName: string,
  callIds: string[],
  callTitles: Map<string, string>,
  transcripts: Map<string, GongTranscript>
): Promise<GongDealSignal | null> {
  // Build transcript text for the prompt
  let transcriptText = '';
  let lastCallDate = '';
  let callCount = 0;

  for (const callId of callIds) {
    const transcript = transcripts.get(callId);
    if (!transcript || !transcript.transcript || transcript.transcript.length === 0) continue;

    callCount++;
    const title = callTitles.get(callId) || 'Untitled Call';
    transcriptText += `\n--- Call: ${title} ---\n`;

    // Truncate each transcript to ~1500 chars (matching gongAISearchService pattern)
    let text = '';
    for (const segment of transcript.transcript) {
      for (const sentence of segment.sentences) {
        text += sentence.text + ' ';
        if (text.length > 1500) break;
      }
      if (text.length > 1500) break;
    }
    transcriptText += text.trim().substring(0, 1500) + '\n';
  }

  if (callCount === 0) return null;

  // Build Claude prompt
  const prompt = `Analyze these sales call transcripts for deal "${opportunityName}" (Account: ${accountName}) and identify buying signals and risk indicators.

${transcriptText}

Return ONLY a JSON object with no extra text:
{
  "signals": [
    {
      "type": "budget-confirmed|timeline-pressure|champion-identified|multi-threading|competitive-threat|decision-process-revealed|positive-momentum|objection-surfaced",
      "confidence": "high|medium|low",
      "evidence": "Brief quote or observation from the transcript",
      "callTitle": "Which call this was detected in"
    }
  ],
  "momentum": "accelerating|steady|stalling|unknown",
  "summary": "One sentence overall assessment"
}`;

  // Call Claude
  const response = await aiService.askWithContext(prompt, 1500);

  // Check if AI is not configured
  if (response.startsWith('AI is not configured')) {
    return null;
  }

  // Parse structured JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      opportunityId,
      opportunityName,
      accountId,
      accountName,
      signals: Array.isArray(parsed.signals)
        ? parsed.signals.map((s: any) => ({
            type: s.type || 'unknown',
            confidence: ['high', 'medium', 'low'].includes(s.confidence) ? s.confidence : 'low',
            evidence: s.evidence || '',
            callTitle: s.callTitle || '',
          }))
        : [],
      momentum: ['accelerating', 'steady', 'stalling', 'unknown'].includes(parsed.momentum)
        ? parsed.momentum
        : 'unknown',
      summary: parsed.summary || '',
      callCount,
      lastCallDate: lastCallDate || new Date().toISOString(),
    };
  } catch (parseError) {
    console.error('[GongSignals] Error parsing AI response:', parseError);
    return null;
  }
}
