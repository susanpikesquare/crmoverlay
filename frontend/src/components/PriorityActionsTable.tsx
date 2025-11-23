import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PriorityAccount {
  Id: string;
  Name: string;
  priorityTier: '🔥 Hot' | '🔶 Warm' | '🔵 Cool';
  employeeCount: number;
  employeeGrowthPct: number;
  intentScore: number;
  buyingStage: string;
  techStack: string;
  topSignal: string;
  aiRecommendation: string;
  isGroup?: boolean;
  groupCount?: number;
  groupedAccounts?: any[];
}

interface Props {
  accounts: PriorityAccount[];
}

export default function PriorityActionsTable({ accounts }: Props) {
  const navigate = useNavigate();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'intent' | 'employees' | 'stage'>('priority');
  const [filterTier, setFilterTier] = useState<string>('all');

  // Filter accounts
  const filteredAccounts = accounts.filter(account => {
    if (filterTier === 'all') return true;
    return account.priorityTier === filterTier;
  });

  // Sort accounts
  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    switch (sortBy) {
      case 'intent':
        return b.intentScore - a.intentScore;
      case 'employees':
        return b.employeeCount - a.employeeCount;
      case 'stage':
        return a.buyingStage.localeCompare(b.buyingStage);
      case 'priority':
      default:
        return b.intentScore - a.intentScore;
    }
  });

  const getPriorityIcon = (tier: string) => {
    if (tier.includes('🔥')) return { icon: '🔥', color: 'text-red-600', bg: 'bg-red-50' };
    if (tier.includes('🔶')) return { icon: '🔶', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { icon: '🔵', color: 'text-blue-600', bg: 'bg-blue-50' };
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleRowClick = (accountId: string) => {
    if (expandedRow === accountId) {
      setExpandedRow(null);
    } else {
      setExpandedRow(accountId);
    }
  };

  const handleViewAccount = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/account/${accountId}`);
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterTier('all')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              filterTier === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({accounts.length})
          </button>
          <button
            onClick={() => setFilterTier('🔥 Hot')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              filterTier === '🔥 Hot'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            🔥 Hot ({accounts.filter(a => a.priorityTier === '🔥 Hot').length})
          </button>
          <button
            onClick={() => setFilterTier('🔶 Warm')}
            className={`px-3 py-1 rounded text-sm font-medium ${
              filterTier === '🔶 Warm'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            🔶 Warm ({accounts.filter(a => a.priorityTier === '🔶 Warm').length})
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="priority">Priority</option>
            <option value="intent">Intent Score</option>
            <option value="employees">Employees</option>
            <option value="stage">Stage</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                  Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Signals
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Recommendation
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedAccounts.map((account) => {
                const priority = getPriorityIcon(account.priorityTier);
                const isExpanded = expandedRow === account.Id;

                return (
                  <>
                    {/* Main Row */}
                    <tr
                      key={account.Id}
                      onClick={() => handleRowClick(account.Id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {/* Priority Score */}
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-2 ${priority.color}`}>
                          <span className="text-lg">{priority.icon}</span>
                          <span className="font-bold text-lg">{account.intentScore}</span>
                        </div>
                      </td>

                      {/* Account Name */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">
                          {account.Name}
                          {account.isGroup && (
                            <span className="ml-2 text-sm text-gray-500 font-normal">
                              ({account.groupCount} locations)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Signals */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 text-sm text-gray-700">
                          <span className="flex items-center gap-1" title="Employee Count">
                            👥 {formatNumber(account.employeeCount)}
                            <span className="text-green-600 text-xs">
                              (+{account.employeeGrowthPct}%)
                            </span>
                          </span>
                          <span className="flex items-center gap-1" title="Intent Score">
                            🎯 {account.intentScore}/100
                          </span>
                          <span
                            className="flex items-center gap-1 truncate max-w-[150px]"
                            title={`Tech Stack: ${account.techStack}`}
                          >
                            💼 {truncate(account.techStack, 15)}
                          </span>
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {account.buyingStage}
                        </span>
                      </td>

                      {/* Recommendation */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{truncate(account.aiRecommendation, 60)}</div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => handleViewAccount(account.Id, e)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 bg-gray-50">
                          <div className="space-y-3">
                            {/* Full Recommendation */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-start gap-2">
                                <span className="text-blue-600 font-bold text-sm">✨ AI Recommendation:</span>
                                <p className="text-sm text-blue-900 flex-1">{account.aiRecommendation}</p>
                              </div>
                            </div>

                            {/* Detailed Signals */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Top Signal</div>
                                <div className="text-sm text-gray-900">{account.topSignal}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Tech Stack</div>
                                <div className="text-sm text-gray-900 bg-gray-100 rounded px-3 py-2">
                                  {account.techStack}
                                </div>
                              </div>
                            </div>

                            {/* Grouped Accounts */}
                            {account.isGroup && account.groupedAccounts && (
                              <div>
                                <div className="text-xs text-gray-500 mb-2">Locations in this group:</div>
                                <div className="grid grid-cols-3 gap-2">
                                  {account.groupedAccounts.map((grouped) => (
                                    <div
                                      key={grouped.Id}
                                      onClick={(e) => handleViewAccount(grouped.Id, e)}
                                      className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                                    >
                                      • {grouped.Name}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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

        {sortedAccounts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No accounts found matching your filters
          </div>
        )}
      </div>
    </div>
  );
}
