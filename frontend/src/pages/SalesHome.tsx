import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';
import KpiTile from '../components/dashboard/KpiTile';
import HomeHeader from '../components/home/HomeHeader';
import PriorityPanel, { type PriorityItem } from '../components/home/PriorityPanel';
import { formatMoney, formatPct } from '../lib/format';

interface UserMe {
  id: string;
  name: string;
  email: string;
  profile: string;
  role: 'executive' | 'sales-leader' | 'ae' | 'am' | 'csm' | 'unknown';
}

interface AEMetrics {
  quotaAttainmentYTD: number;
  pipelineCoverage: number;
  hotProspectsCount: number;
  avgDealSize: number;
}

interface AMMetrics {
  renewalsAtRiskCount: number;
  expansionPipeline: number;
  avgContractValue: number;
}

interface PriorityAccount {
  Id: string;
  Name: string;
  priorityTier?: string;
  intentScore?: number;
  buyingStage?: string;
  topSignal?: string;
  aiRecommendation?: string;
}

interface AtRiskDeal {
  Id: string;
  Name: string;
  Account?: { Name?: string };
  Amount?: number;
  StageName?: string;
  CloseDate?: string;
  daysInStage?: number;
  riskReason?: string;
  aiRecommendation?: string;
}

interface RenewalAccount {
  Id: string;
  Name: string;
  daysToRenewal: number;
  contractValue: number;
  healthScore: number;
  renewalRisk: 'At Risk' | 'On Track' | 'Expansion Opportunity';
  keySignals: string[];
  aiRecommendation: string;
}

