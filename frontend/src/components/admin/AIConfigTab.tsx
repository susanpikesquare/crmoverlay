import React from 'react';

export default function AIConfigTab() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-bold text-gray-900">AI Configuration</h2>
        <p className="mt-2 text-sm text-gray-600">
          Configure AI provider API keys to enable AI-powered features like Deal Summaries and Recommendations.
          The system will automatically use the first available key in this priority order: Anthropic → OpenAI → Google.
        </p>
      </div>

      {/* Important Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <span className="text-2xl mr-3">🔒</span>
          <div>
            <h3 className="text-sm font-semibold text-yellow-800">Security Notice</h3>
            <p className="mt-1 text-sm text-yellow-700">
              API keys are stored securely in Heroku Config Vars as environment variables.
              They are never exposed in code or logs. Only administrators can view or modify these settings.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Selection Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <span className="text-2xl mr-3">ℹ️</span>
          <div>
            <h3 className="text-sm font-semibold text-blue-800">How AI Provider Selection Works</h3>
            <p className="mt-1 text-sm text-blue-700">
              You only need to configure ONE of the providers below. The system will check for API keys in this order:
            </p>
            <ol className="mt-2 text-sm text-blue-700 list-decimal list-inside space-y-1">
              <li><strong>Anthropic Claude</strong> - Best quality for complex reasoning</li>
              <li><strong>OpenAI ChatGPT</strong> - Good for existing OpenAI customers</li>
              <li><strong>Google Gemini</strong> - Good for existing Google Cloud customers</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Configuration Instructions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">How to Configure AI Provider Keys</h3>
        <p className="text-sm text-gray-600 mb-4">
          AI API keys are securely managed through Heroku Config Vars (environment variables). Follow these steps to configure them:
        </p>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Step 1: Get your API Key</h4>
            <p className="text-sm text-gray-600 mb-2">Choose ONE provider and get an API key:</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
              <li>
                <strong>Anthropic Claude (Recommended):</strong>{' '}
                <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  console.anthropic.com
                </a>
              </li>
              <li>
                <strong>OpenAI ChatGPT:</strong>{' '}
                <a href="https://platform.openai.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  platform.openai.com
                </a>
              </li>
              <li>
                <strong>Google Gemini:</strong>{' '}
                <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  makersuite.google.com/app/apikey
                </a>
              </li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Step 2: Set the Config Var in Heroku</h4>
            <p className="text-sm text-gray-600 mb-3">
              Run this command in your terminal (replace YOUR_APP_NAME and YOUR_API_KEY):
            </p>

            {/* Anthropic */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">For Anthropic Claude:</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                  heroku config:set ANTHROPIC_API_KEY=your-api-key --app YOUR-APP-NAME
                </code>
                <button
                  onClick={() => copyToClipboard('heroku config:set ANTHROPIC_API_KEY=your-api-key --app YOUR-APP-NAME')}
                  className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* OpenAI */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">For OpenAI:</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                  heroku config:set OPENAI_API_KEY=your-api-key --app YOUR-APP-NAME
                </code>
                <button
                  onClick={() => copyToClipboard('heroku config:set OPENAI_API_KEY=your-api-key --app YOUR-APP-NAME')}
                  className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Google */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">For Google Gemini:</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                  heroku config:set GOOGLE_AI_API_KEY=your-api-key --app YOUR-APP-NAME
                </code>
                <button
                  onClick={() => copyToClipboard('heroku config:set GOOGLE_AI_API_KEY=your-api-key --app YOUR-APP-NAME')}
                  className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Step 3: Restart Your App (if needed)</h4>
            <p className="text-sm text-gray-600 mb-3">
              The app should automatically restart when you set a config var. If not, restart it manually:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-900 text-gray-100 p-3 rounded text-xs">
                heroku restart --app YOUR-APP-NAME
              </code>
              <button
                onClick={() => copyToClipboard('heroku restart --app YOUR-APP-NAME')}
                className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Step 4: Verify Configuration</h4>
            <p className="text-sm text-gray-600 mb-3">
              Check that your config var is set:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-900 text-gray-100 p-3 rounded text-xs">
                heroku config --app YOUR-APP-NAME
              </code>
              <button
                onClick={() => copyToClipboard('heroku config --app YOUR-APP-NAME')}
                className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Resources */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Need Help?</h3>
        <p className="text-sm text-blue-700 mb-2">
          For more information about managing Heroku Config Vars, see:
        </p>
        <a
          href="https://devcenter.heroku.com/articles/config-vars"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Heroku Config Vars Documentation →
        </a>
      </div>
    </div>
  );
}
