import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PriorityItem {
  id: string;
  type: 'deal-risk' | 'missing-info' | 'icp-alert' | 'task-due' | 'no-next-step' | 'stage-stuck';
  title: string;
  description: string;
  urgency: 'critical' | 'high' | 'medium';
  relatedAccountId?: string;
  relatedAccountName?: string;
  relatedOpportunityId?: string;
  relatedOpportunityName?: string;
  dueDate?: string;
  actionButton: {
    label: string;
    action: string;
  };
}

interface TodaysPrioritiesPanelProps {
  priorities: PriorityItem[];
}

export default function TodaysPrioritiesPanel({ priorities }: TodaysPrioritiesPanelProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const displayLimit = 5;
  const displayedPriorities = isExpanded ? priorities : priorities.slice(0, displayLimit);
  const hasMore = priorities.length > displayLimit;

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deal-risk':
        return '⚠️';
      case 'missing-info':
        return '📝';
      case 'icp-alert':
        return '🎯';
      case 'task-due':
        return '✅';
      case 'no-next-step':
        return '🔄';
      case 'stage-stuck':
        return '⏸️';
      default:
        return '📌';
    }
  };

  const handleAction = (action: string) => {
    navigate(action);
  };

  if (priorities.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">🎯 Today's Priorities</h2>
        <div className="text-center py-8">
          <span className="text-4xl mb-3 block">✨</span>
          <p className="text-gray-600">You're all caught up!</p>
          <p className="text-sm text-gray-500 mt-1">No critical items need your attention right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">🎯 Today's Priorities</h2>
        <span className="text-sm text-gray-600">{priorities.length} items</span>
      </div>

      <div className="space-y-3">
        {displayedPriorities.map((priority) => (
          <div
            key={priority.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 text-2xl mt-1">
                {getTypeIcon(priority.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {priority.title}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium border ${getUrgencyBadge(
                      priority.urgency
                    )}`}
                  >
                    {priority.urgency}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-2">{priority.description}</p>

                {/* Related Records */}
                {(priority.relatedAccountName || priority.relatedOpportunityName) && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    {priority.relatedAccountName && (
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                        </svg>
                        {priority.relatedAccountName}
                      </span>
                    )}
                    {priority.relatedOpportunityName && (
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {priority.relatedOpportunityName}
                      </span>
                    )}
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={() => handleAction(priority.actionButton.action)}
                  className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
                >
                  {priority.actionButton.label}
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expand/Collapse Button */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            {isExpanded ? (
              <>
                Show Less
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                Show {priorities.length - displayLimit} More
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
