/**
 * News Signal Service
 *
 * Uses Brave Search API to fetch news articles, then Claude (via askWithContext)
 * to analyze them for buying signals. Scores signals by category weight,
 * relevance, and recency.
 */

import { Pool } from 'pg';
import { aiService } from './aiService';
import { getAccountNameCache, upsertSignals, StoredSignal } from './signalStore';
import { AdminSettingsService, BuyingSignalConfig } from './adminSettings';
import { searchBraveNews, formatArticlesForAnalysis } from './braveSearchService';

// --- Types ---

export interface NewsSignal {
  type: 'news';
  category: string;
  headline: string;
  summary: string;
  url?: string;
  relevance: 'high' | 'medium' | 'low';
  publishedDate?: string;
  score?: number;
}

export interface NewsSearchResult {
  signals: NewsSignal[];
  summary: string;
  citations: Array<{ url: string; title: string }>;
}

// Default prompt template if admin hasn't configured one
const DEFAULT_NEWS_PROMPT = `Look for recent news that could indicate buying signals such as:
- New store openings, office expansions, or new locations
- Executive hires (new VP, CTO, CRO appointments)
- Expansion announcements or market entry
- Funding rounds, acquisitions, or IPO activity
- Strategic partnerships or major contracts
- Product launches or major initiatives
- Organizational restructuring or digital transformation`;

/**
 * Compute a signal score based on category weight, relevance, and recency.
 * Returns 0-100.
 */
export function computeSignalScore(
  category: string,
  relevance: 'high' | 'medium' | 'low',
  publishedDate: string | undefined,
  categoryWeights: Record<string, number>
): number {
  // Relevance factor
  const relevanceFactor = relevance === 'high' ? 1.0 : relevance === 'medium' ? 0.6 : 0.3;

  // Category weight from admin config (default 1.0)
  const categoryWeight = categoryWeights[category] ?? 1.0;

  // Recency factor based on published date
  let recencyFactor = 0.4; // default for unknown dates
  if (publishedDate) {
    const daysAgo = Math.max(0, (Date.now() - new Date(publishedDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo <= 1) recencyFactor = 1.0;
    else if (daysAgo <= 7) recencyFactor = 0.8;
    else if (daysAgo <= 14) recencyFactor = 0.6;
    else if (daysAgo <= 30) recencyFactor = 0.4;
    else recencyFactor = 0.2;
  }

  return Math.round(categoryWeight * relevanceFactor * recencyFactor * 100);
}

/**
 * Build a map of category name -> weight from admin config.
 */
export function buildCategoryWeightMap(config: BuyingSignalConfig): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const cat of config.signalCategories || []) {
    if (cat.active) {
      weights[cat.name] = cat.weight ?? 1.0;
      // Also map by id for flexible matching
      weights[cat.id] = cat.weight ?? 1.0;
    }
  }
  return weights;
}

/**
 * Search for news about a single account using Brave Search + AI analysis.
 */
