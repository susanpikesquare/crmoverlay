import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';

interface Opportunity {
  Id: string;
  Name: string;
  Account: { Name: string };
  Amount: number;
  StageName: string;
  CloseDate: string;
  MEDDPICC_Overall_Score__c: number;
  IsAtRisk__c: boolean;
  Probability: number;
}

export default function OpportunitiesList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'closeDate' | 'amount' | 'name'>('closeDate');

  const { data, isLoading } = useQuery({
    queryKey: ['allOpportunities'],
    queryFn: async () => {
      const response = await apiClient.get('/api/opportunities');
      return response.data.data as Opportunity[];
    },
  });

  // Fetch admin config to get opportunity stages
  const { data: configData } = useQuery({
    queryKey: ['adminConfig'],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/config');
      return response.data.data;
    },
  });

  const opportunityStages = configData?.opportunityStages || ['Discovery', 'Value Confirmation', 'Negotiation'];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Discovery':
        return 'bg-blue-100 text-blue-800';
      case 'Value Confirmation':
        return 'bg-purple-100 text-purple-800';
      case 'Negotiation':
        return 'bg-green-100 text-green-800';
      case 'Closed Won':
        return 'bg-emerald-100 text-emerald-800';
      case 'Closed Lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMEDDPICCColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredAndSortedOpportunities = () => {
    if (!data) return [];

    let filtered = [...data];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (opp) =>
          opp.Name.toLowerCase().includes(search) ||
          opp.Account.Name.toLowerCase().includes(search)
      );
    }

    // Apply stage filter
    if (stageFilter !== 'all') {
      filtered = filtered.filter((opp) => opp.StageName === stageFilter);
    }

    // Apply at-risk filter
    if (atRiskOnly) {
      filtered = filtered.filter((opp) => opp.IsAtRisk__c);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'closeDate':
          return new Date(a.CloseDate).getTime() - new Date(b.CloseDate).getTime();
        case 'amount':
          return b.Amount - a.Amount;
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

  const opportunities = filteredAndSortedOpportunities();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All Opportunities</h1>
          <p className="text-gray-600">
            {opportunities.length} opportunit{opportunities.length !== 1 ? 'ies' : 'y'} found
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                placeholder="Search by name or account..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Stage Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stage
              </label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Stages</option>
                {opportunityStages.map((stage: string) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>

            {/* At-Risk Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Show At-Risk
              </label>
              <button
                onClick={() => setAtRiskOnly(!atRiskOnly)}
                className={`w-full px-4 py-2 rounded-lg font-medium transition ${
                  atRiskOnly
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {atRiskOnly ? 'At-Risk Only' : 'Show All'}
              </button>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'closeDate' | 'amount' | 'name')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="closeDate">Close Date</option>
                <option value="amount">Amount</option>
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
                    Opportunity Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Close Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    MEDDPICC
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {opportunities.map((opp) => (
                  <tr
                    key={opp.Id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/opportunity/${opp.Id}`}
                  >
                    <td className="px-6 py-4">
                      <Link
                        to={`/opportunity/${opp.Id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {opp.Name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{opp.Account.Name}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(opp.Amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStageColor(
                          opp.StageName
                        )}`}
                      >
                        {opp.StageName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{formatDate(opp.CloseDate)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                          <div
                            className={`h-2 rounded-full ${
                              opp.MEDDPICC_Overall_Score__c >= 80
                                ? 'bg-green-500'
                                : opp.MEDDPICC_Overall_Score__c >= 60
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${opp.MEDDPICC_Overall_Score__c}%` }}
                          ></div>
                        </div>
                        <span
                          className={`text-sm font-medium ${getMEDDPICCColor(
                            opp.MEDDPICC_Overall_Score__c
                          )}`}
                        >
                          {opp.MEDDPICC_Overall_Score__c}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {opp.IsAtRisk__c ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                          ⚠️ At Risk
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          ✓ Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {opportunities.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No opportunities found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
