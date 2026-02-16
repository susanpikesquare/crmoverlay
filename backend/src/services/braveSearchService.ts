/**
 * Brave Search Service
 *
 * Pure utility for fetching news articles via the Brave Search API.
 * Uses native fetch — no npm packages required.
 */

export interface BraveNewsArticle {
  title: string;
  url: string;
  description: string;
  age: string;
  pageAge?: string;
  extraSnippets?: string[];
}

export interface BraveSearchResult {
  articles: BraveNewsArticle[];
  query: string;
}

interface BraveSearchOptions {
  count?: number;
  freshness?: string; // pw = past week, pm = past month, pd = past day
}

/**
 * Search Brave News API for recent articles about a company.
 */
export async function searchBraveNews(
  accountName: string,
  apiKey: string,
  options: BraveSearchOptions = {}
): Promise<BraveSearchResult> {
  const count = options.count ?? 20;
  const freshness = options.freshness ?? 'pm';
  const query = `"${accountName}" news`;

  const params = new URLSearchParams({
    q: query,
    count: String(count),
    freshness,
  });

  const response = await fetch(
    `https://api.search.brave.com/res/v1/news/search?${params}`,
    {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brave Search API error ${response.status}: ${body || response.statusText}`);
  }

  const data = await response.json() as { results?: any[] };
  const results = data.results || [];

  const articles: BraveNewsArticle[] = results.map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    description: r.description || '',
    age: r.age || '',
    pageAge: r.page_age || undefined,
    extraSnippets: r.extra_snippets || undefined,
  }));

  return { articles, query };
}

/**
 * Format articles into a context string for AI analysis.
 * Truncates to maxChars to control token usage.
 */
export function formatArticlesForAnalysis(
  articles: BraveNewsArticle[],
  maxChars: number = 6000
): string {
  let result = '';

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const entry = `[${i + 1}] ${a.title}\n${a.description}\nAge: ${a.age}\nURL: ${a.url}\n\n`;

    if (result.length + entry.length > maxChars) break;
    result += entry;
  }

  return result || 'No articles found.';
}
