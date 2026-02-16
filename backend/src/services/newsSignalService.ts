/**
 * News Signal Service
 *
 * Uses Claude's built-in web search to find news-based buying signals
 * for accounts. Configurable via admin-authored prompts.
 */

import { Pool } from 'pg';
import { aiService } from './aiService';
import { getAccountNameCache, upsertSignals, StoredSignal } from './signalStore';
import { AdminSettingsService, BuyingSignalConfig } from './adminSettings';

// --- Types ---

export interface NewsSignal {
  type: 'news';
  category: string;
  headline: string;
  summary: string;
  url?: string;
  relevance: 'high' | 'medium' | 'low';
  publishedDate?: string;
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
 * Search for news about a single account using Claude web search.
 */
export async function searchNewsForAccount(
  accountName: string,
  adminPrompt: string,
  _pool: Pool
): Promise<NewsSearchResult> {
  const prompt = `Search for recent news about "${accountName}" that could indicate buying signals for a B2B sales team.

${adminPrompt || DEFAULT_NEWS_PROMPT}

Return ONLY a JSON object with no extra text:
{
  "signals": [
    {
      "type": "news",
      "category": "store-opening|executive-hire|expansion|funding|partnership|product-launch|restructuring|other",
      "headline": "The news headline",
      "summary": "Brief relevant summary (1-2 sentences)",
      "url": "Source URL if available",
      "relevance": "high|medium|low",
      "publishedDate": "ISO date if available"
    }
  ],
  "summary": "One sentence overall assessment of buying signal strength"
}

If no relevant news is found, return: {"signals": [], "summary": "No recent buying signals detected."}`;

  const { text, citations } = await aiService.askWithWebSearch(prompt, 2000);

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { signals: [], summary: 'Unable to parse news results.', citations };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const signals: NewsSignal[] = Array.isArray(parsed.signals)
      ? parsed.signals.map((s: any) => ({
          type: 'news' as const,
          category: s.category || 'other',
          headline: s.headline || 'News detected',
          summary: s.summary || '',
          url: s.url || undefined,
          relevance: ['high', 'medium', 'low'].includes(s.relevance) ? s.relevance : 'medium',
          publishedDate: s.publishedDate || undefined,
        }))
      : [];

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
