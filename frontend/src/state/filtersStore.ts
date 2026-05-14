// Zustand store for dashboard-style shared filters (Renewal / NB Forecast / etc.).
// Distinct from the per-list FilterCriteria used by FilterBar — this is the
// top-of-page filter strip that several views share simultaneously.

import { create } from 'zustand';

export interface DashboardFilters {
  year?: string;
  quarter?: string;
  month?: string;
  manager?: string;
  csm?: string;
  forecastCategory?: string;
  region?: string;
  stage?: string;
  type?: string;
  search?: string;
}

interface FiltersState {
  filters: DashboardFilters;
  setFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  resetFilters: () => void;
}

const defaultFilters: DashboardFilters = {
  year: String(new Date().getFullYear()),
  quarter: 'all',
  month: 'all',
  manager: 'all',
  csm: 'all',
  forecastCategory: 'all',
  region: 'all',
  stage: 'all',
  type: 'all',
  search: '',
};

export const useDashboardFiltersStore = create<FiltersState>((set) => ({
  filters: defaultFilters,
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),
}));
