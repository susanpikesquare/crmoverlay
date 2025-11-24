import { useState } from 'react';

interface DealSummary {
  overview: string;
  stakeholders: string[];
  currentStatus: string;
  risks: string[];
  nextActions: string[];
  generatedAt: string;
}

interface AIDealSummaryProps {
  summary: DealSummary | null;
  isLoading: boolean;
}

export default function AIDealSummary({ summary, isLoading }: AIDealSummaryProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'status', 'risks', 'nextActions'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-md p-6 border border-purple-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">AI Deal Summary</h2>
            <p className="text-sm text-gray-600">Powered by Claude</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6"></div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-md p-6 border border-purple-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">AI Deal Summary</h2>
            <p className="text-sm text-gray-600">Powered by Claude</p>
          </div>
        </div>

        <div className="text-center py-8">
          <p className="text-gray-600">Unable to generate AI summary</p>
          <p className="text-sm text-gray-500 mt-1">
            Check if ANTHROPIC_API_KEY is configured
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-md p-6 border border-purple-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">AI Deal Summary</h2>
            <p className="text-xs text-gray-600">
              Generated {formatDate(summary.generatedAt)}
            </p>
          </div>
        </div>

        <button
          onClick={() => copyToClipboard(JSON.stringify(summary, null, 2))}
          className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition"
        >
          📋 Copy
        </button>
      </div>

      {/* Overview */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection('overview')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span>📊</span> Overview
          </h3>
          <span className="text-gray-400">{expandedSections.has('overview') ? '▲' : '▼'}</span>
        </button>
        {expandedSections.has('overview') && (
          <p className="text-sm text-gray-700 pl-7 leading-relaxed">{summary.overview}</p>
        )}
      </div>

      {/* Current Status */}
      <div className="mb-4 pb-4 border-b border-purple-200">
        <button
          onClick={() => toggleSection('status')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span>🎯</span> Current Status
          </h3>
          <span className="text-gray-400">{expandedSections.has('status') ? '▲' : '▼'}</span>
        </button>
        {expandedSections.has('status') && (
          <p className="text-sm text-gray-700 pl-7 leading-relaxed">{summary.currentStatus}</p>
        )}
      </div>

      {/* Stakeholders */}
      {summary.stakeholders.length > 0 && (
        <div className="mb-4 pb-4 border-b border-purple-200">
          <button
            onClick={() => toggleSection('stakeholders')}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span>👥</span> Key Stakeholders
            </h3>
            <span className="text-gray-400">
              {expandedSections.has('stakeholders') ? '▲' : '▼'}
            </span>
          </button>
          {expandedSections.has('stakeholders') && (
            <ul className="pl-7 space-y-1">
              {summary.stakeholders.map((stakeholder, index) => (
                <li key={index} className="text-sm text-gray-700">
                  • {stakeholder}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Risks */}
      {summary.risks.length > 0 && (
        <div className="mb-4 pb-4 border-b border-purple-200">
          <button
            onClick={() => toggleSection('risks')}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span>⚠️</span> Risks & Blockers
            </h3>
            <span className="text-gray-400">{expandedSections.has('risks') ? '▲' : '▼'}</span>
          </button>
          {expandedSections.has('risks') && (
            <ul className="pl-7 space-y-2">
              {summary.risks.map((risk, index) => (
                <li key={index} className="text-sm text-gray-700">
                  • {risk}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Next Actions */}
      {summary.nextActions.length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('nextActions')}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span>✅</span> Next Actions
            </h3>
            <span className="text-gray-400">
              {expandedSections.has('nextActions') ? '▲' : '▼'}
            </span>
          </button>
          {expandedSections.has('nextActions') && (
            <ul className="pl-7 space-y-2">
              {summary.nextActions.map((action, index) => (
                <li key={index} className="text-sm text-gray-700">
                  • {action}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Footer Note */}
      <div className="mt-6 pt-4 border-t border-purple-200">
        <p className="text-xs text-gray-500 text-center italic">
          AI-generated insights based on Salesforce data. Always verify recommendations.
        </p>
      </div>
    </div>
  );
}
