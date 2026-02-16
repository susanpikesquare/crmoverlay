import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface SignalCategory {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  active: boolean;
}

interface BuyingSignalConfig {
  enabled: boolean;
  newsSearchEnabled: boolean;
  schedule: string;
  maxAccountsPerRun: number;
  newsPromptTemplate: string;
  signalCategories: SignalCategory[];
  lastRunAt?: string;
  lastRunStatus?: string;
}

interface TestResult {
  signals: Array<{
    type: string;
    category: string;
    headline: string;
    summary: string;
    url?: string;
    relevance: string;
    publishedDate?: string;
  }>;
  summary: string;
  citations: Array<{ url: string; title: string }>;
}

interface BuyingSignalConfigTabProps {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

const DEFAULT_CATEGORIES: SignalCategory[] = [
  { id: 'store-opening', name: 'New Store Openings', description: 'New retail locations, office openings, or facility expansions', keywords: ['new store', 'grand opening', 'expansion'], active: true },
  { id: 'executive-hire', name: 'Executive Hires', description: 'New VP, CTO, CRO, or other senior leadership appointments', keywords: ['new VP', 'new CTO', 'appointed', 'joins as'], active: true },
  { id: 'funding', name: 'Funding & Acquisitions', description: 'Funding rounds, acquisitions, IPO activity', keywords: ['series', 'funding', 'acquisition', 'acquired'], active: true },
  { id: 'partnership', name: 'Partnerships', description: 'Strategic partnerships, major contracts, or alliances', keywords: ['partnership', 'contract', 'alliance'], active: false },
];

const CRON_PRESETS: { label: string; value: string }[] = [
  { label: 'Daily at 2 AM', value: '0 2 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: 'Weekdays at 2 AM', value: '0 2 * * 1-5' },
  { label: 'Weekly (Sunday 2 AM)', value: '0 2 * * 0' },
];

export default function BuyingSignalConfigTab({ config, onSave }: BuyingSignalConfigTabProps) {
  const queryClient = useQueryClient();
  const initialConfig: BuyingSignalConfig = config?.buyingSignalConfig || {
    enabled: true,
    newsSearchEnabled: false,
    schedule: '0 2 * * *',
    maxAccountsPerRun: 30,
    newsPromptTemplate: '',
    signalCategories: DEFAULT_CATEGORIES,
  };

  const [formData, setFormData] = useState<BuyingSignalConfig>(initialConfig);
  const [testAccountName, setTestAccountName] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [runNowLoading, setRunNowLoading] = useState(false);
  const [runNowResult, setRunNowResult] = useState<string | null>(null);

  // New category form
  const [newCat, setNewCat] = useState({ name: '', description: '', keywords: '' });

  useEffect(() => {
    if (config?.buyingSignalConfig) {
      setFormData(config.buyingSignalConfig);
    }
  }, [config?.buyingSignalConfig]);

  const saveMutation = useMutation({
    mutationFn: async (data: BuyingSignalConfig) => {
      return api.put('/api/admin/config/buying-signals', data);
    },
    onMutate: () => onSave('saving'),
    onSuccess: () => {
      onSave('saved');
      queryClient.invalidateQueries({ queryKey: ['adminConfig'] });
      setTimeout(() => onSave('idle'), 2000);
    },
    onError: () => onSave('error'),
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleTest = async () => {
    if (!testAccountName.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      // Start the async search — returns a jobId to poll
      const startRes = await api.post('/api/admin/config/buying-signals/test', { accountName: testAccountName });
      const { jobId } = startRes.data;

      if (!jobId) {
        // Fallback: synchronous response (old API or immediate result)
        setTestResult(startRes.data.data || { signals: [], summary: 'No results.', citations: [] });
        setTestLoading(false);
        return;
      }

      // Poll for results every 3 seconds (web search can take 30-60s)
      const maxAttempts = 30; // Up to 90 seconds
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        try {
          const pollRes = await api.get(`/api/admin/config/buying-signals/test/${jobId}`);
          if (pollRes.data.status === 'done') {
            setTestResult(pollRes.data.data);
            setTestLoading(false);
            return;
          } else if (pollRes.data.status === 'error') {
            setTestResult({ signals: [], summary: `Error: ${pollRes.data.message || 'Search failed'}`, citations: [] });
            setTestLoading(false);
            return;
          }
          // Still processing — continue polling
        } catch {
          // Poll request failed — keep trying
        }
      }

      // Timed out after polling
      setTestResult({ signals: [], summary: 'Search is taking longer than expected. Please try again.', citations: [] });
    } catch (err: any) {
      setTestResult({ signals: [], summary: `Error: ${err.response?.data?.message || err.message}`, citations: [] });
    } finally {
      setTestLoading(false);
    }
  };

  const handleRunNow = async () => {
    if (!window.confirm('Run the full nightly batch now? This may take several minutes and will use API credits.')) return;
    setRunNowLoading(true);
    setRunNowResult(null);
    try {
      const res = await api.post('/api/admin/config/buying-signals/run-now');
      setRunNowResult(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['adminConfig'] });
    } catch (err: any) {
      setRunNowResult(`Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setRunNowLoading(false);
    }
  };

  const addCategory = () => {
    if (!newCat.name.trim()) return;
    const category: SignalCategory = {
      id: `cat_${Date.now()}`,
      name: newCat.name,
      description: newCat.description,
      keywords: newCat.keywords.split(',').map(k => k.trim()).filter(Boolean),
      active: true,
    };
    setFormData(prev => ({ ...prev, signalCategories: [...prev.signalCategories, category] }));
    setNewCat({ name: '', description: '', keywords: '' });
  };

  const removeCategory = (id: string) => {
    setFormData(prev => ({
      ...prev,
      signalCategories: prev.signalCategories.filter(c => c.id !== id),
    }));
  };

  const toggleCategory = (id: string) => {
    setFormData(prev => ({
      ...prev,
      signalCategories: prev.signalCategories.map(c =>
        c.id === id ? { ...c, active: !c.active } : c
      ),
    }));
  };

  const getCronLabel = (cron: string) => {
    const preset = CRON_PRESETS.find(p => p.value === cron);
    return preset ? preset.label : cron;
  };

  const getRelevanceBadge = (relevance: string) => {
    switch (relevance) {
      case 'high': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* Enable / Disable */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Buying Signal Detection</h3>
          <p className="text-sm text-gray-500 mt-1">
            Automatically detect buying signals from Gong transcripts and web news
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {formData.enabled && (
        <>
          {/* News Search Toggle */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">News Search (Claude Web Search)</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Use Claude's built-in web search to find news-based buying signals. Requires Anthropic API key.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.newsSearchEnabled}
                  onChange={e => setFormData(prev => ({ ...prev, newsSearchEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Schedule */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Schedule</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cron Expression</label>
                <select
                  value={formData.schedule}
                  onChange={e => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {CRON_PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Schedule: {getCronLabel(formData.schedule)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Accounts Per Run</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.maxAccountsPerRun}
                  onChange={e => setFormData(prev => ({ ...prev, maxAccountsPerRun: parseInt(e.target.value) || 30 }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Prompt Template */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">News Prompt Template</h4>
            <p className="text-xs text-gray-500 mb-3">
              Instructions for Claude when searching for news. Describe what types of signals are relevant to your business.
            </p>
            <textarea
              value={formData.newsPromptTemplate}
              onChange={e => setFormData(prev => ({ ...prev, newsPromptTemplate: e.target.value }))}
              rows={4}
              placeholder="Look for recent news that could indicate buying signals such as new store openings, executive hires, expansion announcements, funding rounds, or partnerships..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Signal Categories */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Signal Categories</h4>

            {formData.signalCategories.length === 0 && (
              <p className="text-sm text-gray-500 mb-3">No categories configured. Add categories below to help focus the news search.</p>
            )}

            <div className="space-y-2 mb-4">
              {formData.signalCategories.map(cat => (
                <div
                  key={cat.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${cat.active ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${cat.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {cat.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>
                    {cat.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {cat.keywords.map((kw, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">{kw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {cat.active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => removeCategory(cat.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new category */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-gray-600">Add Category</p>
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={newCat.name}
                  onChange={e => setNewCat(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Name"
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
                <input
                  value={newCat.description}
                  onChange={e => setNewCat(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description"
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
                <input
                  value={newCat.keywords}
                  onChange={e => setNewCat(prev => ({ ...prev, keywords: e.target.value }))}
                  placeholder="Keywords (comma-separated)"
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={addCategory}
                disabled={!newCat.name.trim()}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Category
              </button>
            </div>
          </div>

          {/* Test Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Test News Search</h4>
            <p className="text-xs text-gray-500 mb-3">Enter an account name to preview what signals would be detected.</p>
            <div className="flex gap-2 mb-3">
              <input
                value={testAccountName}
                onChange={e => setTestAccountName(e.target.value)}
                placeholder="e.g., Salesforce, Nike, Goldman Sachs"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleTest()}
              />
              <button
                onClick={handleTest}
                disabled={testLoading || !testAccountName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testLoading ? 'Searching...' : 'Test'}
              </button>
            </div>
            {testResult && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-700 mb-2 font-medium">{testResult.summary}</p>
                {testResult.signals.length > 0 ? (
                  <div className="space-y-2">
                    {testResult.signals.map((sig, i) => (
                      <div key={i} className="bg-white rounded-md p-2.5 border border-gray-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">{sig.headline}</span>
                              <span className={`px-1.5 py-0.5 text-xs rounded-full ${getRelevanceBadge(sig.relevance)}`}>
                                {sig.relevance}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600">{sig.summary}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">{sig.category}</span>
                              {sig.publishedDate && <span className="text-xs text-gray-400">{sig.publishedDate}</span>}
                            </div>
                          </div>
                        </div>
                        {sig.url && (
                          <a href={sig.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                            Source
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No signals found.</p>
                )}
              </div>
            )}
          </div>

          {/* Run Now + Last Run Status */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Manual Batch Run</h4>
                {formData.lastRunAt && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Last run: {new Date(formData.lastRunAt).toLocaleString()} —{' '}
                    <span className={formData.lastRunStatus === 'success' ? 'text-green-600' : formData.lastRunStatus === 'partial' ? 'text-yellow-600' : 'text-red-600'}>
                      {formData.lastRunStatus || 'unknown'}
                    </span>
                  </p>
                )}
              </div>
              <button
                onClick={handleRunNow}
                disabled={runNowLoading}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {runNowLoading ? 'Running...' : 'Run Now'}
              </button>
            </div>
            {runNowResult && (
              <p className="text-sm text-gray-700 mt-2 bg-gray-50 rounded p-2">{runNowResult}</p>
            )}
          </div>
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
