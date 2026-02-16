import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import PipelineForecastPanel from '../components/PipelineForecastPanel';
import AIAssistant from '../components/AIAssistant';
import ScoreboardBar from '../components/ScoreboardBar';
import UnifiedPrioritiesPanel from '../components/UnifiedPrioritiesPanel';
import WhatIfModeler from '../components/WhatIfModeler';
import OpportunitySignalsPanel from '../components/OpportunitySignalsPanel';
import ManagerAlertPanel from '../components/ManagerAlertPanel';
import { config } from '../config';

const API_URL = config.apiBaseUrl;

export default function AEHub() {
  const [timeframe, setTimeframe] = useState<'annual' | 'quarterly'>('annual');
  const signalsRef = useRef<HTMLDivElement>(null);
  const atRiskRef = useRef<HTMLDivElement>(null);

  // --- Data queries (6 parallel) ---

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

  // 4. Manager Alerts
  const { data: alertsData, isLoading: loadingAlerts } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['ae-manager-alerts'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/manager-alerts`, { withCredentials: true });
      return response.data;
    },
  });

  // 5. What-If Deals
  const { data: whatIfData, isLoading: loadingWhatIf } = useQuery<{ success: boolean; data: any }>({
    queryKey: ['ae-whatif-deals'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/whatif-deals`, { withCredentials: true });
      return response.data;
    },
  });

  // 6. At-risk deals count (for scoreboard — lightweight from priorities data)
  const { data: atRiskData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['ae-at-risk-deals'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/at-risk-deals`, { withCredentials: true });
      return response.data;
    },
  });

  // --- Derived data ---
  const metrics = metricsData?.data;
  const priorities = prioritiesData?.data || [];
  const signals = signalsData?.data || [];
  const alerts = alertsData?.data || [];
  const whatIf = whatIfData?.data || { deals: [], quotaTarget: 0, closedWon: 0 };
  const atRiskCount = atRiskData?.data?.length || 0;

  const scrollToSignals = () => signalsRef.current?.scrollIntoView({ behavior: 'smooth' });
  const scrollToAtRisk = () => atRiskRef.current?.scrollIntoView({ behavior: 'smooth' });

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

        {/* SECTION 2 + 3: Priorities & Risks (left ~55%) | Quota & What-If (right ~45%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6" ref={atRiskRef}>
          <div className="lg:col-span-7">
            <UnifiedPrioritiesPanel priorities={priorities} isLoading={loadingPriorities} />
          </div>
          <div className="lg:col-span-5">
            <WhatIfModeler
              deals={whatIf.deals || []}
              quotaTarget={whatIf.quotaTarget || 0}
              closedWon={whatIf.closedWon || 0}
              isLoading={loadingWhatIf}
            />
          </div>
        </div>

        {/* SECTION 4 + 5: Opportunity Signals (left ~55%) | Manager Alerts (right ~45%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6" ref={signalsRef}>
          <div className="lg:col-span-7">
            <OpportunitySignalsPanel signals={signals} isLoading={loadingSignals} />
          </div>
          <div className="lg:col-span-5">
            <ManagerAlertPanel alerts={alerts} isLoading={loadingAlerts} />
          </div>
        </div>

        {/* Pipeline Forecast (retained — full width) */}
        <div className="mb-6">
          <PipelineForecastPanel dateRange="thisQuarter" teamFilter="me" />
        </div>
      </div>
    </div>
  );
}
