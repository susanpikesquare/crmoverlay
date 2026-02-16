import { Link } from 'react-router-dom';

interface ManagerAlert {
  id: string;
  category: 'stuck-deal' | 'low-meddpicc' | 'cold-account' | 'pipeline-gap' | 'large-deal-risk';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metric?: number;
  benchmark?: number;
  dealId?: string;
  dealName?: string;
  accountId?: string;
  accountName?: string;
  amount?: number;
}

interface ManagerAlertPanelProps {
  alerts: ManagerAlert[];
  isLoading?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export default function ManagerAlertPanel({ alerts, isLoading }: ManagerAlertPanelProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'stuck-deal': return '🔄';
      case 'low-meddpicc': return '📊';
      case 'cold-account': return '❄️';
      case 'pipeline-gap': return '📉';
      case 'large-deal-risk': return '💰';
      default: return '⚡';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'stuck-deal': return 'Stuck Deal';
      case 'low-meddpicc': return 'Low Qualification';
      case 'cold-account': return 'Cold Account';
      case 'pipeline-gap': return 'Pipeline Gap';
      case 'large-deal-risk': return 'Large Deal Risk';
      default: return 'Alert';
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-l-red-500 bg-red-50/50';
      case 'warning': return 'border-l-amber-500 bg-amber-50/50';
      case 'info': return 'border-l-blue-500 bg-blue-50/50';
      default: return 'border-l-slate-300 bg-slate-50';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700';
      case 'warning': return 'bg-amber-100 text-amber-700';
      case 'info': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getLinkPath = (alert: ManagerAlert) => {
    if (alert.dealId) return `/opportunity/${alert.dealId}`;
    if (alert.accountId) return `/account/${alert.accountId}`;
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg shadow-md p-6 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Your Manager Would Flag...</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const infoAlerts = alerts.filter(a => a.severity === 'info');

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg shadow-md p-6 border border-slate-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Your Manager Would Flag...</h2>
          <p className="text-sm text-slate-500">Self-coaching insights for your deals</p>
        </div>
        {alerts.length > 0 && (
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
            criticalAlerts.length > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <div className="text-3xl mb-2">✅</div>
          <p className="font-medium">Looking good!</p>
          <p className="text-sm mt-1">No items your manager would flag right now.</p>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto flex-1 max-h-[420px]">
          {/* Severity Groups */}
          {[
            { label: 'Critical', items: criticalAlerts },
            { label: 'Needs Attention', items: warningAlerts },
            { label: 'Informational', items: infoAlerts },
          ]
            .filter(group => group.items.length > 0)
            .map(group => (
              <div key={group.label}>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  {group.label} ({group.items.length})
                </div>
                <div className="space-y-2">
                  {group.items.map(alert => {
                    const linkPath = getLinkPath(alert);
                    const content = (
                      <div
                        className={`p-3 rounded-lg border border-l-4 ${getSeverityStyle(alert.severity)} hover:shadow-sm transition-shadow`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base mt-0.5 flex-shrink-0">{getCategoryIcon(alert.category)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-slate-900">{alert.title}</span>
                              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getSeverityBadge(alert.severity)}`}>
                                {getCategoryLabel(alert.category)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{alert.description}</p>
                            {/* Metric vs Benchmark bar */}
                            {alert.metric !== undefined && alert.benchmark !== undefined && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 bg-slate-200 rounded-full h-1.5 max-w-[120px]">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      alert.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                                    }`}
                                    style={{
                                      width: `${Math.min(100, (alert.metric / Math.max(alert.benchmark * 2, alert.metric)) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-slate-500">
                                  {alert.metric} / {alert.benchmark} benchmark
                                </span>
                              </div>
                            )}
                            {alert.amount !== undefined && alert.amount > 0 && (
                              <span className="text-xs font-medium text-slate-700 mt-1 inline-block">
                                {formatCurrency(alert.amount)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );

                    return linkPath ? (
                      <Link key={alert.id} to={linkPath} className="block">
                        {content}
                      </Link>
                    ) : (
                      <div key={alert.id}>{content}</div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
