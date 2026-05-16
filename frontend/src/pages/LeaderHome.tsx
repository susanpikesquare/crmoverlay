import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';
import KpiTile from '../components/dashboard/KpiTile';
import HomeHeader from '../components/home/HomeHeader';
import PriorityPanel, { type PriorityItem } from '../components/home/PriorityPanel';
import { formatMoney } from '../lib/format';

interface UserMe {
  id: string;
  name: string;
  email: string;
  profile: string;
  role: string;
}

interface ExecutiveMetrics {
  totalPipeline?: number;
  closedWonYTD?: number;
  renewalsAtRiskCount?: number;
  avgHealthScore?: number;
  expansionPipeline?: number;
  upcomingRenewalsCount?: number;
}

interface PriorityItemAPI {
  id: string;
  accountId?: string;
  opportunityId?: string;
  type: string;
  severity?: 'critical' | 'warning' | 'opportunity' | 'info';
  title: string;
  subtitle?: string;
  metric?: string;
  recommendation?: string;
}

interface AtRiskDeal {
  Id: string;
  Name: string;
  Account?: { Name?: string };
  Amount?: number;
  ownerName?: string;
  riskFactors?: string[];
}

interface RenewalAccount {
  Id: string;
  Name: string;
  daysToRenewal: number;
  contractValue: number;
  healthScore: number;
  renewalRisk: 'At Risk' | 'On Track' | 'Expansion Opportunity';
}

export default function LeaderHome() {
  const { data: user } = useQuery<UserMe>({
    queryKey: ['userMe'],
    queryFn: async () => (await apiClient.get('/api/user/me')).data.data,
  });

  const metrics = useQuery<{ success: boolean; data: ExecutiveMetrics }>({
    queryKey: ['exec-metrics-home'],
    queryFn: async () => (await apiClient.get('/api/hub/executive/metrics')).data,
  });
  const priorities = useQuery<{ success: boolean; data: PriorityItemAPI[] }>({
    queryKey: ['exec-priorities-home'],
    queryFn: async () => (await apiClient.get('/api/hub/executive/priorities')).data,
  });
  const atRisk = useQuery<{ success: boolean; data: AtRiskDeal[] }>({
    queryKey: ['exec-at-risk-home'],
    queryFn: async () => (await apiClient.get('/api/hub/executive/at-risk-deals')).data,
  });
  const renewals = useQuery<{ success: boolean; data: RenewalAccount[] }>({
    queryKey: ['exec-renewals-home'],
    queryFn: async () => (await apiClient.get('/api/hub/executive/renewals')).data,
  });

  const items: PriorityItem[] = useMemo(() => {
    const out: PriorityItem[] = [];

    // Server-side priorities first (cross-cutting alerts)
    (priorities.data?.data ?? []).forEach((p) => {
      const to = p.opportunityId
        ? `/opportunity/${p.opportunityId}`
        : p.accountId
        ? `/account/${p.accountId}`
        : undefined;
      out.push({
        key: `priority-${p.id}`,
        to,
        severity: p.severity ?? 'info',
        title: p.title,
        subtitle: p.subtitle,
        metric: p.metric,
        recommendation: p.recommendation,
      });
    });

    // Top at-risk deals by amount
    (atRisk.data?.data ?? [])
      .slice()
      .sort((a, b) => (b.Amount ?? 0) - (a.Amount ?? 0))
      .slice(0, 5)
      .forEach((d) => {
        out.push({
          key: `deal-${d.Id}`,
          to: `/opportunity/${d.Id}`,
          severity: 'critical',
          title: d.Name,
          subtitle:
            `${d.Account?.Name ?? ''}` +
            (d.ownerName ? ` • ${d.ownerName}` : '') +
            (d.riskFactors?.[0] ? ` • ${d.riskFactors[0]}` : ''),
          metric: d.Amount != null ? formatMoney(d.Amount, { compact: true }) : undefined,
        });
      });

    // Imminent at-risk renewals
    (renewals.data?.data ?? [])
      .filter((r) => r.renewalRisk === 'At Risk' && r.daysToRenewal <= 90)
      .slice(0, 5)
      .forEach((r) => {
        out.push({
          key: `renewal-${r.Id}`,
          to: `/account/${r.Id}`,
          severity: 'critical',
          title: r.Name,
          subtitle: `Renewal in ${r.daysToRenewal}d • Health ${r.healthScore}`,
          metric: formatMoney(r.contractValue ?? 0, { compact: true }),
        });
      });

    return out;
  }, [priorities.data, atRisk.data, renewals.data]);

  const m = metrics.data?.data;
  const atRiskValue = useMemo(
    () => (atRisk.data?.data ?? []).reduce((s, d) => s + (d.Amount ?? 0), 0),
    [atRisk.data],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <HomeHeader
          greeting={user?.name?.split(' ')[0] ?? 'there'}
          subtitle="Team pipeline, at-risk deals, and renewals across your org."
        />

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiTile
            label="Total Pipeline"
            value={formatMoney(m?.totalPipeline ?? 0, { compact: true })}
            variant="brand"
          />
          <KpiTile
            label="Closed Won YTD"
            value={formatMoney(m?.closedWonYTD ?? 0, { compact: true })}
            variant="positive"
          />
          <KpiTile
            label="At-Risk Deals"
            value={String((atRisk.data?.data ?? []).length)}
            sub={formatMoney(atRiskValue, { compact: true })}
            variant={atRiskValue > 0 ? 'negative' : 'positive'}
          />
          <KpiTile
            label="Renewals at Risk"
            value={String(m?.renewalsAtRiskCount ?? 0)}
            variant={(m?.renewalsAtRiskCount ?? 0) > 0 ? 'warn' : 'positive'}
          />
          <KpiTile
            label="Avg Health"
            value={String(m?.avgHealthScore != null ? Math.round(m.avgHealthScore) : '—')}
          />
          <KpiTile
            label="Expansion"
            value={formatMoney(m?.expansionPipeline ?? 0, { compact: true })}
            variant="brand"
          />
        </div>

        <div className="mb-6">
          <PriorityPanel
            title="Today's Priorities"
            subtitle="Cross-team critical items: at-risk deals, imminent renewals, and rep coaching opportunities."
            items={items}
            isLoading={metrics.isLoading || priorities.isLoading || atRisk.isLoading || renewals.isLoading}
            emptyMessage="No critical items across the team today."
            viewAllTo="/dashboard/executive"
            viewAllLabel="Open Executive Hub"
            maxVisible={10}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <DrillCard
            title="Sales Leader Dashboard"
            description="Rep performance, coaching opportunities, and pipeline by stage."
            to="/dashboard/sales-leader"
          />
          <DrillCard
            title="Renewals"
            description="All upcoming renewals with health, risk, and recommended action."
            to="/renewal-dashboard"
          />
          <DrillCard
            title="Opportunities"
            description="Every open deal sortable by stage, MEDDPICC, and forecast."
            to="/opportunities"
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
