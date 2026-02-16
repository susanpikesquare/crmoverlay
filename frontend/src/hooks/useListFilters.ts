/**
 * useListFilters Hook
 *
 * Manages filter/scope/sort state for list views.
 * Serializes state to URL query params for bookmarkability.
 * Provides queryParams object ready for React Query fetch functions.
 */

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';
import type { FilterOperator, FilterCriteria } from '../components/FilterBar';

export type { FilterOperator, FilterCriteria };

export type OwnershipScope = 'my' | 'team' | 'all';

interface UseListFiltersOptions {
  objectType: 'Account' | 'Opportunity';
  defaultSort?: string;
  defaultSortDir?: 'ASC' | 'DESC';
}

export function useListFilters(options: UseListFiltersOptions) {
  const { objectType, defaultSort, defaultSortDir = 'DESC' } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  // Fetch user info for role-based default scope
  const { data: userData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await apiClient.get('/api/user/me');
      return response.data.data;
    },
    staleTime: 30 * 60 * 1000,
  });

  // Fetch scope defaults from config
  const { data: scopeDefaults } = useQuery({
    queryKey: ['scopeDefaults'],
    queryFn: async () => {
      const response = await apiClient.get('/api/metadata/scope-defaults');
      return response.data.data;
    },
    staleTime: 30 * 60 * 1000,
  });

  // Determine default scope based on user role
  const defaultScope: OwnershipScope = useMemo(() => {
    if (scopeDefaults && userData?.role) {
      return scopeDefaults[userData.role as keyof typeof scopeDefaults] || 'my';
    }
    return 'my';
  }, [scopeDefaults, userData?.role]);

  // State from URL params
  const scope = (searchParams.get('scope') as OwnershipScope) || defaultScope;
  const sortField = searchParams.get('sortField') || defaultSort || '';
  const sortDir = (searchParams.get('sortDir') || defaultSortDir) as 'ASC' | 'DESC';
  const search = searchParams.get('search') || '';

  // Filters stored in local state (too complex for URL)
  const [filters, setFilters] = useState<FilterCriteria[]>(() => {
    const f = searchParams.get('filters');
    if (f) {
      try { return JSON.parse(f); } catch { return []; }
    }
    return [];
  });

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      return next;
    });
  }, [setSearchParams]);

  const setScope = useCallback((newScope: OwnershipScope) => {
    updateParams({ scope: newScope });
  }, [updateParams]);

  const setSearch = useCallback((newSearch: string) => {
    updateParams({ search: newSearch || null });
  }, [updateParams]);

  const setSortField = useCallback((field: string) => {
    updateParams({ sortField: field || null });
  }, [updateParams]);

  const setSortDir = useCallback((dir: 'ASC' | 'DESC') => {
    updateParams({ sortDir: dir });
  }, [updateParams]);

  const addFilter = useCallback((filter: FilterCriteria) => {
    setFilters(prev => {
      const next = [...prev, filter];
      updateParams({ filters: JSON.stringify(next) });
      return next;
    });
  }, [updateParams]);

  const removeFilter = useCallback((index: number) => {
    setFilters(prev => {
      const next = prev.filter((_, i) => i !== index);
      updateParams({ filters: next.length > 0 ? JSON.stringify(next) : null });
      return next;
    });
  }, [updateParams]);

  const clearFilters = useCallback(() => {
    setFilters([]);
    updateParams({ filters: null });
  }, [updateParams]);

  // Build query params object for API calls
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (scope && scope !== defaultScope) params.scope = scope;
    if (scope) params.scope = scope;
    if (filters.length > 0) params.filters = JSON.stringify(filters);
    if (search) params.search = search;
    if (sortField) params.sortField = sortField;
    if (sortDir) params.sortDir = sortDir;
    return params;
  }, [scope, filters, search, sortField, sortDir, defaultScope]);

  // Query key that changes when filters change
  const queryKey = useMemo(
    () => [objectType.toLowerCase() + 's', scope, JSON.stringify(filters), search, sortField, sortDir],
    [objectType, scope, filters, search, sortField, sortDir]
  );

  return {
    // State
    scope,
    filters,
    search,
    sortField,
    sortDir,
    defaultScope,
    userRole: userData?.role,

    // Actions
    setScope,
    setSearch,
    setSortField,
    setSortDir,
    addFilter,
    removeFilter,
    clearFilters,

    // For API calls
    queryParams,
    queryKey,
  };
}
