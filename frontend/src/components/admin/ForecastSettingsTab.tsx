import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export default function ForecastSettingsTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const forecastConfig = config.forecastConfig || {};
  const stages: string[] = config.opportunityStages || [];

  const [forecastMethod, setForecastMethod] = useState<'forecastCategory' | 'probability'>(
    forecastConfig.forecastMethod ?? 'probability'
  );
  const [commitProbabilityThreshold, setCommitProbabilityThreshold] = useState<number>(
    forecastConfig.commitProbabilityThreshold ?? 70
  );
  const [bestCaseProbabilityThreshold, setBestCaseProbabilityThreshold] = useState<number>(
    forecastConfig.bestCaseProbabilityThreshold ?? 50
  );
  const [stageWeights, setStageWeights] = useState<Record<string, number>>(
    forecastConfig.stageWeights ?? {}
  );

  // Quota settings
  const [quotaSource, setQuotaSource] = useState<'salesforce' | 'forecastingQuota' | 'manual' | 'none'>(
    forecastConfig.quotaSource ?? 'none'
  );
  const [salesforceQuotaField, setSalesforceQuotaField] = useState<string>(
    forecastConfig.salesforceQuotaField ?? 'Quarterly_Quota__c'
  );
  const [quotaPeriod, setQuotaPeriod] = useState<'quarterly' | 'annual'>(
    forecastConfig.quotaPeriod ?? 'quarterly'
  );
  const [defaultQuota, setDefaultQuota] = useState<number>(
    forecastConfig.defaultQuota ?? 0
  );
  const [manualQuotas, setManualQuotas] = useState<Record<string, number>>(
    forecastConfig.manualQuotas ?? {}
  );

  // Fetch team members for manual quota entry
  const { data: teamData } = useQuery<{ success: boolean; data: { id: string; name: string }[] }>({
    queryKey: ['team-members-for-quotas'],
    queryFn: async () => {
      const response = await api.get('/api/users');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: quotaSource === 'manual',
  });

  const teamMembers = teamData?.data || [];

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put('/api/admin/config/forecast', data);
      return response.data;
    },
    onMutate: () => onSave('saving'),
    onSuccess: () => {
      onSave('saved');
      queryClient.invalidateQueries({ queryKey: ['adminConfig'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-forecast'] });
      setTimeout(() => onSave('idle'), 2000);
    },
    onError: (error) => {
      console.error('Error saving forecast config:', error);
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      forecastMethod,
      commitProbabilityThreshold,
      bestCaseProbabilityThreshold,
      stageWeights,
      quotaSource,
      salesforceQuotaField,
      quotaPeriod,
      manualQuotas,
      defaultQuota,
    });
  };

  const handleStageWeightChange = (stage: string, value: number) => {
    setStageWeights(prev => ({ ...prev, [stage]: value }));
  };

  const handleManualQuotaChange = (userId: string, value: number) => {
    setManualQuotas(prev => ({ ...prev, [userId]: value }));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Forecast Settings</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure how pipeline forecasts are calculated and displayed
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Section 1: Forecast Grouping Method */}
      <div className="mb-8">
        <h4 className="text-md font-semibold text-gray-800 mb-3">Forecast Grouping Method</h4>
        <p className="text-sm text-gray-500 mb-4">
          Choose how opportunities are grouped into Commit, Best Case, and Pipeline categories.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setForecastMethod('probability')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              forecastMethod === 'probability'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-gray-900 mb-1">Probability Thresholds</div>
            <div className="text-sm text-gray-600">
              Group deals based on their Probability % field. Configure the threshold values below.
            </div>
            {forecastMethod === 'probability' && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-blue-800 font-medium w-32">Commit &ge;</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={commitProbabilityThreshold}
                    onChange={(e) => setCommitProbabilityThreshold(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-blue-300 rounded text-center text-sm"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-purple-800 font-medium w-32">Best Case &ge;</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bestCaseProbabilityThreshold}
                    onChange={(e) => setBestCaseProbabilityThreshold(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-purple-300 rounded text-center text-sm"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <div className="text-xs text-gray-500">
                  Pipeline = all deals below {bestCaseProbabilityThreshold}% probability
                </div>
              </div>
            )}
          </button>

          <button
            onClick={() => setForecastMethod('forecastCategory')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              forecastMethod === 'forecastCategory'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-gray-900 mb-1">Salesforce Forecast Category</div>
            <div className="text-sm text-gray-600">
              Use Salesforce's ForecastCategory field (Commit, Best Case, Pipeline). Requires Collaborative Forecasting to be enabled.
            </div>
          </button>
        </div>
      </div>

      {/* Section 2: Quota / Target Configuration */}
      <div className="mb-8">
        <h4 className="text-md font-semibold text-gray-800 mb-3">Quota / Target</h4>
        <p className="text-sm text-gray-500 mb-4">
          Set up targets to display quota attainment on the Pipeline & Forecast tile.
        </p>

        <div className="space-y-3">
          {/* Quota Source Selection */}
          <div className="flex flex-wrap gap-3">
            {[
              { value: 'none', label: 'No Target', desc: 'Hide quota attainment' },
              { value: 'forecastingQuota', label: 'Forecasting Quotas', desc: 'Pull from Salesforce Collaborative Forecasting' },
              { value: 'salesforce', label: 'User Field', desc: 'Pull from a custom field on the User object' },
              { value: 'manual', label: 'Manual Entry', desc: 'Enter quotas per user here' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setQuotaSource(option.value as any)}
                className={`flex-1 min-w-[150px] p-3 rounded-lg border-2 text-left transition-colors ${
                  quotaSource === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900 text-sm">{option.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{option.desc}</div>
              </button>
            ))}
          </div>

          {/* Forecasting Quotas info */}
          {quotaSource === 'forecastingQuota' && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-1">Salesforce Collaborative Forecasting</p>
              <p className="text-xs text-blue-700">
                Quotas will be pulled from the ForecastingQuota object based on the selected date range.
                Each user's quota for the matching period will be summed automatically.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Requires Collaborative Forecasting to be enabled in your Salesforce org with quotas assigned to users.
              </p>
            </div>
          )}

          {/* Salesforce User Field */}
          {quotaSource === 'salesforce' && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-3">
              <div>
                <label className="block text-sm font-medium text-blue-800 mb-1">Salesforce Quota Field (on User object)</label>
                <input
                  type="text"
                  value={salesforceQuotaField}
                  onChange={(e) => setSalesforceQuotaField(e.target.value)}
                  placeholder="e.g., Quarterly_Quota__c"
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-blue-600 mt-1">API name of the quota field on the User object</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-800 mb-1">Quota Period</label>
                <select
                  value={quotaPeriod}
                  onChange={(e) => setQuotaPeriod(e.target.value as any)}
                  className="px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>
          )}

          {/* Manual Quota Entry */}
          {quotaSource === 'manual' && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-3">
              <div>
                <label className="block text-sm font-medium text-green-800 mb-1">Default Quota (per user)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <input
                    type="number"
                    min={0}
                    value={defaultQuota}
                    onChange={(e) => setDefaultQuota(Number(e.target.value))}
                    className="w-40 px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <p className="text-xs text-green-600 mt-1">Applied to users without an individual quota below</p>
              </div>

              {teamMembers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-green-800 mb-2">Individual Quotas</label>
                  <div className="bg-white rounded-lg border border-green-200 divide-y divide-green-100">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="px-3 py-2 flex items-center justify-between">
                        <span className="text-sm text-gray-900">{member.name}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-400">$</span>
                          <input
                            type="number"
                            min={0}
                            value={manualQuotas[member.id] ?? ''}
                            onChange={(e) => handleManualQuotaChange(member.id, Number(e.target.value))}
                            placeholder={defaultQuota > 0 ? defaultQuota.toLocaleString() : '0'}
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {teamMembers.length === 0 && (
                <p className="text-xs text-green-700">
                  Team member list will appear here once user data is available. The default quota will be used for all team members.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Stage Weights */}
      <div>
        <h4 className="text-md font-semibold text-gray-800 mb-3">Stage Weights</h4>
        <p className="text-sm text-gray-500 mb-4">
          Stage Weighted Pipeline = sum of (Deal Amount x Stage Weight %). Set a weight for each opportunity stage.
        </p>

        {stages.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            No opportunity stages configured. Go to the Opportunity Stages tab to add stages first.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {stages.map((stage) => (
                <div
                  key={stage}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900 text-sm">{stage}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={stageWeights[stage] ?? 0}
                      onChange={(e) => handleStageWeightChange(stage, Number(e.target.value))}
                      className="w-32"
                    />
                    <div className="w-16 flex items-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={stageWeights[stage] ?? 0}
                        onChange={(e) => handleStageWeightChange(stage, Number(e.target.value))}
                        className="w-14 px-2 py-1 text-sm border border-gray-300 rounded text-center"
                      />
                      <span className="text-sm text-gray-500 ml-1">%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
