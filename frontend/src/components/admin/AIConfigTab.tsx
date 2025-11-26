import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface AIApiKey {
  id: string;
  provider: 'anthropic' | 'openai' | 'google' | 'agentforce';
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProviderConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'agentforce';
  name: string;
  description: string;
  icon: string;
  getKeyUrl: string;
  keyLabel: string;
  keyPlaceholder: string;
  noKeyRequired?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    provider: 'agentforce',
    name: 'Salesforce Agentforce',
    description: 'Uses your Salesforce org\'s Einstein AI - no separate API key needed',
    icon: '☁️',
    getKeyUrl: 'https://help.salesforce.com/s/articleView?id=sf.einstein_gpt_overview.htm',
    keyLabel: 'Agentforce Configuration',
    keyPlaceholder: '',
    noKeyRequired: true,
  },
  {
    provider: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Best quality for complex reasoning and detailed analysis',
    icon: '🧠',
    getKeyUrl: 'https://console.anthropic.com/',
    keyLabel: 'Anthropic API Key',
    keyPlaceholder: 'sk-ant-...',
  },
  {
    provider: 'openai',
    name: 'OpenAI ChatGPT',
    description: 'Good for existing OpenAI customers and general use',
    icon: '💬',
    getKeyUrl: 'https://platform.openai.com/',
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-...',
  },
  {
    provider: 'google',
    name: 'Google Gemini',
    description: 'Good for existing Google Cloud customers',
    icon: '✨',
    getKeyUrl: 'https://makersuite.google.com/app/apikey',
    keyLabel: 'Google AI API Key',
    keyPlaceholder: 'AIzaSy...',
  },
];

