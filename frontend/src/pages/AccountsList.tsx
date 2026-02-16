import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';
import AIAssistant from '../components/AIAssistant';
import ScopeSelector from '../components/ScopeSelector';
import FilterBar, { FilterCriteria } from '../components/FilterBar';
import ListViewSelector from '../components/ListViewSelector';
import { useListFilters } from '../hooks/useListFilters';
import { useFieldPermissions } from '../hooks/useFieldPermissions';

interface Account {
  Id: string;
  Name: string;
  Industry: string;
  Priority_Score__c: number;
  Priority_Tier__c: string;
  Clay_Employee_Count__c: number;
  Clay_Employee_Growth_Pct__c: number;
  SixSense_Intent_Score__c: number;
  SixSense_Buying_Stage__c: string;
  ParentId?: string;
  Parent?: { Name: string };
}

interface AccountGroup {
  parent: Account;
  children: Account[];
  isStandalone: boolean;
}

const ACCOUNT_FILTER_FIELDS = [
  { name: 'Industry', label: 'Industry', type: 'string' as const },
  { name: 'Name', label: 'Account Name', type: 'string' as const },
  { name: 'accountIntentScore6sense__c', label: 'Intent Score', type: 'number' as const },
  { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'number' as const },
  { name: 'NumberOfEmployees', label: 'Employees', type: 'number' as const },
  { name: 'accountBuyingStage6sense__c', label: 'Buying Stage', type: 'picklist' as const, picklistValues: ['Decision', 'Consideration', 'Awareness', 'Target'] },
];

