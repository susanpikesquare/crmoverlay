import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface AtRiskDeal {
  Id: string;
  Name: string;
  Account: { Name: string };
  Amount: number;
  StageName: string;
  daysStale: number;
  meddpiccScore: number;
  warning: string;
  aiRecommendation: string;
}

interface Props {
  deals: AtRiskDeal[];
}

export default function AtRiskDealsTable({ deals }: Props) {
  const navigate = useNavigate();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'amount' | 'days' | 'meddpicc'>('days');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  // Filter deals
  const filteredDeals = deals.filter(deal => {
    if (filterRisk === 'all') return true;
    if (filterRisk === 'critical') return deal.daysStale > 30 || deal.meddpiccScore < 50;
    if (filterRisk === 'warning') return deal.daysStale > 14 && deal.daysStale <= 30;
    return true;
  });

  // Sort deals
  const sortedDeals = [...filteredDeals].sort((a, b) => {
    switch (sortBy) {
      case 'amount':
        return (b.Amount || 0) - (a.Amount || 0);
      case 'meddpicc':
        return a.meddpiccScore - b.meddpiccScore;
      case 'days':
      default:
        return b.daysStale - a.daysStale;
    }
  });

  const getRiskLevel = (deal: AtRiskDeal) => {
    if (deal.daysStale > 30 || deal.meddpiccScore < 50) {
      return { icon: '🔴', label: 'Critical', color: 'text-red-600', bg: 'bg-red-50' };
    }
    return { icon: '🟡', label: 'Warning', color: 'text-yellow-600', bg: 'bg-yellow-50' };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleRowClick = (dealId: string) => {
    if (expandedRow === dealId) {
      setExpandedRow(null);
    } else {
      setExpandedRow(dealId);
    }
  };

  const handleViewDeal = (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/opportunity/${dealId}`);
  };

  const criticalCount = deals.filter(d => d.daysStale > 30 || d.meddpiccScore < 50).length;
  const warningCount = deals.filter(d => d.daysStale > 14 && d.daysStale <= 30 && d.meddpiccScore >= 50).length;

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterRisk('all')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              filterRisk === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({deals.length})
          </button>
          <button
            onClick={() => setFilterRisk('critical')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              filterRisk === 'critical'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            🔴 Critical ({criticalCount})
          </button>
          <button
            onClick={() => setFilterRisk('warning')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              filterRisk === 'warning'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
            }`}
          >
            🟡 Warning ({warningCount})
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="days">Days Stuck</option>
            <option value="amount">Amount</option>
            <option value="meddpicc">MEDDPICC Score</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                  Risk
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Opportunity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                  Issue
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                  MEDDPICC
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedDeals.map((deal) => {
                const risk = getRiskLevel(deal);
                const isExpanded = expandedRow === deal.Id;

                return (
                  <>
                    {/* Main Row */}
                    <tr
                      key={deal.Id}
                      onClick={() => handleRowClick(deal.Id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {/* Risk Icon */}
                      <td className="px-4 py-3">
                        <div className="text-2xl" title={risk.label}>
                          {risk.icon}
                        </div>
                      </td>

                      {/* Opportunity Name */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-[200px]" title={deal.Name}>
                          {truncate(deal.Name, 30)}
                        </div>
                      </td>

                      {/* Account Name */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{deal.Account.Name}</div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(deal.Amount || 0)}
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {truncate(deal.StageName, 12)}
                        </span>
                      </td>

                      {/* Issue */}
                      <td className="px-4 py-3">
                        <div className={`text-xs font-medium ${risk.color}`}>
                          {deal.daysStale > 14 ? `${deal.daysStale}d stuck` : `Score ${deal.meddpiccScore}%`}
                        </div>
                      </td>

                      {/* MEDDPICC Score */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                deal.meddpiccScore >= 70
                                  ? 'bg-green-500'
                                  : deal.meddpiccScore >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${deal.meddpiccScore}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium text-gray-700 w-10 text-right">
                            {deal.meddpiccScore}%
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => handleViewDeal(deal.Id, e)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View →
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="px-4 py-4 bg-gray-50">
                          <div className="space-y-3">
                            {/* Warning Message */}
                            <div className={`border rounded-lg p-3 ${risk.bg} border-${risk.color.split('-')[1]}-200`}>
                              <div className="flex items-start gap-2">
                                <span className={`font-bold text-sm ${risk.color}`}>⚠️ {risk.label}:</span>
                                <p className={`text-sm flex-1 ${risk.color}`}>{deal.warning}</p>
                              </div>
                            </div>

                            {/* AI Recommendation */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <div className="flex items-start gap-2">
                                <span className="text-yellow-600 font-bold text-sm">⚡ Action Required:</span>
                                <p className="text-sm text-yellow-900 flex-1">{deal.aiRecommendation}</p>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex gap-2">
                              <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                                Update Deal
                              </button>
                              <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                                Schedule Call
                              </button>
                              <button className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">
                                View in Salesforce
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedDeals.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No deals found matching your filters
          </div>
        )}
      </div>
    </div>
  );
}