export default function AIConfigTab() {
  const queryClient = useQueryClient();
  const [configuredKeys, setConfiguredKeys] = useState<AIApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<{ [key: string]: string }>({});
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch configured keys
  useEffect(() => {
    fetchConfiguredKeys();
  }, []);

  const fetchConfiguredKeys = async () => {
    try {
      const response = await api.get('/api/admin/ai-api-keys');
      setConfiguredKeys(response.data.data || []);
    } catch (error) {
      console.error('Error fetching AI API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async (provider: string) => {
    const providerConfig = PROVIDERS.find(p => p.provider === provider);
    const apiKey = apiKeys[provider];

    // Agentforce doesn't need an API key
    if (!providerConfig?.noKeyRequired && (!apiKey || apiKey.trim() === '')) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    setSaving(provider);
    setMessage(null);

    try {
      const response = await api.post('/api/admin/ai-api-keys', {
        provider,
        apiKey: providerConfig?.noKeyRequired ? 'agentforce_enabled' : apiKey,
      });

      setMessage({ type: 'success', text: response.data.message });
      setApiKeys({ ...apiKeys, [provider]: '' }); // Clear the input
      await fetchConfiguredKeys();
      queryClient.invalidateQueries({ queryKey: ['adminConfig'] });
    } catch (error: any) {
      console.error('Error saving API key:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save API key',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (!confirm(`Are you sure you want to delete the ${provider} API key?`)) {
      return;
    }

    setSaving(provider);
    setMessage(null);

    try {
      const response = await api.delete(`/api/admin/ai-api-keys/${provider}`);
      setMessage({ type: 'success', text: response.data.message });
      await fetchConfiguredKeys();
      queryClient.invalidateQueries({ queryKey: ['adminConfig'] });
    } catch (error: any) {
      console.error('Error deleting API key:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to delete API key',
      });
    } finally {
      setSaving(null);
    }
  };

  const isConfigured = (provider: string) => {
    return configuredKeys.some((k) => k.provider === provider && k.isActive);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-bold text-gray-900">AI Configuration</h2>
        <p className="mt-2 text-sm text-gray-600">
          Configure AI providers to enable AI-powered features like Deal Summaries, Recommendations, and the AI Assistant.
        </p>
      </div>

      {/* Multi-Provider Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start">
          <span className="text-2xl mr-3">🔄</span>
          <div>
            <h3 className="text-sm font-semibold text-purple-800">Multi-Provider Support</h3>
            <p className="mt-1 text-sm text-purple-700">
              You can enable <strong>both Agentforce AND an external AI</strong> (Claude, OpenAI, or Gemini) for the best experience:
            </p>
            <ul className="mt-2 text-sm text-purple-700 list-disc list-inside">
              <li><strong>Agentforce</strong> - Powers Salesforce-native deal insights and recommendations</li>
              <li><strong>Claude/OpenAI/Gemini</strong> - Powers the AI Assistant chat for general questions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start">
            <span className="text-xl mr-3">{message.type === 'success' ? '✓' : '✗'}</span>
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <span className="text-2xl mr-3">🔒</span>
          <div>
            <h3 className="text-sm font-semibold text-blue-800">Security Notice</h3>
            <p className="mt-1 text-sm text-blue-700">
              API keys are encrypted and stored securely in the database. They are never exposed in logs or API responses.
              Only administrators can configure these settings.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Configuration Forms */}
      <div className="space-y-6">
        {PROVIDERS.map((providerConfig) => {
          const configured = isConfigured(providerConfig.provider);
          const isSaving = saving === providerConfig.provider;

          return (
            <div
              key={providerConfig.provider}
              className={`border rounded-lg p-6 ${
                configured
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start">
                  <span className="text-3xl mr-3">{providerConfig.icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      {providerConfig.name}
                      {configured && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          ✓ Configured
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{providerConfig.description}</p>
                  </div>
                </div>
                {configured && (
                  <button
                    onClick={() => handleDeleteKey(providerConfig.provider)}
                    disabled={isSaving}
                    className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                  >
                    {isSaving ? 'Deleting...' : 'Remove'}
                  </button>
                )}
              </div>

              {!configured && (
                <div className="mt-4">
                  {providerConfig.noKeyRequired ? (
                    // Agentforce - no API key needed, just enable button
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-3">
                        Agentforce uses your existing Salesforce connection to access Einstein AI.
                        Make sure Einstein is enabled in your Salesforce org.
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleSaveKey(providerConfig.provider)}
                          disabled={isSaving}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                        >
                          {isSaving ? 'Enabling...' : 'Enable Agentforce'}
                        </button>
                        <a
                          href={providerConfig.getKeyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Learn more about Einstein AI →
                        </a>
                      </div>
                    </div>
                  ) : (
                    // Standard providers - need API key
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {providerConfig.keyLabel}
                        </label>
                        <a
                          href={providerConfig.getKeyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Get API Key →
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type={showKeys[providerConfig.provider] ? 'text' : 'password'}
                          value={apiKeys[providerConfig.provider] || ''}
                          onChange={(e) => setApiKeys({ ...apiKeys, [providerConfig.provider]: e.target.value })}
                          placeholder={providerConfig.keyPlaceholder}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <button
                          onClick={() =>
                            setShowKeys({ ...showKeys, [providerConfig.provider]: !showKeys[providerConfig.provider] })
                          }
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                          title={showKeys[providerConfig.provider] ? 'Hide' : 'Show'}
                        >
                          {showKeys[providerConfig.provider] ? '👁️' : '👁️‍🗨️'}
                        </button>
                        <button
                          onClick={() => handleSaveKey(providerConfig.provider)}
                          disabled={isSaving}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {configured && (
                <div className="mt-4 text-xs text-gray-500">
                  {configuredKeys.find((k) => k.provider === providerConfig.provider)?.lastUsedAt
                    ? `Last used: ${new Date(
                        configuredKeys.find((k) => k.provider === providerConfig.provider)!.lastUsedAt!
                      ).toLocaleString()}`
                    : 'Not yet used'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Additional Help */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Need Help?</h3>
        <p className="text-sm text-gray-600 mb-2">
          You only need to configure ONE provider. The system will automatically use the first available provider.
          If you configure multiple providers, they will be tried in this order: Agentforce, Anthropic, OpenAI, Google.
        </p>
        <p className="text-sm text-gray-600 mb-2">
          <strong>Agentforce</strong> uses your existing Salesforce org's Einstein AI and doesn't require a separate API key.
          It's the recommended option if you have Einstein enabled in your Salesforce org.
        </p>
        <p className="text-sm text-gray-600">
          For external providers, visit their websites using the "Get API Key" link to obtain credentials.
        </p>
      </div>
    </div>
  );
}