export async function searchNewsForAccount(
  accountName: string,
  adminPrompt: string,
  pool: Pool
): Promise<NewsSearchResult> {
  // Load config for Brave API key and category weights
  const adminSettings = new AdminSettingsService(pool);
  let config: BuyingSignalConfig;
  try {
    config = await adminSettings.getBuyingSignalConfig();
  } catch {
    config = getDefaultConfig();
  }

  const braveApiKey = config.braveApiKey;
  if (!braveApiKey) {
    return { signals: [], summary: 'Brave Search API key not configured. Add it in Admin > Buying Signals.', citations: [] };
  }

  // Step 1: Fetch articles from Brave Search
  let braveResult;
  try {
    braveResult = await searchBraveNews(accountName, braveApiKey);
  } catch (error: any) {
    console.error(`[NewsSignals] Brave Search error for "${accountName}":`, error.message);
    return { signals: [], summary: `News search failed: ${error.message}`, citations: [] };
  }

  if (braveResult.articles.length === 0) {
    return { signals: [], summary: `No recent news found for "${accountName}".`, citations: [] };
  }

  // Build citations from Brave results
  const citations = braveResult.articles.map(a => ({ url: a.url, title: a.title }));

  // Step 2: Format articles and ask AI to analyze
  const articlesContext = formatArticlesForAnalysis(braveResult.articles);

  const signalHint = adminPrompt
    ? `Focus on: ${adminPrompt.substring(0, 500)}`
    : 'Focus on: expansions, executive hires, funding, partnerships, product launches';

  const prompt = `Analyze these news articles about "${accountName}" for buying signals.
${signalHint}

ARTICLES:
${articlesContext}
Return JSON only: {"signals":[{"type":"news","category":"string","headline":"string","summary":"string","url":"string","relevance":"high|medium|low","publishedDate":"YYYY-MM-DD or null"}],"summary":"one sentence"}
If no relevant signals: {"signals":[],"summary":"No signals found."}`;

  const text = await aiService.askWithContext(prompt, 1024);

  // Check if AI returned an error message
  if (text.startsWith('AI is not configured')) {
    return { signals: [], summary: text, citations: [] };
  }

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { signals: [], summary: 'Unable to parse news results.', citations };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const categoryWeights = buildCategoryWeightMap(config);

    const signals: NewsSignal[] = Array.isArray(parsed.signals)
      ? parsed.signals.map((s: any) => {
          const relevance: 'high' | 'medium' | 'low' =
            ['high', 'medium', 'low'].includes(s.relevance) ? s.relevance : 'medium';
          const publishedDate = s.publishedDate || undefined;
          const score = computeSignalScore(s.category || 'other', relevance, publishedDate, categoryWeights);

          return {
            type: 'news' as const,
            category: s.category || 'other',
            headline: s.headline || 'News detected',
            summary: s.summary || '',
            url: s.url || undefined,
            relevance,
            publishedDate,
            score,
          };
        })
      : [];

    // Sort by score descending
    signals.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return {
      signals,
      summary: parsed.summary || '',
      citations,
    };
  } catch (error) {
    console.error('[NewsSignals] Error parsing response:', error);
    return { signals: [], summary: 'Failed to parse news results.', citations };
  }
}

/**
 * Run batch news search for all cached accounts.
 * Called by the nightly scheduler.
 */
export async function runNewsBatch(pool: Pool): Promise<number> {
  // Load admin config
  const adminSettings = new AdminSettingsService(pool);
  let config: BuyingSignalConfig;
  try {
    config = await adminSettings.getBuyingSignalConfig();
  } catch {
    config = getDefaultConfig();
  }

  if (!config.newsSearchEnabled) {
    console.log('[NewsSignals] News search disabled in config — skipping');
    return 0;
  }

  // Build prompt from admin config
  const adminPrompt = buildPromptFromConfig(config);

  // Load account name cache
  const accounts = await getAccountNameCache(pool);
  if (accounts.length === 0) {
    console.log('[NewsSignals] No cached accounts — skipping news batch. Accounts will be cached when users load their hubs.');
    return 0;
  }

  // Limit per run
  const maxAccounts = config.maxAccountsPerRun || 30;
  const accountsToProcess = accounts.slice(0, maxAccounts);

  const signalsToStore: StoredSignal[] = [];

  for (const account of accountsToProcess) {
    try {
      const result = await searchNewsForAccount(account.accountName, adminPrompt, pool);

      if (result.signals.length > 0) {
        signalsToStore.push({
          accountId: account.accountId,
          accountName: account.accountName,
          source: 'news',
          signalData: {
            signals: result.signals,
            summary: result.summary,
            citations: result.citations,
            searchedAt: new Date().toISOString(),
          },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Small delay between API calls to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[NewsSignals] Error searching news for "${account.accountName}":`, error);
    }
  }

  // Store all results
  if (signalsToStore.length > 0) {
    await upsertSignals(pool, signalsToStore);
  }

  return signalsToStore.length;
}

/**
 * Build the prompt template from admin config's signal categories.
 */
function buildPromptFromConfig(config: BuyingSignalConfig): string {
  let prompt = config.newsPromptTemplate || DEFAULT_NEWS_PROMPT;

  // Append active signal categories
  const activeCategories = (config.signalCategories || []).filter(c => c.active);
  if (activeCategories.length > 0) {
    prompt += '\n\nSpecifically look for these signal types:\n';
    for (const cat of activeCategories) {
      prompt += `- ${cat.name}: ${cat.description}`;
      if (cat.keywords && cat.keywords.length > 0) {
        prompt += ` (keywords: ${cat.keywords.join(', ')})`;
      }
      prompt += '\n';
    }
  }

  return prompt;
}

function getDefaultConfig(): BuyingSignalConfig {
  return {
    enabled: true,
    newsSearchEnabled: false,
    schedule: '0 2 * * *',
    maxAccountsPerRun: 30,
    newsPromptTemplate: DEFAULT_NEWS_PROMPT,
    signalCategories: [],
  };
}
