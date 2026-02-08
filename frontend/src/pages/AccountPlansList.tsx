import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import apiClient from '../services/api';

interface PlanSummary {
  id: string;
  salesforceAccountId: string;
  planName: string;
  status: string;
  planDate: string;
  accountName: string;
  lastExportedAt: string | null;
  lastExportFormat: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AccountPlansList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useQuery({
    queryKey: ['accountPlans'],
    queryFn: async () => {
      const response = await apiClient.get('/api/account-plans');
      return response.data.data as PlanSummary[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (planId: string) => {
      await apiClient.delete(`/api/account-plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountPlans'] });
      setDeletingPlanId(null);
    },
  });

  const handleDelete = (e: React.MouseEvent, planId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingPlanId(planId);
  };

  const confirmDelete = () => {
    if (deletingPlanId) {
      deleteMutation.mutate(deletingPlanId);
    }
  };

  const filteredPlans = (plans || []).filter(plan => {
    const matchesSearch = !search ||
      plan.planName.toLowerCase().includes(search.toLowerCase()) ||
      plan.accountName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-800',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded-lg w-64 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Account Plans</h1>
            <p className="text-gray-600 mt-1">
              {filteredPlans.length} plan{filteredPlans.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by plan name or account..."
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            {['all', 'draft', 'active', 'archived'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  statusFilter === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Plans List */}
        {filteredPlans.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No account plans yet</h3>
            <p className="text-gray-500 mb-6">
              Create your first account plan from any account's detail page.
            </p>
            <Link
              to="/accounts"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition shadow-md"
            >
              Browse Accounts
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPlans.map(plan => (
              <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-purple-200 transition">
                <div className="flex items-center justify-between">
                  <Link
                    to={`/account-plan/${plan.id}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{plan.planName}</h3>
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusColors[plan.status]}`}>
                        {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{plan.accountName}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Plan Date: {new Date(plan.planDate).toLocaleDateString()}</span>
                      <span>·</span>
                      <span>Updated: {new Date(plan.updatedAt).toLocaleDateString()}</span>
                      {plan.lastExportFormat && (
                        <>
                          <span>·</span>
                          <span>Last Export: {plan.lastExportFormat}</span>
                        </>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => handleDelete(e, plan.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete plan"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingPlanId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Account Plan</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to permanently delete this account plan? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingPlanId(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
