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
  role: string;
}

interface CSMMetrics {
  accountsAtRisk: number;
  avgHealthScore: number;
  upcomingRenewals: number;
  adoptionTrend: number;
}

interface AtRiskAccount {
  id: string;
  name: string;
  healthScore: number;
  riskFactors: string[];
  arr?: number;
  daysToRenewal?: number;
}

interface LicenseUtilizationAccount {
  id: string;
  name: string;
  contractedSeats: number;
  activeUsers: number;
  utilizationPercent: number;
  healthScore?: number;
  arr?: number;
  daysToRenewal?: number;
  renewalRisk?: string;
}

export default function CustomerSuccessHome() {
  const { data: user } = useQuery<UserMe>({
    queryKey: ['userMe'],
    queryFn: async () => (await apiClient.get('/api/user/me')).data.data,
  });

  const metrics = useQuery<{ success: boolean; data: CSMMetrics }>({
    queryKey: ['csm-metrics-home'],
    queryFn: async () => (await apiClient.get('/api/hub/csm/metrics')).data,
  });
  const atRisk = useQuery<{ success: boolean; data: AtRiskAccount[] }>({
    queryKey: ['csm-at-risk-home'],
    queryFn: async () => (await apiClient.get('/api/hub/csm/at-risk')).data,
  });
  const underutilized = useQuery<{ success: boolean; data: LicenseUtilizationAccount[] }>({
    queryKey: ['csm-underutilized-home'],
    queryFn: async () => (await apiClient.get('/api/hub/csm/underutilized')).data,
  });
  const expansion = useQuery<{ success: boolean; data: LicenseUtilizationAccount[] }>({
    queryKey: ['csm-expansion-home'],
    queryFn: async () => (await apiClient.get('/api/hub/csm/expansion-opportunities')).data,
  });

  const priorities: PriorityItem[] = useMemo(() => {
    const out: PriorityItem[] = [];

    // At-risk accounts — critical
    (atRisk.data?.data ?? []).forEach((a) => {
      out.push({
        key: `risk-${a.id}`,
        to: `/account/${a.id}`,
        severity: 'critical',
        title: a.name,
        subtitle:
          `Health ${a.healthScore}` +
          (a.daysToRenewal != null ? ` • Renewal in ${a.daysToRenewal}d` : '') +
          (a.riskFactors?.length ? ` • ${a.riskFactors[0]}` : ''),
        metric: a.arr != null ? formatMoney(a.arr, { compact: true }) : undefined,
      });
    });

    // Severely underutilized — warning (utilization < 30%)
    (underutilized.data?.data ?? [])
      .filter((a) => a.utilizationPercent < 30)
      .slice(0, 5)
      .forEach((a) => {
        out.push({
          key: `under-${a.id}`,
          to: `/account/${a.id}`,
          severity: 'warning',
          title: a.name,
          subtitle: `${a.utilizationPercent}% utilization • ${a.activeUsers}/${a.contractedSeats} seats`,
          metric: a.arr != null ? formatMoney(a.arr, { compact: true }) : undefined,
        });
      });

    // Expansion opportunities (over 100% utilization) — opportunity
    (expansion.data?.data ?? [])
      .filter((a) => a.utilizationPercent >= 100)
      .slice(0, 5)
      .forEach((a) => {
        out.push({
          key: `expand-${a.id}`,
          to: `/account/${a.id}`,
          severity: 'opportunity',
          title: a.name,
          subtitle: `${a.utilizationPercent}% utilization — seats exceeded`,
          metric: a.arr != null ? formatMoney(a.arr, { compact: true }) : undefined,
        });
      });

    return out;
  }, [atRisk.data, underutilized.data, expansion.data]);

  const m = metrics.data?.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <HomeHeader
          greeting={user?.name?.split(' ')[0] ?? 'there'}
          subtitle="Customer health, adoption signals, and renewals you should be on top of."
        />

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile
            label="Accounts at Risk"
            value={String(m?.accountsAtRisk ?? '—')}
            variant={(m?.accountsAtRisk ?? 0) > 0 ? 'negative' : 'positive'}
          />
          <KpiTile
            label="Avg Health Score"
            value={String(m?.avgHealthScore != null ? Math.round(m.avgHealthScore) : '—')}
            variant={(m?.avgHealthScore ?? 0) >= 70 ? 'positive' : 'warn'}
          />
          <KpiTile
            label="Renewals (90d)"
            value={String(m?.upcomingRenewals ?? '—')}
            variant="brand"
          />
          <KpiTile
            label="Adoption Trend"
            value={m?.adoptionTrend != null ? formatPct(m.adoptionTrend, 1) : '—'}
            sub="quarter-over-quarter"
            variant={(m?.adoptionTrend ?? 0) >= 0 ? 'positive' : 'negative'}
          />
        </div>

        <div className="mb-6">
          <PriorityPanel
            title="Today's Priorities"
            subtitle="At-risk customers, underutilized seats, and accounts ready for expansion."
            items={priorities}
            isLoading={metrics.isLoading || atRisk.isLoading || underutilized.isLoading || expansion.isLoading}
            emptyMessage="No customer issues flagged today. Nice."
            viewAllTo="/dashboard/csm"
            viewAllLabel="View CSM Hub"
            maxVisible={10}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <DrillCard
            title="Renewals"
            description="All upcoming renewals with health, risk, and recommended action."
            to="/renewal-dashboard"
          />
          <DrillCard
            title="Accounts"
            description="Every account in your book with health and contract details."
            to="/accounts"
          />
          <DrillCard
            title="Account Plans"
            description="Strategic plans for your highest-priority customers."
            to="/account-plans"
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
