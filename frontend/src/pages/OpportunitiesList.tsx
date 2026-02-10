import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../services/api';
import AIAssistant from '../components/AIAssistant';

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
  Owner?: { Name: string };
  OwnerId?: string;
  Type?: string;
  IsClosed?: boolean;
}

type ViewId = 'pipeline' | 'renewals' | 'new-business' | 'closing-soon' | 'at-risk' | 'won' | 'all';

interface ViewDef {
  id: ViewId;
  label: string;
  filterFn: (opp: Opportunity) => boolean;
  needsClosed: boolean;
}

const VIEWS: ViewDef[] = [
  {
    id: 'pipeline',
    label: 'My Pipeline',
    filterFn: (opp) => !opp.IsClosed,
    needsClosed: false,
  },
  {
    id: 'renewals',
    label: 'Renewals',
    filterFn: (opp) => (opp.Type || '').toLowerCase().includes('renewal'),
    needsClosed: false,
  },
  {
    id: 'new-business',
    label: 'New Business',
    filterFn: (opp) => !opp.IsClosed && !(opp.Type || '').toLowerCase().includes('renewal'),
    needsClosed: false,
  },
  {
    id: 'closing-soon',
    label: 'Closing Soon',
    filterFn: (opp) => {
      if (opp.IsClosed) return false;
      if (!opp.CloseDate) return false;
      const closeDate = new Date(opp.CloseDate);
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return closeDate >= now && closeDate <= thirtyDaysFromNow;
    },
    needsClosed: false,
  },
  {
    id: 'at-risk',
    label: 'At Risk',
    filterFn: (opp) => opp.IsAtRisk__c || (opp.MEDDPICC_Overall_Score__c != null && opp.MEDDPICC_Overall_Score__c < 60),
    needsClosed: false,
  },
  {
    id: 'won',
    label: 'Won',
    filterFn: (opp) => opp.StageName === 'Closed Won',
    needsClosed: true,
  },
  {
    id: 'all',
    label: 'All',
    filterFn: () => true,
    needsClosed: true,
  },
];

const VALID_VIEW_IDS = new Set(VIEWS.map(v => v.id));

export default function OpportunitiesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view') || 'pipeline';
  const activeView = VALID_VIEW_IDS.has(viewParam as ViewId) ? (viewParam as ViewId) : 'pipeline';

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'closeDate' | 'amount' | 'name' | 'meddpicc'>('closeDate');

  const activeViewDef = VIEWS.find(v => v.id === activeView)!;
  const needsClosed = activeViewDef.needsClosed;

  // Primary query: open opportunities (always loaded)
  const { data: openOpps, isLoading: isLoadingOpen } = useQuery({
    queryKey: ['allOpportunities'],
    queryFn: async () => {
      const response = await apiClient.get('/api/opportunities');
      return response.data.data as Opportunity[];
    },
  });

  // Secondary query: closed opportunities (only loaded when needed)
  const { data: closedOpps, isLoading: isLoadingClosed } = useQuery({
    queryKey: ['closedOpportunities'],
    queryFn: async () => {
      const response = await apiClient.get('/api/opportunities?includeClosed=true');
      return response.data.data as Opportunity[];
    },
    enabled: needsClosed,
  });

  const setActiveView = (viewId: ViewId) => {
    setSearchParams({ view: viewId });
  };

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
      case 'Abandoned':
        return 'bg-gray-200 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMEDDPICCColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Determine the data source: for closed-needing tabs, use the combined set; otherwise just open
  const baseData = useMemo(() => {
    if (needsClosed && closedOpps) {
      return closedOpps; // includeClosed=true already returns open + closed
    }
    return openOpps || [];
  }, [needsClosed, closedOpps, openOpps]);

  const showMeddpicc = activeView !== 'won' && activeView !== 'all';

  const opportunities = useMemo(() => {
    if (!baseData) return [];

    // Apply view filter
    let filtered = baseData.filter(activeViewDef.filterFn);

    // Apply search within tab
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (opp) =>
          opp.Name.toLowerCase().includes(search) ||
          opp.Account.Name.toLowerCase().includes(search) ||
          (opp.Owner?.Name || '').toLowerCase().includes(search)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'closeDate':
          return new Date(a.CloseDate).getTime() - new Date(b.CloseDate).getTime();
        case 'amount':
          return (b.Amount || 0) - (a.Amount || 0);
        case 'name':
          return a.Name.localeCompare(b.Name);
        case 'meddpicc':
          return (b.MEDDPICC_Overall_Score__c || 0) - (a.MEDDPICC_Overall_Score__c || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [baseData, activeViewDef, searchTerm, sortBy]);

  const isLoading = isLoadingOpen || (needsClosed && isLoadingClosed);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="h-10 bg-gray-200 rounded mb-6"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Opportunities</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          {VIEWS.map(view => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeView === view.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>

        {/* Controls bar */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, account, or owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Sort By */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              >
                <option value="closeDate">Close Date</option>
                <option value="amount">Amount</option>
                <option value="name">Name (A-Z)</option>
                <option value="meddpicc">MEDDPICC</option>
              </select>
            </div>

            {/* Result count */}
            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full whitespace-nowrap">
              {opportunities.length} deal{opportunities.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Opportunity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Close Date
                  </th>
                  {showMeddpicc && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      MEDDPICC
                    </th>
                  )}
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
                        onClick={(e) => e.stopPropagation()}
                      >
                        {opp.Name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{opp.Account.Name}</td>
                    <td className="px-6 py-4 text-gray-700 text-sm">{opp.Owner?.Name || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900">
                        {opp.Amount ? formatCurrency(opp.Amount) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 text-sm">{opp.Type || '—'}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStageColor(
                          opp.StageName
                        )}`}
                      >
                        {opp.StageName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {opp.CloseDate ? formatDate(opp.CloseDate) : '—'}
                    </td>
                    {showMeddpicc && (
                      <td className="px-6 py-4">
                        {opp.MEDDPICC_Overall_Score__c != null ? (
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
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {opp.IsAtRisk__c ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                          At Risk
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          Healthy
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

        {/* AI Assistant */}
        <div className="mt-8">
          <AIAssistant />
        </div>
      </div>
    </div>
  );
}
