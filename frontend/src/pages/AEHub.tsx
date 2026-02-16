import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import PipelineForecastPanel from '../components/PipelineForecastPanel';
import AIAssistant from '../components/AIAssistant';
import ScoreboardBar from '../components/ScoreboardBar';
import UnifiedPrioritiesPanel from '../components/UnifiedPrioritiesPanel';
import AccountInsightsPanel from '../components/AccountInsightsPanel';
import OpportunityInsightsPanel from '../components/OpportunityInsightsPanel';
import { config } from '../config';

const API_URL = config.apiBaseUrl;

export default function AEHub() {
  const [timeframe, setTimeframe] = useState<'annual' | 'quarterly'>('annual');
  const signalsRef = useRef<HTMLDivElement>(null);
  const atRiskRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // --- Data queries ---

  // 1. Metrics
  const { data: metricsData } = useQuery<{ success: boolean; data: any }>({
    queryKey: ['ae-metrics', timeframe],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/metrics?timeframe=${timeframe}`, { withCredentials: true });
      return response.data;
    },
  });

  // 2. Priorities (enhanced — includes at-risk items inline)
  const { data: prioritiesData, isLoading: loadingPriorities } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['ae-priorities'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/priorities`, { withCredentials: true });
      return response.data;
    },
  });

  // 3. Signals (expansion + new-business)
  const { data: signalsData, isLoading: loadingSignals } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['ae-signals'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/signals`, { withCredentials: true });
      return response.data;
    },
  });

  // 4. Manager Alerts (still queried — used for cold accounts in AccountInsightsPanel)
  const { data: alertsData, isLoading: loadingAlerts } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['ae-manager-alerts'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/manager-alerts`, { withCredentials: true });
      return response.data;
    },
  });

  // 5. At-risk deals count (for scoreboard)
  const { data: atRiskData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['ae-at-risk-deals'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/at-risk-deals`, { withCredentials: true });
      return response.data;
    },
  });

  // 7. Enhanced at-risk deals (MEDDPICC risk reasons)
  const { data: enhancedAtRiskData, isLoading: loadingEnhancedAtRisk } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['ae-at-risk-enhanced'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/at-risk-enhanced`, { withCredentials: true });
      return response.data;
    },
  });

  // 8. Stalled deals
  const { data: stalledData, isLoading: loadingStalled } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['ae-stalled-deals'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/stalled-deals`, { withCredentials: true });
      return response.data;
    },
  });

  // 9. Watchlist deals
  const { data: watchlistData, isLoading: loadingWatchlist } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['ae-watchlist'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/watchlist`, { withCredentials: true });
      return response.data;
    },
  });

  // Watchlist mutation with optimistic updates
  const [localWatchlistIds, setLocalWatchlistIds] = useState<Set<string>>(new Set());

  // Keep local watchlist in sync with server data
  const watchlistDeals = watchlistData?.data || [];
  const serverWatchlistIds = new Set(watchlistDeals.map((d: any) => d.dealId));
  const watchlistIds = new Set([...serverWatchlistIds, ...localWatchlistIds]);

  const addMutation = useMutation({
    mutationFn: (dealId: string) => axios.post(`${API_URL}/api/hub/ae/watchlist/${dealId}`, {}, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ae-watchlist'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (dealId: string) => axios.delete(`${API_URL}/api/hub/ae/watchlist/${dealId}`, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ae-watchlist'] }),
  });

  const toggleWatchlist = useCallback((dealId: string) => {
    if (watchlistIds.has(dealId)) {
      // Optimistic removal
      setLocalWatchlistIds(prev => {
        const next = new Set(prev);
        next.delete(dealId);
        return next;
      });
      removeMutation.mutate(dealId);
    } else {
      // Optimistic add
      setLocalWatchlistIds(prev => new Set(prev).add(dealId));
      addMutation.mutate(dealId);
    }
  }, [watchlistIds, addMutation, removeMutation]);

  // --- Derived data ---
  const metrics = metricsData?.data;
  const priorities = prioritiesData?.data || [];
  const signals = signalsData?.data || [];
  const alerts = alertsData?.data || [];
  const atRiskCount = atRiskData?.data?.length || 0;
  const enhancedAtRisk = enhancedAtRiskData?.data || [];
  const stalledDeals = stalledData?.data || [];

  const scrollToSignals = () => signalsRef.current?.scrollIntoView({ behavior: 'smooth' });
  const scrollToAtRisk = () => atRiskRef.current?.scrollIntoView({ behavior: 'smooth' });

  const isInsightsLoading = loadingSignals || loadingAlerts || loadingEnhancedAtRisk || loadingStalled || loadingWatchlist;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* HEADER */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Account Executive Hub</h1>
            <p className="text-slate-600 mt-1">New business acquisition and pipeline building</p>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm p-1 border border-slate-200">
            <button
              onClick={() => setTimeframe('annual')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeframe === 'annual' ? 'bg-blue-500 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual
            </button>
            <button
              onClick={() => setTimeframe('quarterly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeframe === 'quarterly' ? 'bg-blue-500 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quarterly
            </button>
          </div>
        </div>

        {/* AI Assistant */}
        <div className="mb-6">
          <AIAssistant userRole="Account Executive" />
        </div>

        {/* SECTION 1: Scoreboard Bar */}
        <ScoreboardBar
          quotaAttainment={metrics?.quotaAttainmentYTD || 0}
          pipelineCoverage={metrics?.pipelineCoverage || 0}
          atRiskCount={atRiskCount}
          signalsCount={signals.length}
          onAtRiskClick={scrollToAtRisk}
          onSignalsClick={scrollToSignals}
        />

        {/* SECTION 2 + 3: Priorities & Risks (left ~55%) | Pipeline Forecast (right ~45%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6" ref={atRiskRef}>
          <div className="lg:col-span-7">
            <UnifiedPrioritiesPanel priorities={priorities} isLoading={loadingPriorities} />
          </div>
          <div className="lg:col-span-5">
            <PipelineForecastPanel dateRange="thisQuarter" teamFilter="me" />
          </div>
        </div>

        {/* SECTION 4 + 5: Account Insights (left 50%) | Opportunity Insights (right 50%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6" ref={signalsRef}>
          <div className="lg:col-span-6">
            <AccountInsightsPanel
              signals={signals}
              alerts={alerts}
              isLoading={isInsightsLoading}
            />
          </div>
          <div className="lg:col-span-6">
            <OpportunityInsightsPanel
              atRiskDeals={enhancedAtRisk}
              stalledDeals={stalledDeals}
              watchlistDeals={watchlistDeals}
              watchlistIds={watchlistIds}
              onToggleWatchlist={toggleWatchlist}
              isLoading={isInsightsLoading}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