export default function AccountsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'priority' | 'intent' | 'name'>('priority');
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [listViewRecords, setListViewRecords] = useState<any[] | null>(null);

  const {
    scope,
    filters,
    setScope,
    addFilter,
    removeFilter,
    clearFilters,
    queryParams,
  } = useListFilters({ objectType: 'Account', defaultSort: 'LastModifiedDate' });

  const { isFieldAccessible } = useFieldPermissions('Account');

  const { data, isLoading } = useQuery({
    queryKey: ['allAccounts', scope, JSON.stringify(filters), queryParams.search],
    queryFn: async () => {
      const response = await apiClient.get('/api/accounts', { params: queryParams });
      return response.data.data as Account[];
    },
  });

  const getPriorityBadgeColor = (tier: string) => {
    if (tier.includes('\uD83D\uDD25')) return 'bg-red-100 text-red-800 border-red-300';
    if (tier.includes('\uD83D\uDD36')) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const getBuyingStageColor = (stage: string) => {
    switch (stage) {
      case 'Decision':
        return 'bg-green-100 text-green-800';
      case 'Consideration':
        return 'bg-yellow-100 text-yellow-800';
      case 'Awareness':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleParentExpand = (parentId: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const buildAccountGroups = (accounts: Account[]): AccountGroup[] => {
    const accountIds = new Set(accounts.map(a => a.Id));
    const childrenByParent = new Map<string, Account[]>();
    const childIds = new Set<string>();

    for (const acc of accounts) {
      if (acc.ParentId && accountIds.has(acc.ParentId)) {
        const siblings = childrenByParent.get(acc.ParentId) || [];
        siblings.push(acc);
        childrenByParent.set(acc.ParentId, siblings);
        childIds.add(acc.Id);
      }
    }

    const standaloneOrParent: Account[] = [];
    for (const acc of accounts) {
      if (!childIds.has(acc.Id)) {
        standaloneOrParent.push(acc);
      }
    }

    return standaloneOrParent.map(acc => ({
      parent: acc,
      children: childrenByParent.get(acc.Id) || [],
      isStandalone: !childrenByParent.has(acc.Id),
    }));
  };

  const { groups, totalAccounts } = useMemo(() => {
    // If a list view is active, use those records
    const sourceData = listViewRecords || data;
    if (!sourceData) return { groups: [] as AccountGroup[], totalAccounts: 0 };

    let filtered = [...sourceData];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (acc) =>
          acc.Name.toLowerCase().includes(search) ||
          (acc.Industry && acc.Industry.toLowerCase().includes(search))
      );
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((acc) => acc.Priority_Tier__c?.includes(priorityFilter));
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (b.Priority_Score__c || 0) - (a.Priority_Score__c || 0);
        case 'intent':
          return (b.SixSense_Intent_Score__c || 0) - (a.SixSense_Intent_Score__c || 0);
        case 'name':
          return a.Name.localeCompare(b.Name);
        default:
          return 0;
      }
    });

    return {
      groups: buildAccountGroups(filtered),
      totalAccounts: filtered.length,
    };
  }, [data, listViewRecords, searchTerm, priorityFilter, sortBy]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const groupCount = groups.filter(g => !g.isStandalone).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">All Accounts</h1>
            <p className="text-gray-600">
              {totalAccounts} account{totalAccounts !== 1 ? 's' : ''} found
              {groupCount > 0 && ` (${groupCount} parent group${groupCount !== 1 ? 's' : ''})`}
            </p>
          </div>
          <ScopeSelector scope={scope} onChange={setScope} />
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <FilterBar
              filters={filters}
              onAddFilter={addFilter}
              onRemoveFilter={removeFilter}
              onClearAll={clearFilters}
              fields={ACCOUNT_FILTER_FIELDS}
            />
            <div className="ml-auto">
              <ListViewSelector
                objectType="Account"
                onSelectResults={(records) => setListViewRecords(records)}
                onClear={() => setListViewRecords(null)}
              />
            </div>
          </div>
        </div>

        {/* Search / Sort Controls */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by name or industry..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority Tier</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="\uD83D\uDD25">{'\uD83D\uDD25'} Hot</option>
                <option value="\uD83D\uDD36">{'\uD83D\uDD36'} Warm</option>
                <option value="\uD83D\uDD35">{'\uD83D\uDD35'} Cool</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'priority' | 'intent' | 'name')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="priority">Priority Score</option>
                <option value="intent">Intent Score</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-8 px-2 py-4"></th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Account Name</th>
                  {isFieldAccessible('Industry') && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Industry</th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                  {isFieldAccessible('accountIntentScore6sense__c') && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Intent Score</th>
                  )}
                  {isFieldAccessible('accountBuyingStage6sense__c') && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Buying Stage</th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Employees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {groups.map((group) => {
                  const isExpanded = expandedParents.has(group.parent.Id);
                  const hasChildren = group.children.length > 0;

                  return (
                    <React.Fragment key={group.parent.Id}>
                      <tr
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/account/${group.parent.Id}`}
                      >
                        <td className="w-8 px-2 py-4 text-center">
                          {hasChildren && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleParentExpand(group.parent.Id); }}
                              className="text-gray-400 hover:text-gray-700 text-sm focus:outline-none"
                            >
                              {isExpanded ? '\u25BC' : '\u25B6'}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/account/${group.parent.Id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {group.parent.Name}
                            </Link>
                            {hasChildren && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                {group.children.length}
                              </span>
                            )}
                          </div>
                        </td>
                        {isFieldAccessible('Industry') && (
                          <td className="px-6 py-4 text-gray-900">{group.parent.Industry}</td>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityBadgeColor(group.parent.Priority_Tier__c || '')}`}>
                              {group.parent.Priority_Tier__c}
                            </span>
                            <span className="text-sm text-gray-600">{group.parent.Priority_Score__c}</span>
                          </div>
                        </td>
                        {isFieldAccessible('accountIntentScore6sense__c') && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                                <div
                                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                                  style={{ width: `${group.parent.SixSense_Intent_Score__c || 0}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium text-gray-900">{group.parent.SixSense_Intent_Score__c}</span>
                            </div>
                          </td>
                        )}
                        {isFieldAccessible('accountBuyingStage6sense__c') && (
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getBuyingStageColor(group.parent.SixSense_Buying_Stage__c || '')}`}>
                              {group.parent.SixSense_Buying_Stage__c}
                            </span>
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">{(group.parent.Clay_Employee_Count__c || 0).toLocaleString()}</span>
                            <span className="text-xs text-green-600 font-medium">+{group.parent.Clay_Employee_Growth_Pct__c || 0}%</span>
                          </div>
                        </td>
                      </tr>

                      {hasChildren && isExpanded && group.children.map((child) => (
                        <tr
                          key={child.Id}
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer bg-gray-50/60"
                          onClick={() => window.location.href = `/account/${child.Id}`}
                        >
                          <td className="w-8 px-2 py-3"></td>
                          <td className="px-6 py-3">
                            <div className="pl-6 flex items-center">
                              <span className="text-gray-400 mr-2 text-xs">{'\u2514'}</span>
                              <Link
                                to={`/account/${child.Id}`}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {child.Name}
                              </Link>
                            </div>
                          </td>
                          {isFieldAccessible('Industry') && (
                            <td className="px-6 py-3 text-gray-900 text-sm">{child.Industry}</td>
                          )}
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityBadgeColor(child.Priority_Tier__c || '')}`}>
                                {child.Priority_Tier__c}
                              </span>
                              <span className="text-sm text-gray-600">{child.Priority_Score__c}</span>
                            </div>
                          </td>
                          {isFieldAccessible('accountIntentScore6sense__c') && (
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                                  <div
                                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                                    style={{ width: `${child.SixSense_Intent_Score__c || 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-gray-900">{child.SixSense_Intent_Score__c}</span>
                              </div>
                            </td>
                          )}
                          {isFieldAccessible('accountBuyingStage6sense__c') && (
                            <td className="px-6 py-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getBuyingStageColor(child.SixSense_Buying_Stage__c || '')}`}>
                                {child.SixSense_Buying_Stage__c}
                              </span>
                            </td>
                          )}
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 text-sm">{(child.Clay_Employee_Count__c || 0).toLocaleString()}</span>
                              <span className="text-xs text-green-600 font-medium">+{child.Clay_Employee_Growth_Pct__c || 0}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {groups.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No accounts found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Assistant */}
        <div className="mt-8">
          <AIAssistant />
        </div>
      </div>
    </div>
  );
}
