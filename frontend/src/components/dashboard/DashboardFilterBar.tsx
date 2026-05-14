// Dashboard-style filter strip: year / quarter / manager / CSM / forecast / region / search.
// Distinct from the existing FilterBar (which is the report-style add-filter widget).

import clsx from 'clsx';
import type { DashboardFilters } from '../../state/filtersStore';
import { useDashboardFiltersStore } from '../../state/filtersStore';

interface DashboardFilterBarProps {
  options?: {
    years?: string[];
    managers?: string[];
    csms?: string[];
    categories?: string[];
    stages?: string[];
    regions?: string[];
  };
  show?: Array<keyof DashboardFilters>;
  count?: number;
  countLabel?: string;
}

const QUARTERS = [
  { value: 'all', label: 'All Quarters' },
  { value: '1', label: 'Q1' },
  { value: '2', label: 'Q2' },
  { value: '3', label: 'Q3' },
  { value: '4', label: 'Q4' },
];

export default function DashboardFilterBar({
  options = {},
  show,
  count,
  countLabel = 'records',
}: DashboardFilterBarProps) {
  const filters = useDashboardFiltersStore((s) => s.filters);
  const setFilter = useDashboardFiltersStore((s) => s.setFilter);
  const visible = (key: keyof DashboardFilters) => !show || show.includes(key);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-5 py-2">
      {visible('year') && (
        <Select
          label="Year"
          value={filters.year ?? 'all'}
          onChange={(v) => setFilter('year', v)}
          options={[{ value: 'all', label: 'All Years' }, ...(options.years ?? []).map((y) => ({ value: y, label: y }))]}
        />
      )}
      {visible('quarter') && (
        <Select
          label="Quarter"
          value={filters.quarter ?? 'all'}
          onChange={(v) => setFilter('quarter', v)}
          options={QUARTERS}
        />
      )}
      {visible('manager') && (
        <Select
          label="Manager"
          value={filters.manager ?? 'all'}
          onChange={(v) => setFilter('manager', v)}
          options={[{ value: 'all', label: 'All Managers' }, ...(options.managers ?? []).map((m) => ({ value: m, label: m }))]}
        />
      )}
      {visible('csm') && (
        <Select
          label="CSM/Owner"
          value={filters.csm ?? 'all'}
          onChange={(v) => setFilter('csm', v)}
          options={[{ value: 'all', label: 'All CSMs' }, ...(options.csms ?? []).map((m) => ({ value: m, label: m }))]}
        />
      )}
      {visible('forecastCategory') && (
        <Select
          label="Forecast"
          value={filters.forecastCategory ?? 'all'}
          onChange={(v) => setFilter('forecastCategory', v)}
          options={[{ value: 'all', label: 'All Categories' }, ...(options.categories ?? []).map((m) => ({ value: m, label: m }))]}
        />
      )}
      {visible('stage') && (
        <Select
          label="Stage"
          value={filters.stage ?? 'all'}
          onChange={(v) => setFilter('stage', v)}
          options={[{ value: 'all', label: 'All Stages' }, ...(options.stages ?? []).map((m) => ({ value: m, label: m }))]}
        />
      )}
      {visible('region') && (
        <Select
          label="Region"
          value={filters.region ?? 'all'}
          onChange={(v) => setFilter('region', v)}
          options={[{ value: 'all', label: 'All Regions' }, ...(options.regions ?? []).map((m) => ({ value: m, label: m }))]}
        />
      )}
      {visible('search') && (
        <input
          type="text"
          placeholder="Search accounts…"
          value={filters.search ?? ''}
          onChange={(e) => setFilter('search', e.target.value)}
          className="h-7 rounded border border-gray-200 px-2 text-[13px] outline-none focus:border-primary-500"
        />
      )}
      {count !== undefined && (
        <div className="ml-auto whitespace-nowrap text-[13px] text-gray-500">
          {count.toLocaleString('en-US')} {countLabel}
        </div>
      )}
    </div>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="whitespace-nowrap text-xs font-semibold text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'h-7 cursor-pointer rounded border border-gray-200 bg-white px-2 text-[13px]',
          'outline-none focus:border-primary-500',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
