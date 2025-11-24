interface QuarterData {
  quarterName: string;
  totalPipeline: number;
  commitForecast: number;
  bestCaseForecast: number;
  coverageRatio: number;
  opportunitiesByStage: {
    stageName: string;
    count: number;
    value: number;
  }[];
}

interface PipelineForecast {
  currentQuarter: QuarterData;
  nextQuarter: QuarterData;
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

  const getCoverageBadge = (ratio: number) => {
    if (ratio >= 3) return 'bg-green-100 text-green-800 border-green-300';
    if (ratio >= 2) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const renderQuarterSection = (quarter: QuarterData, title: string) => {
    const maxStageValue = Math.max(...quarter.opportunitiesByStage.map(s => s.value), 1);

    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}: {quarter.quarterName}</h3>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Total Pipeline</div>
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(quarter.totalPipeline)}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Commit</div>
            <div className="text-lg font-bold text-blue-900">
              {formatCurrency(quarter.commitForecast)}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Best Case</div>
            <div className="text-lg font-bold text-purple-900">
              {formatCurrency(quarter.bestCaseForecast)}
            </div>
          </div>
        </div>

        {/* Coverage Ratio */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Coverage Ratio</span>
            <span className={`text-sm font-bold ${getCoverageColor(quarter.coverageRatio)}`}>
              {quarter.coverageRatio.toFixed(1)}x
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                quarter.coverageRatio >= 3
                  ? 'bg-green-500'
                  : quarter.coverageRatio >= 2
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{
                width: `${Math.min(100, (quarter.coverageRatio / 4) * 100)}%`,
              }}
            ></div>
          </div>
        </div>

        {/* Pipeline by Stage */}
        {quarter.opportunitiesByStage.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-600 mb-2">Pipeline by Stage</div>
            <div className="space-y-2">
              {quarter.opportunitiesByStage.map((stage) => (
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
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">📊 Pipeline & Forecast</h2>
        {forecast.forecastStatus.submissionUrl && (
          <a
            href={forecast.forecastStatus.submissionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            View in Salesforce →
          </a>
        )}
      </div>

      {/* Forecast Submission Status */}
      {!forecast.forecastStatus.isSubmitted && forecast.currentQuarter.totalPipeline > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-yellow-800 text-sm font-medium">
              ⏰ Forecast not yet submitted for {forecast.currentQuarter.quarterName}
            </span>
          </div>
        </div>
      )}

      {/* Current Quarter */}
      {renderQuarterSection(forecast.currentQuarter, 'Current Quarter')}

      {/* Divider */}
      {forecast.nextQuarter.totalPipeline > 0 && (
        <div className="border-t border-gray-200 my-4"></div>
      )}

      {/* Next Quarter */}
      {forecast.nextQuarter.totalPipeline > 0 &&
        renderQuarterSection(forecast.nextQuarter, 'Next Quarter')}

      {/* Empty State */}
      {forecast.currentQuarter.totalPipeline === 0 && forecast.nextQuarter.totalPipeline === 0 && (
        <div className="text-center py-8">
          <span className="text-4xl mb-3 block">📈</span>
          <p className="text-gray-600">No pipeline data available</p>
          <p className="text-sm text-gray-500 mt-1">Create opportunities to build your pipeline</p>
        </div>
      )}
    </div>
  );
}
