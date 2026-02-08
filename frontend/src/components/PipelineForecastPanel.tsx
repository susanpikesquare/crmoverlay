interface PipelineForecast {
  periodName: string;
  totalPipeline: number;
  commitForecast: number;
  bestCaseForecast: number;
  closedWon: number;
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
  forecast: PipelineForecast;
}

export default function PipelineForecastPanel({ forecast }: PipelineForecastPanelProps) {
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

  const maxStageValue = Math.max(...forecast.opportunitiesByStage.map(s => s.value), 1);
  const hasData = forecast.totalPipeline > 0 || forecast.closedWon > 0;

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pipeline & Forecast</h2>
          {forecast.periodName && (
            <p className="text-sm text-gray-500 mt-0.5">{forecast.periodName}</p>
          )}
        </div>
        {forecast.forecastStatus.submissionUrl && (
          <a
            href={forecast.forecastStatus.submissionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            View in Salesforce
          </a>
        )}
      </div>

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
              <div className="text-xs text-gray-600 mb-1">Commit (&ge;70%)</div>
              <div className="text-lg font-bold text-blue-900">
                {formatCurrency(forecast.commitForecast)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Best Case (&ge;50%)</div>
              <div className="text-lg font-bold text-purple-900">
                {formatCurrency(forecast.bestCaseForecast)}
              </div>
            </div>
          </div>

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
