import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export default function ForecastSettingsTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const forecastConfig = config.forecastConfig || {};
  const stages: string[] = config.opportunityStages || [];

  const [commitProbability, setCommitProbability] = useState<number>(forecastConfig.commitProbability ?? 90);
  const [bestCaseProbability, setBestCaseProbability] = useState<number>(forecastConfig.bestCaseProbability ?? 70);
  const [pipelineProbability, setPipelineProbability] = useState<number>(forecastConfig.pipelineProbability ?? 30);
  const [stageWeights, setStageWeights] = useState<Record<string, number>>(forecastConfig.stageWeights ?? {});

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put('/api/admin/config/forecast', data);
      return response.data;
    },
    onMutate: () => onSave('saving'),
    onSuccess: () => {
      onSave('saved');
      queryClient.invalidateQueries({ queryKey: ['adminConfig'] });
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
      commitProbability,
      bestCaseProbability,
      pipelineProbability,
      stageWeights,
    });
  };

  const handleStageWeightChange = (stage: string, value: number) => {
    setStageWeights(prev => ({ ...prev, [stage]: value }));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Forecast Settings</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure forecast category probabilities and stage weights for weighted pipeline calculations
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

      {/* Section 1: Forecast Category Probabilities */}
      <div className="mb-8">
        <h4 className="text-md font-semibold text-gray-800 mb-3">Forecast Category Probabilities</h4>
        <p className="text-sm text-gray-500 mb-4">
          These percentages are used to calculate weighted forecast amounts. Weighted Amount = Deal Amount x Category Probability %.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Commit Probability %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={commitProbability}
              onChange={(e) => setCommitProbability(Number(e.target.value))}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-bold text-center"
            />
            <p className="text-xs text-blue-600 mt-1 text-center">
              Deals in "Commit" forecast category
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-purple-800 mb-2">
              Best Case Probability %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={bestCaseProbability}
              onChange={(e) => setBestCaseProbability(Number(e.target.value))}
              className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg font-bold text-center"
            />
            <p className="text-xs text-purple-600 mt-1 text-center">
              Deals in "Best Case" forecast category
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Pipeline Probability %
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={pipelineProbability}
              onChange={(e) => setPipelineProbability(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 text-lg font-bold text-center"
            />
            <p className="text-xs text-gray-600 mt-1 text-center">
              Deals in "Pipeline" forecast category
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Stage Weights */}
      <div>
        <h4 className="text-md font-semibold text-gray-800 mb-3">Stage Weights</h4>
        <p className="text-sm text-gray-500 mb-4">
          Stage Weighted Pipeline = sum of (Deal Amount x Stage Weight %). Set a weight for each opportunity stage to calculate the Stage Weighted Pipeline metric.
        </p>

        {stages.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            No opportunity stages configured. Go to the Opportunity Stages tab to add stages first.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h5 className="text-sm font-semibold text-gray-700 uppercase">
                Stage Weights ({stages.length} stages)
              </h5>
            </div>
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

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-2">
          <span className="text-blue-600">i</span>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How Weighted Forecast Works:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Weighted Commit</strong> = Total Commit deals x Commit Probability %</li>
              <li><strong>Weighted Best Case</strong> = Total Best Case deals x Best Case Probability %</li>
              <li><strong>Weighted Pipeline</strong> = Total Pipeline deals x Pipeline Probability %</li>
              <li><strong>Stage Weighted Pipeline</strong> = Sum of each deal's Amount x its Stage Weight %</li>
              <li>Categories are based on Salesforce's ForecastCategory field, not Probability %</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
