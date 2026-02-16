import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PriorityItem {
  id: string;
  type: 'deal-risk' | 'missing-info' | 'icp-alert' | 'task-due' | 'no-next-step' | 'stage-stuck' | 'at-risk-deal';
  title: string;
  description: string;
  urgency: 'critical' | 'high' | 'medium';
  relatedAccountId?: string;
  relatedAccountName?: string;
  relatedOpportunityId?: string;
  relatedOpportunityName?: string;
  dealAmount?: number;
  dueDate?: string;
  actionButton: {
    label: string;
    action: string;
  };
}

interface UnifiedPrioritiesPanelProps {
  priorities: PriorityItem[];
  isLoading?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export default function UnifiedPrioritiesPanel({ priorities, isLoading }: UnifiedPrioritiesPanelProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const visibleCount = 6;
  const shown = expanded ? priorities : priorities.slice(0, visibleCount);
  const remaining = priorities.length - visibleCount;

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deal-risk': return '🚨';
      case 'at-risk-deal': return '⚠️';
      case 'missing-info': return '📋';
      case 'icp-alert': return '🎯';
      case 'task-due': return '📅';
      case 'no-next-step': return '➡️';
      case 'stage-stuck': return '🔄';
      default: return '📌';
    }
  };

  const getRowBorder = (type: string) => {
    if (type === 'at-risk-deal' || type === 'deal-risk') return 'border-l-amber-400';
    if (type === 'task-due') return 'border-l-blue-400';
    if (type === 'missing-info') return 'border-l-purple-400';
    return 'border-l-slate-300';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Top Priorities & Risks</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Top Priorities & Risks</h2>
          <p className="text-sm text-slate-500">Ranked by urgency — merged priorities and at-risk items</p>
        </div>
        <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-medium rounded-full">
          {priorities.length} items
        </span>
      </div>

      {priorities.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <div className="text-3xl mb-2">🎉</div>
          <p className="font-medium">You're all caught up!</p>
          <p className="text-sm mt-1">No urgent priorities or at-risk items right now.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {shown.map(item => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border border-l-4 ${getRowBorder(item.type)} bg-slate-50 hover:bg-slate-100 transition-colors`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="text-base mt-0.5 flex-shrink-0">{getTypeIcon(item.type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-900 truncate">{item.title}</span>
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${getUrgencyBadge(item.urgency)}`}>
                          {item.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {item.relatedAccountName && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                            </svg>
                            {item.relatedAccountName}
                          </span>
                        )}
                        {item.dealAmount !== undefined && item.dealAmount > 0 && (
                          <span className="font-medium text-slate-700">{formatCurrency(item.dealAmount)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(item.actionButton.action)}
                    className="flex-shrink-0 px-3 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                  >
                    {item.actionButton.label}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {remaining > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium py-2"
            >
              {expanded ? 'Show Less' : `Show ${remaining} More`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
