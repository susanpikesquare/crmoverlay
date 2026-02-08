import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

interface PipelineForecast {
  periodName: string;
  totalPipeline: number;
  commitAmount: number;
  bestCaseAmount: number;
  pipelineAmount: number;
  closedWon: number;
  forecastMethod: 'forecastCategory' | 'probability';
  commitLabel: string;
  bestCaseLabel: string;
  quotaTarget: number;
  quotaAttainment: number;
  quotaSource: 'salesforce' | 'manual' | 'none';
  opportunitiesByStage: {
    stageName: string;
    count: number;
    value: number;
  }[];
  distinctOpportunityTypes: string[];
  forecastStatus: {
    isSubmitted: boolean;
    lastSubmittedDate?: string;
    submissionUrl: string;
  };
}

interface PipelineForecastPanelProps {
  dateRange: string;
  teamFilter: string;
  customStartDate?: string;
  customEndDate?: string;
  minDealSize?: number;
}

const DATE_RANGE_OPTIONS = [
  { value: 'thisMonth', label: 'This Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'lastQuarter', label: 'Last Quarter' },
  { value: 'lastYear', label: 'Last Year' },
  { value: 'custom', label: 'Custom' },
] as const;

const TEAM_OPTIONS = [
  { value: 'me', label: 'Just Me' },
  { value: 'myTeam', label: 'My Team' },
  { value: 'allUsers', label: 'All Users' },
] as const;

type StageSortField = 'order' | 'value' | 'count';
type SortDirection = 'asc' | 'desc';

export default function PipelineForecastPanel({
  dateRange: parentDateRange,
  teamFilter: parentTeamFilter,
  customStartDate: parentCustomStartDate,
  customEndDate: parentCustomEndDate,
  minDealSize,
}: PipelineForecastPanelProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [excludedStages, setExcludedStages] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [stageSortField, setStageSortField] = useState<StageSortField>('order');
  const [stageSortDir, setStageSortDir] = useState<SortDirection>('asc');

  // Panel-local overrides (null = use parent/default value)
  const [localDateRange, setLocalDateRange] = useState<string | null>(null);
  const [localTeamFilter, setLocalTeamFilter] = useState<string | null>(null);
  const [localCustomStartDate, setLocalCustomStartDate] = useState('');
  const [localCustomEndDate, setLocalCustomEndDate] = useState('');

  // Track all stages and types we've seen
  const knownStagesRef = useRef<Set<string>>(new Set());
  const knownTypesRef = useRef<Set<string>>(new Set());

  // Effective values: local override wins
  const dateRange = localDateRange ?? parentDateRange;
  const teamFilter = localTeamFilter ?? parentTeamFilter;
  const customStartDate = localDateRange === 'custom' ? localCustomStartDate : parentCustomStartDate;
  const customEndDate = localDateRange === 'custom' ? localCustomEndDate : parentCustomEndDate;

  // Determine which API endpoint to use based on teamFilter
  const isAEView = teamFilter === 'me';
  const endpoint = isAEView
    ? '/api/hub/ae/pipeline-forecast'
    : '/api/hub/sales-leader/pipeline-forecast';

  const { data: forecastResponse, isLoading } = useQuery<{ success: boolean; data: PipelineForecast }>({
    queryKey: ['pipeline-forecast', dateRange, customStartDate, customEndDate, teamFilter, minDealSize, excludedStages, selectedTypes],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange === 'custom') {
        params.append('dateRange', 'custom');
        if (customStartDate) params.append('startDate', customStartDate);
        if (customEndDate) params.append('endDate', customEndDate);
      } else {
        params.append('dateRange', dateRange);
      }
      params.append('teamFilter', teamFilter);
      if (minDealSize && minDealSize > 0) {
        params.append('minDealSize', minDealSize.toString());
      }
      if (excludedStages.length > 0) {
        params.append('excludeStages', excludedStages.join(','));
      }
      if (selectedTypes.length > 0) {
        params.append('opportunityTypes', selectedTypes.join(','));
      }
      const response = await api.get(`${endpoint}?${params.toString()}`);
      return response.data;
    },
  });

  const forecast = forecastResponse?.data;

  // Accumulate known stages and types from every response
  useEffect(() => {
    if (forecast?.opportunitiesByStage) {
      forecast.opportunitiesByStage.forEach(s => knownStagesRef.current.add(s.stageName));
    }
    if (forecast?.distinctOpportunityTypes) {
      forecast.distinctOpportunityTypes.forEach(t => knownTypesRef.current.add(t));
    }
  }, [forecast]);

  const formatCurrency = (value: number) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safeValue);
  };

  const toggleStageExclusion = (stageName: string) => {
    setExcludedStages(prev =>
      prev.includes(stageName)
        ? prev.filter(s => s !== stageName)
        : [...prev, stageName]
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const clearAllFilters = () => {
    setExcludedStages([]);
    setSelectedTypes([]);
    setLocalDateRange(null);
    setLocalTeamFilter(null);
    setLocalCustomStartDate('');
    setLocalCustomEndDate('');
  };

  const handleStageSort = (field: StageSortField) => {
    if (stageSortField === field) {
      setStageSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setStageSortField(field);
      setStageSortDir(field === 'value' ? 'desc' : 'asc');
    }
  };

  const getSortIndicator = (field: StageSortField) => {
    if (stageSortField !== field) return '';
    return stageSortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  if (isLoading || !forecast) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Pipeline & Forecast</h2>
        <div className="animate-pulse space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-gray-100 h-16 rounded-lg" />
            ))}
          </div>
          <div className="bg-gray-100 h-4 rounded" />
          <div className="bg-gray-100 h-32 rounded" />
        </div>
      </div>
    );
  }

  const hasData = (forecast.totalPipeline || 0) > 0 || (forecast.closedWon || 0) > 0
    || (forecast.commitAmount || 0) > 0 || (forecast.bestCaseAmount || 0) > 0;
  const activeFilterCount = excludedStages.length + selectedTypes.length
    + (localDateRange !== null ? 1 : 0)
    + (localTeamFilter !== null ? 1 : 0);

  // Build complete stage list for filter toggles
  const responseStageNames = new Set(forecast.opportunitiesByStage.map(s => s.stageName));
  const allStageNames = Array.from(
    new Set([...responseStageNames, ...excludedStages, ...knownStagesRef.current])
  ).sort();

  // Build opportunity types list from Salesforce data
  const availableTypes = Array.from(
    new Set([...(forecast.distinctOpportunityTypes || []), ...knownTypesRef.current])
  ).sort();

  // Sort stages for display
  const sortedStages = [...(forecast.opportunitiesByStage || [])].sort((a, b) => {
    if (stageSortField === 'value') {
      return stageSortDir === 'asc' ? a.value - b.value : b.value - a.value;
    }
    if (stageSortField === 'count') {
      return stageSortDir === 'asc' ? a.count - b.count : b.count - a.count;
    }
    // 'order' — use the natural order from the API response (stage progression)
    const aIdx = forecast.opportunitiesByStage.indexOf(a);
    const bIdx = forecast.opportunitiesByStage.indexOf(b);
    return stageSortDir === 'asc' ? aIdx - bIdx : bIdx - aIdx;
  });

  const maxStageValue = Math.max(...sortedStages.map(s => s.value), 1);

  // Build active filter summary chips
  const filterChips: string[] = [];
  if (localDateRange !== null) {
    const label = DATE_RANGE_OPTIONS.find(o => o.value === localDateRange)?.label ?? localDateRange;
    filterChips.push(label);
  }
  if (localTeamFilter !== null) {
    const label = TEAM_OPTIONS.find(o => o.value === localTeamFilter)?.label ?? localTeamFilter;
    filterChips.push(label);
  }
  if (excludedStages.length > 0) {
    filterChips.push(`${excludedStages.length} stage${excludedStages.length > 1 ? 's' : ''} excluded`);
  }
  if (selectedTypes.length > 0) {
    filterChips.push(selectedTypes.join(', '));
  }

  const quotaTarget = forecast.quotaTarget || 0;
  const quotaAttainment = forecast.quotaAttainment || 0;

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pipeline & Forecast</h2>
          {forecast.periodName && (
            <p className="text-sm text-gray-500 mt-0.5">{forecast.periodName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`text-sm px-3 py-2 rounded-lg border-2 transition-all flex items-center gap-1.5 font-medium shadow-sm ${
              showFilters
                ? 'bg-purple-100 border-purple-400 text-purple-800 shadow-purple-100'
                : activeFilterCount > 0
                ? 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          {forecast.forecastStatus.submissionUrl && (
            <a
              href={forecast.forecastStatus.submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              View in SF
            </a>
          )}
        </div>
      </div>

      {/* Active filter summary (visible when panel is collapsed) */}
      {!showFilters && activeFilterCount > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5 items-center">
          {filterChips.map((chip, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {chip}
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-[10px] text-gray-400 hover:text-gray-600 ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Panel-local Filters */}
      {showFilters && (
        <div className="mb-4 bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-3">
          {/* Date Range */}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1.5">Date Range:</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setLocalDateRange(null)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  localDateRange === null
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Default
              </button>
              {DATE_RANGE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setLocalDateRange(option.value)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    localDateRange === option.value
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {localDateRange === 'custom' && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="date"
                  value={localCustomStartDate}
                  onChange={(e) => setLocalCustomStartDate(e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="date"
                  value={localCustomEndDate}
                  onChange={(e) => setLocalCustomEndDate(e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Team Filter */}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1.5">Team:</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setLocalTeamFilter(null)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  localTeamFilter === null
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Default
              </button>
              {TEAM_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setLocalTeamFilter(option.value)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    localTeamFilter === option.value
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exclude Stages */}
          {allStageNames.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1.5">Exclude Stages:</div>
              <div className="flex flex-wrap gap-1.5">
                {allStageNames.map(stageName => (
                  <button
                    key={stageName}
                    onClick={() => toggleStageExclusion(stageName)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      excludedStages.includes(stageName)
                        ? 'bg-red-100 border-red-300 text-red-700 line-through'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {stageName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opportunity Types — from Salesforce */}
          {availableTypes.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1.5">Opportunity Type:</div>
              <div className="flex flex-wrap gap-1.5">
                {availableTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      selectedTypes.includes(type)
                        ? 'bg-purple-100 border-purple-300 text-purple-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {hasData ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Open Pipeline</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(forecast.totalPipeline)}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Closed Won</div>
              <div className="text-lg font-bold text-green-700">
                {formatCurrency(forecast.closedWon)}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">
                {forecast.commitLabel || 'Commit'}
              </div>
              <div className="text-lg font-bold text-blue-900">
                {formatCurrency(forecast.commitAmount)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">
                {forecast.bestCaseLabel || 'Best Case'}
              </div>
              <div className="text-lg font-bold text-purple-900">
                {formatCurrency(forecast.bestCaseAmount)}
              </div>
            </div>
          </div>

          {/* Quota Attainment — only shown when quota is configured */}
          {quotaTarget > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">
                  Quota Attainment
                  <span className="text-gray-400 ml-1">
                    ({formatCurrency(forecast.closedWon)} / {formatCurrency(quotaTarget)})
                  </span>
                </span>
                <span className={`text-sm font-bold ${
                  quotaAttainment >= 100 ? 'text-green-600' : quotaAttainment >= 75 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {quotaAttainment.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    quotaAttainment >= 100
                      ? 'bg-green-500'
                      : quotaAttainment >= 75
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.min(100, quotaAttainment)}%`,
                  }}
                ></div>
              </div>
            </div>
          )}

          {/* Pipeline by Stage */}
          {sortedStages.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-xs font-medium text-gray-600">Open Pipeline by Stage</div>
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-[10px] text-gray-400">Sort:</span>
                  <button
                    onClick={() => handleStageSort('order')}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      stageSortField === 'order'
                        ? 'bg-blue-100 border-blue-300 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Stage{getSortIndicator('order')}
                  </button>
                  <button
                    onClick={() => handleStageSort('value')}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      stageSortField === 'value'
                        ? 'bg-blue-100 border-blue-300 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Value{getSortIndicator('value')}
                  </button>
                  <button
                    onClick={() => handleStageSort('count')}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      stageSortField === 'count'
                        ? 'bg-blue-100 border-blue-300 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Count{getSortIndicator('count')}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {sortedStages.map((stage) => (
                  <div key={stage.stageName} className="flex items-center gap-2">
                    <div className="w-24 text-xs text-gray-700 truncate" title={stage.stageName}>
                      {stage.stageName}
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-100 rounded-full h-4 relative">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-blue-500 h-4 rounded-full flex items-center justify-end pr-2"
                          style={{
                            width: `${(stage.value / maxStageValue) * 100}%`,
                            minWidth: stage.value > 0 ? '40px' : '0',
                          }}
                        >
                          <span className="text-xs font-medium text-white">
                            {stage.count}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-20 text-xs text-gray-600 text-right">
                      {formatCurrency(stage.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600">No pipeline data available</p>
          <p className="text-sm text-gray-500 mt-1">Adjust filters or create opportunities to build your pipeline</p>
        </div>
      )}
    </div>
  );
}
