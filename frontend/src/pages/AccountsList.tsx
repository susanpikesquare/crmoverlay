import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';

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
}

export default function AccountsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'priority' | 'intent' | 'name'>('priority');

  const { data, isLoading } = useQuery({
    queryKey: ['allAccounts'],
    queryFn: async () => {
      const response = await apiClient.get('/api/accounts');
      return response.data.data as Account[];
    },
  });

  const getPriorityBadgeColor = (tier: string) => {
    if (tier.includes('🔥')) return 'bg-red-100 text-red-800 border-red-300';
    if (tier.includes('🔶')) return 'bg-orange-100 text-orange-800 border-orange-300';
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

  const filteredAndSortedAccounts = () => {
    if (!data) return [];

    let filtered = [...data];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (acc) =>
          acc.Name.toLowerCase().includes(search) ||
          acc.Industry.toLowerCase().includes(search)
      );
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((acc) => acc.Priority_Tier__c.includes(priorityFilter));
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return b.Priority_Score__c - a.Priority_Score__c;
        case 'intent':
          return b.SixSense_Intent_Score__c - a.SixSense_Intent_Score__c;
        case 'name':
          return a.Name.localeCompare(b.Name);
        default:
          return 0;
      }
    });

    return filtered;
  };

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

  const accounts = filteredAndSortedAccounts();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All Accounts</h1>
          <p className="text-gray-600">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                placeholder="Search by name or industry..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority Tier
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="🔥">🔥 Hot</option>
                <option value="🔶">🔶 Warm</option>
                <option value="🔵">🔵 Cool</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Intent Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Buying Stage
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Employees
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {accounts.map((account) => (
                  <tr
                    key={account.Id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/account/${account.Id}`}
                  >
                    <td className="px-6 py-4">
                      <Link
                        to={`/account/${account.Id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {account.Name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{account.Industry}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityBadgeColor(
                            account.Priority_Tier__c
                          )}`}
                        >
                          {account.Priority_Tier__c}
                        </span>
                        <span className="text-sm text-gray-600">
                          {account.Priority_Score__c}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                          <div
                            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                            style={{ width: `${account.SixSense_Intent_Score__c}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {account.SixSense_Intent_Score__c}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getBuyingStageColor(
                          account.SixSense_Buying_Stage__c
                        )}`}
                      >
                        {account.SixSense_Buying_Stage__c}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900">
                          {account.Clay_Employee_Count__c.toLocaleString()}
                        </span>
                        <span className="text-xs text-green-600 font-medium">
                          +{account.Clay_Employee_Growth_Pct__c}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {accounts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No accounts found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