export default function SalesHome() {
  const { data: user } = useQuery<UserMe>({
    queryKey: ['userMe'],
    queryFn: async () => (await apiClient.get('/api/user/me')).data.data,
  });

  const isAE = user?.role === 'ae';
  const isAM = user?.role === 'am';

  // AE data (pulled when user is AE; backend returns scoped by user anyway)
  const aeMetrics = useQuery<{ success: boolean; data: AEMetrics }>({
    queryKey: ['ae-metrics-home'],
    queryFn: async () => (await apiClient.get('/api/hub/ae/metrics?timeframe=annual')).data,
    enabled: isAE,
  });
  const aePriorities = useQuery<{ success: boolean; data: PriorityAccount[] }>({
    queryKey: ['ae-priorities-home'],
    queryFn: async () => (await apiClient.get('/api/hub/ae/priority-accounts')).data,
    enabled: isAE,
  });
  const aeAtRisk = useQuery<{ success: boolean; data: AtRiskDeal[] }>({
    queryKey: ['ae-at-risk-home'],
    queryFn: async () => (await apiClient.get('/api/hub/ae/at-risk-deals')).data,
    enabled: isAE,
  });

  // AM data
  const amMetrics = useQuery<{ success: boolean; data: AMMetrics }>({
    queryKey: ['am-metrics-home'],
    queryFn: async () => (await apiClient.get('/api/hub/am/metrics')).data,
    enabled: isAM,
  });
  const amRenewals = useQuery<{ success: boolean; data: RenewalAccount[] }>({
    queryKey: ['am-renewals-home'],
    queryFn: async () => (await apiClient.get('/api/hub/am/renewals?scope=my')).data,
    enabled: isAM,
  });

  // Build the unified "Today's Priorities" list
  const priorities: PriorityItem[] = useMemo(() => {
    const out: PriorityItem[] = [];

    // At-risk deals (AE) — critical
    (aeAtRisk.data?.data ?? []).forEach((d) => {
      out.push({
        key: `risk-${d.Id}`,
        to: `/opportunity/${d.Id}`,
        severity: 'critical',
        title: d.Name,
        subtitle: `${d.Account?.Name ?? ''} • ${d.StageName ?? 'Unknown stage'}${d.daysInStage != null ? ` • ${d.daysInStage}d in stage` : ''}`,
        metric: d.Amount != null ? formatMoney(d.Amount, { compact: true }) : undefined,
        recommendation: d.aiRecommendation ?? d.riskReason,
      });
    });

    // At-risk renewals (AM) — critical
    (amRenewals.data?.data ?? [])
      .filter((r) => r.renewalRisk === 'At Risk')
      .forEach((r) => {
        out.push({
          key: `renewal-risk-${r.Id}`,
          to: `/account/${r.Id}`,
          severity: 'critical',
          title: r.Name,
          subtitle: `Renewal in ${r.daysToRenewal} days • Health ${r.healthScore}`,
          metric: formatMoney(r.contractValue ?? 0, { compact: true }),
          recommendation: r.aiRecommendation,
        });
      });

    // Hot prospects (AE) — opportunity
    (aePriorities.data?.data ?? [])
      .filter((p) => (p.intentScore ?? 0) >= 70)
      .slice(0, 5)
      .forEach((p) => {
        out.push({
          key: `prospect-${p.Id}`,
          to: `/account/${p.Id}`,
          severity: 'opportunity',
          title: p.Name,
          subtitle: `Intent ${p.intentScore} • ${p.buyingStage ?? 'Unknown stage'}${p.topSignal ? ` • ${p.topSignal}` : ''}`,
          metric: p.priorityTier,
          recommendation: p.aiRecommendation,
        });
      });

    // Expansion-ready renewals (AM) — opportunity
    (amRenewals.data?.data ?? [])
      .filter((r) => r.renewalRisk === 'Expansion Opportunity')
      .forEach((r) => {
        out.push({
          key: `renewal-expand-${r.Id}`,
          to: `/account/${r.Id}`,
          severity: 'opportunity',
          title: r.Name,
          subtitle: `Renewal in ${r.daysToRenewal} days • Health ${r.healthScore}`,
          metric: formatMoney(r.contractValue ?? 0, { compact: true }),
          recommendation: r.aiRecommendation,
        });
      });

    // Sort: critical first, then opportunity, by metric size where possible
    return out;
  }, [aeAtRisk.data, aePriorities.data, amRenewals.data]);

  const isLoading =
    (isAE && (aeMetrics.isLoading || aePriorities.isLoading || aeAtRisk.isLoading)) ||
    (isAM && (amMetrics.isLoading || amRenewals.isLoading));

  // KPI tiles — pulled from whichever role's metrics are available
  const aem = aeMetrics.data?.data;
  const amm = amMetrics.data?.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <HomeHeader
          greeting={user?.name?.split(' ')[0] ?? 'there'}
          subtitle={
            isAE
              ? 'Your pipeline, hot prospects, and deals that need attention today.'
              : isAM
              ? 'Renewals on the horizon, at-risk customers, and expansion opportunities.'
              : 'Your priorities for today.'
          }
        />

        {/* KPI strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          {isAE && aem && (
            <>
              <KpiTile
                label="Quota Attainment"
                value={formatPct(aem.quotaAttainmentYTD, 0)}
                sub="YTD"
                variant={aem.quotaAttainmentYTD >= 100 ? 'positive' : aem.quotaAttainmentYTD >= 70 ? 'brand' : 'warn'}
              />
              <KpiTile
                label="Pipeline Coverage"
                value={`${aem.pipelineCoverage.toFixed(1)}×`}
                sub="of remaining quota"
              />
              <KpiTile
                label="Hot Prospects"
                value={String(aem.hotProspectsCount)}
                variant="brand"
              />
              <KpiTile
                label="Avg Deal Size"
                value={formatMoney(aem.avgDealSize, { compact: true })}
              />
            </>
          )}
          {isAM && amm && (
            <>
              <KpiTile
                label="Renewals at Risk"
                value={String(amm.renewalsAtRiskCount)}
                variant={amm.renewalsAtRiskCount > 0 ? 'negative' : 'positive'}
              />
              <KpiTile
                label="Expansion Pipeline"
                value={formatMoney(amm.expansionPipeline, { compact: true })}
                variant="brand"
              />
              <KpiTile
                label="Avg Contract Value"
                value={formatMoney(amm.avgContractValue, { compact: true })}
              />
            </>
          )}
          <KpiTile
            label="Priorities Today"
            value={String(priorities.length)}
            sub="items needing attention"
          />
        </div>

        {/* Today's priorities */}
        <div className="mb-6">
          <PriorityPanel
            title="Today's Priorities"
            subtitle="At-risk deals, expansion opportunities, and hot prospects ranked for your day."
            items={priorities}
            isLoading={isLoading}
            emptyMessage="You're all caught up — nothing flagged for today."
            viewAllTo={isAE ? '/dashboard/ae' : isAM ? '/dashboard/am' : undefined}
            viewAllLabel={isAE ? 'View AE Hub' : 'View AM Hub'}
            maxVisible={8}
          />
        </div>

        {/* Drill-in cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <DrillCard
            title="Pipeline"
            description="Sortable view of every open deal with stage, MEDDPICC, and forecast category."
            to="/opportunities"
          />
          {(isAE || isAM) && (
            <DrillCard
              title="Renewals"
              description="Days-to-renewal, health, and recommended actions across your book."
              to="/renewal-dashboard"
            />
          )}
          <DrillCard
            title="Accounts"
            description="All accounts in your scope with intent, ARR, and risk."
            to="/accounts"
          />
        </div>
      </div>
    </div>
  );
}

function DrillCard({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <a
      href={to}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary-300 hover:shadow-md"
    >
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{description}</div>
      <div className="mt-3 text-xs font-medium text-primary-600">Open →</div>
    </a>
  );
}
