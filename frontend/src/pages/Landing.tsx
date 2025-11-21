import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';

const Landing = () => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      setLoading(true);
      const response = await apiClient.healthCheck();
      setHealthStatus(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend');
      console.error('Health check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">RI</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                CRM Overlay
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Revenue Intelligence</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Revenue Intelligence Platform
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            AI-powered insights for AE, AM, and CSM cockpits. Connect to Salesforce,
            Clay, and 6sense for comprehensive account intelligence and competitive tracking.
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
          {/* Backend Status Card */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Backend Status</h3>
            {loading ? (
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                <span className="text-gray-600">Checking connection...</span>
              </div>
            ) : error ? (
              <div className="flex items-center space-x-3 text-danger-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>{error}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center space-x-3 text-success-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Connected</span>
                </div>
                {healthStatus && (
                  <div className="mt-4 text-sm text-gray-600 space-y-1">
                    <p>Status: <span className="font-medium text-gray-900">{healthStatus.status}</span></p>
                    <p>Uptime: <span className="font-medium text-gray-900">{Math.floor(healthStatus.uptime)}s</span></p>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={checkHealth}
              className="btn btn-secondary mt-4 w-full"
              disabled={loading}
            >
              {loading ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>

          {/* Features Card */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Features</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-primary-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-700">Salesforce API Integration</span>
              </li>
              <li className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-primary-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-700">AI-Powered Recommendations</span>
              </li>
              <li className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-primary-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-700">Account Intelligence</span>
              </li>
              <li className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-primary-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-700">Competitive Tracking</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Quick Start Section */}
        <div className="card max-w-4xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h3>
          <div className="space-y-4 text-gray-700">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <p>Configure your Salesforce credentials in the <code className="px-2 py-1 bg-gray-100 rounded text-sm">.env</code> file</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <p>Connect to Clay and 6sense for enhanced account intelligence</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <p>Start exploring your personalized cockpit dashboard</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-center text-gray-600 text-sm">
            Revenue Intelligence Platform &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
