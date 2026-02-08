import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

interface PipelineForecast {
  periodName: string;
  totalPipeline: number;
  commitAmount: number;
  bestCaseAmount: number;
  pipelineAmount: number;
  closedWon: number;
  weightedCommit: number;
  weightedBestCase: number;
  weightedPipeline: number;
  weightedTotal: number;
  stageWeightedPipeline: number;
  commitProbability: number;
  bestCaseProbability: number;
  pipelineProbability: number;
  coverageRatio: number;
  opportunitiesByStage: {
    stageName: string;
    count: number;
    value: number;
  }[];
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

  // Panel-local overrides (null = use parent value)
  const [localDateRange, setLocalDateRange] = useState<string | null>(null);
  const [localTeamFilter, setLocalTeamFilter] = useState<string | null>(null);
  const [localCustomStartDate, setLocalCustomStartDate] = useState('');
  const [localCustomEndDate, setLocalCustomEndDate] = useState('');

  // Effective values: local override takes precedence
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getCoverageColor = (ratio: number) => {
    if (ratio >= 3) return 'text-green-600';
    if (ratio >= 2) return 'text-yellow-600';
    return 'text-red-600';
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

  // Common opportunity types
  const availableTypes = ['New Business', 'Renewal', 'Customer Expansion', 'Upsell', 'Expansion', 'Add-On'];

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

  const maxStageValue = Math.max(...(forecast.opportunitiesByStage || []).map(s => s.value), 1);
  const hasData = forecast.totalPipeline > 0 || forecast.closedWon > 0;
  const hasWeightedData = forecast.weightedTotal > 0 || forecast.stageWeightedPipeline > 0;
  const activeFilterCount = excludedStages.length + selectedTypes.length
    + (localDateRange !== null ? 1 : 0)
    + (localTeamFilter !== null ? 1 : 0);

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
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
              activeFilterCount > 0
                ? 'bg-purple-50 border-purple-300 text-purple-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-purple-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
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

      {/* Panel-local Filters */}
      {showFilters && (
        <div className="mb-4 bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-3">
          {/* Date Range */}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1.5">Date Range:</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: null, label: 'Default' },
                { value: 'thisMonth', label: 'This Month' },
                { value: 'thisQuarter', label: 'This Quarter' },
                { value: 'thisYear', label: 'This Year' },
                { value: 'lastQuarter', label: 'Last Quarter' },
                { value: 'lastYear', label: 'Last Year' },
                { value: 'custom', label: 'Custom' },
              ].map(option => (
                <button
                  key={option.value ?? 'default'}
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
              <div className="flex gap-2 mt-2">
                <input
                  type="date"
                  value={localCustomStartDate}
                  onChange={(e) => setLocalCustomStartDate(e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded"
                />
                <span className="text-xs text-gray-500 self-center">to</span>
                <input
                  type="date"
                  value={localCustomEndDate}
                  onChange={(e) => setLocalCustomEndDate(e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded"
                />
              </div>
            )}
          </div>

          {/* Team Filter */}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1.5">Team:</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: null, label: 'Default' },
                { value: 'me', label: 'Just Me' },
                { value: 'myTeam', label: 'My Team' },
                { value: 'allUsers', label: 'All Users' },
              ].map(option => (
                <button
                  key={option.value ?? 'default'}
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

          {/* Stages */}
          {forecast.opportunitiesByStage.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1.5">Exclude Stages:</div>
              <div className="flex flex-wrap gap-1.5">
                {forecast.opportunitiesByStage.map(stage => (
                  <button
                    key={stage.stageName}
                    onClick={() => toggleStageExclusion(stage.stageName)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      excludedStages.includes(stage.stageName)
                        ? 'bg-red-100 border-red-300 text-red-700 line-through'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {stage.stageName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opportunity Types */}
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

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setExcludedStages([]);
                setSelectedTypes([]);
                setLocalDateRange(null);
                setLocalTeamFilter(null);
                setLocalCustomStartDate('');
                setLocalCustomEndDate('');
              }}
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
              <div className="text-xs text-gray-600 mb-1">Commit ({forecast.commitProbability}%)</div>
              <div className="text-lg font-bold text-blue-900">
                {formatCurrency(forecast.commitAmount)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Best Case ({forecast.bestCaseProbability}%)</div>
              <div className="text-lg font-bold text-purple-900">
                {formatCurrency(forecast.bestCaseAmount)}
              </div>
            </div>
          </div>

          {/* Weighted Forecast */}
          {hasWeightedData && (
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-600 mb-2">Weighted Forecast</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50/50 rounded p-2">
                  <div className="text-[10px] text-gray-500">Wtd. Commit</div>
                  <div className="text-sm font-semibold text-blue-800">{formatCurrency(forecast.weightedCommit)}</div>
                </div>
                <div className="bg-purple-50/50 rounded p-2">
                  <div className="text-[10px] text-gray-500">Wtd. Best Case</div>
                  <div className="text-sm font-semibold text-purple-800">{formatCurrency(forecast.weightedBestCase)}</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-[10px] text-gray-500">Wtd. Pipeline</div>
                  <div className="text-sm font-semibold text-gray-800">{formatCurrency(forecast.weightedPipeline)}</div>
                </div>
                <div className="bg-emerald-50 rounded p-2">
                  <div className="text-[10px] text-gray-500">Weighted Total</div>
                  <div className="text-sm font-semibold text-emerald-800">{formatCurrency(forecast.weightedTotal)}</div>
                </div>
              </div>
              {forecast.stageWeightedPipeline > 0 && (
                <div className="mt-2 bg-amber-50 rounded p-2">
                  <div className="text-[10px] text-gray-500">Stage Weighted Pipeline</div>
                  <div className="text-sm font-semibold text-amber-800">{formatCurrency(forecast.stageWeightedPipeline)}</div>
                </div>
              )}
            </div>
          )}

          {/* Coverage Ratio */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Coverage Ratio</span>
              <span className={`text-sm font-bold ${getCoverageColor(forecast.coverageRatio)}`}>
                {forecast.coverageRatio.toFixed(1)}x
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  forecast.coverageRatio >= 3
                    ? 'bg-green-500'
                    : forecast.coverageRatio >= 2
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.min(100, (forecast.coverageRatio / 4) * 100)}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Pipeline by Stage */}
          {forecast.opportunitiesByStage.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-2">Open Pipeline by Stage</div>
              <div className="space-y-2">
                {forecast.opportunitiesByStage.map((stage) => (
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
