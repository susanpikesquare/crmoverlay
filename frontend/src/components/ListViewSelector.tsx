/**
 * ListViewSelector Component
 *
 * Dropdown that shows available Salesforce list views for an object type.
 * Selecting a view executes it server-side and returns results.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';

interface ListView {
  id: string;
  label: string;
  developerName: string;
}

interface ListViewSelectorProps {
  objectType: string;
  onSelectResults: (records: any[], columns: any[]) => void;
  onClear: () => void;
}

export default function ListViewSelector({ objectType, onSelectResults, onClear }: ListViewSelectorProps) {
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const { data: listViews, isLoading: isLoadingViews } = useQuery({
    queryKey: ['listViews', objectType],
    queryFn: async () => {
      const response = await apiClient.get(`/api/listviews/${objectType}`);
      return response.data.data as ListView[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const handleSelect = async (viewId: string) => {
    if (!viewId) {
      setSelectedViewId('');
      onClear();
      return;
    }

    setSelectedViewId(viewId);
    setIsLoadingResults(true);

    try {
      const response = await apiClient.get(`/api/listviews/${objectType}/${viewId}/results`);
      const data = response.data.data;
      onSelectResults(data.records || [], data.columns || []);
    } catch (error) {
      console.error('Error fetching list view results:', error);
    } finally {
      setIsLoadingResults(false);
    }
  };

  if (isLoadingViews) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading views...
      </div>
    );
  }

  if (!listViews || listViews.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-600 whitespace-nowrap">SF View:</label>
      <select
        value={selectedViewId}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={isLoadingResults}
        className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        <option value="">Custom filters</option>
        {listViews.map((view) => (
          <option key={view.id} value={view.id}>
            {view.label}
          </option>
        ))}
      </select>
      {isLoadingResults && (
        <svg className="animate-spin h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
    </div>
  );
}
