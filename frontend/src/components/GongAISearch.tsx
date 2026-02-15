import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import apiClient from '../services/api';

interface Props {
  scope: 'account' | 'opportunity' | 'global';
  accountId?: string;
  accountName?: string;
  opportunityId?: string;
  opportunityName?: string;
}

interface SearchSource {
  type: 'call' | 'email';
  id: string;
  title: string;
  date: string;
  url?: string;
}

interface SearchResult {
  answer: string;
  sources: SearchSource[];
  metadata: {
    callsAnalyzed: number;
    transcriptsFetched: number;
    emailsAnalyzed: number;
    lookbackDays: number;
    generatedAt: string;
  };
}

const SUGGESTED_QUERIES: Record<string, string[]> = {
  account: [
    'Summarize all conversations',
    'Key stakeholders',
    'What objections came up?',
    'Sentiment over time',
  ],
  opportunity: [
    'Deal risks from calls',
    'Decision makers',
    'Competitors mentioned',
    'Next steps discussed',
  ],
  global: [
    'Top objections across deals',
    'Most mentioned competitors',
    'Deals with positive momentum',
    'Common themes',
  ],
};

const SCOPE_PLACEHOLDERS: Record<string, string> = {
  account: 'Search across all Gong calls and emails for this account...',
  opportunity: 'Search Gong insights for this deal...',
  global: 'Search for trends across all deals (last 6 months)...',
};

const OPP_TYPE_OPTIONS = ['New Business', 'Renewal', 'Expansion', 'Upsell'];

export default function GongAISearch({ scope, accountId, accountName, opportunityId, opportunityName }: Props) {
  const [query, setQuery] = useState('');
  const [showSources, setShowSources] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [timeRange, setTimeRange] = useState('default');
  const [participantType, setParticipantType] = useState('all');
  const [selectedOppTypes, setSelectedOppTypes] = useState<string[]>([]);

  const filtersActive = timeRange !== 'default' || participantType !== 'all' || selectedOppTypes.length > 0;

  const clearFilters = () => {
    setTimeRange('default');
    setParticipantType('all');
    setSelectedOppTypes([]);
  };

  const toggleOppType = (type: string) => {
    setSelectedOppTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const response = await apiClient.post('/api/gong/ai-search', {
        query: searchQuery,
        scope,
        accountId,
        opportunityId,
        accountName,
        opportunityName,
        filters: {
          timeRange: timeRange !== 'default' ? timeRange : undefined,
          participantType: participantType !== 'all' ? participantType : undefined,
          opportunityTypes: selectedOppTypes.length > 0 ? selectedOppTypes : undefined,
        },
      });
      return response.data.data as SearchResult;
    },
  });

  const handleSearch = (searchQuery?: string) => {
    const q = searchQuery || query;
    if (q.trim().length < 3) return;
    setShowSources(false);
    searchMutation.mutate(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const suggestions = SUGGESTED_QUERIES[scope] || [];

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">Gong AI Search</h2>
          <p className="text-xs text-gray-500">
            {scope === 'global' ? 'Search across all deals (6 months)' :
             scope === 'account' ? `Search calls for ${accountName || 'this account'} (2 years)` :
             `Search calls for ${opportunityName || 'this deal'} (2 years)`}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
          title="Toggle filters"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {filtersActive && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-purple-500 rounded-full"></span>
          )}
        </button>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-gray-600">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="default">Default</option>
                <option value="last30">Last Month</option>
                <option value="last90">Last 3 Months</option>
                <option value="last180">Last 6 Months</option>
                <option value="last365">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-gray-600">Participants</label>
              <select
                value={participantType}
                onChange={(e) => setParticipantType(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All</option>
                <option value="external-only">External/Customer Calls</option>
                <option value="internal-only">Internal Only</option>
              </select>
            </div>

            {scope !== 'global' && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-gray-600">Opp Type</label>
                <div className="flex flex-wrap gap-1">
                  {OPP_TYPE_OPTIONS.map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleOppType(type)}
                      className={`text-xs px-2 py-1 rounded-md border transition ${
                        selectedOppTypes.includes(type)
                          ? 'bg-purple-100 border-purple-400 text-purple-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filtersActive && (
              <button
                onClick={clearFilters}
                className="text-xs text-purple-600 hover:text-purple-800 underline ml-auto"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={SCOPE_PLACEHOLDERS[scope]}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
          disabled={searchMutation.isPending}
        />
        <button
          onClick={() => handleSearch()}
          disabled={searchMutation.isPending || query.trim().length < 3}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {searchMutation.isPending ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Suggested Queries */}
      {!searchMutation.data && !searchMutation.isPending && (
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                setQuery(suggestion);
                handleSearch(suggestion);
              }}
              className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-full hover:bg-purple-100 transition border border-purple-200"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {searchMutation.isPending && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          <p className="text-sm text-gray-600">
            Analyzing Gong calls and emails...
          </p>
        </div>
      )}

      {/* Error State */}
      {searchMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700">
            Failed to search Gong data. Please try again.
          </p>
        </div>
      )}

      {/* Results */}
      {searchMutation.data && !searchMutation.isPending && (
        <div>
          {/* AI Answer */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
            <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
              {searchMutation.data.answer}
            </div>
          </div>

          {/* Sources */}
          {searchMutation.data.sources.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                <span>{showSources ? '\u25BC' : '\u25B6'}</span>
                Sources ({searchMutation.data.sources.length} calls analyzed)
              </button>

              {showSources && (
                <div className="mt-2 space-y-1.5 pl-4">
                  {searchMutation.data.sources.map((source) => (
                    <div key={source.id} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">
                        {source.type === 'call' ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                      </span>
                      <span className="text-gray-700">{source.title}</span>
                      <span className="text-gray-400 text-xs">
                        {source.date ? new Date(source.date).toLocaleDateString() : ''}
                      </span>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Metadata Footer */}
          <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            Analyzed {searchMutation.data.metadata.callsAnalyzed} calls,{' '}
            {searchMutation.data.metadata.transcriptsFetched} transcripts,{' '}
            {searchMutation.data.metadata.emailsAnalyzed} emails
            {' '}&middot;{' '}
            {searchMutation.data.metadata.lookbackDays}-day lookback
            {participantType !== 'all' && (
              <>{' '}&middot;{' '}{participantType === 'external-only' ? 'External only' : 'Internal only'}</>
            )}
            {selectedOppTypes.length > 0 && (
              <>{' '}&middot;{' '}{selectedOppTypes.join(', ')}</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
