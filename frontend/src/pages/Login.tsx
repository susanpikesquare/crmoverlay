import { config } from '../config';

export default function Login() {
  const handleSalesforceLogin = () => {
    // Redirect to backend OAuth endpoint which will redirect to Salesforce
    window.location.href = `${config.apiBaseUrl}/auth/salesforce`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">FormationIQ</h1>
          <p className="text-blue-100 text-lg">by PikeSquare</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Sign in with your Salesforce account</p>
          </div>

          {/* Salesforce Login Button */}
          <button
            onClick={handleSalesforceLogin}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-4 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10.5 3.75h-6a1.5 1.5 0 0 0-1.5 1.5v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V5.25a1.5 1.5 0 0 0-1.5-1.5zm-2.25 12h-1.5v-1.5h1.5v1.5zm0-3h-1.5v-1.5h1.5v1.5zm0-3h-1.5V8.25h1.5v1.5zm3 6h-1.5v-1.5h1.5v1.5zm0-3h-1.5v-1.5h1.5v1.5zm0-3h-1.5V8.25h1.5v1.5zM21 5.25v13.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5h6a1.5 1.5 0 0 1 1.5 1.5zm-3 10.5h-1.5v-1.5h1.5v1.5zm0-3h-1.5v-1.5h1.5v1.5zm0-3h-1.5V8.25h1.5v1.5zm-3 6h-1.5v-1.5h1.5v1.5zm0-3h-1.5v-1.5h1.5v1.5zm0-3h-1.5V8.25h1.5v1.5z"/>
            </svg>
            Sign in with Salesforce
          </button>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-800 text-center">
              <span className="font-medium">Secure Login:</span> You'll be redirected to Salesforce to authenticate
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
