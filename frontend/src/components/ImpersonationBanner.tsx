import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

export default function ImpersonationBanner() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: authData } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/user');
      return response.data.data;
    },
  });

  const { data: sessionData } = useQuery({
    queryKey: ['session-debug'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/debug-session');
      return response.data.data;
    },
    refetchInterval: 5000, // Check every 5 seconds
  });

  const handleStopImpersonation = async () => {
    try {
      await apiClient.post('/auth/stop-impersonation');

      // Clear ALL queries to force fresh data
      queryClient.clear();

      // Fetch original user info to get their role
      const userResponse = await apiClient.get('/api/user/me');
      const userRole = userResponse.data.data.role;

      // Redirect to appropriate cockpit based on original user's role
      if (userRole === 'ae') {
        navigate('/dashboard/ae');
      } else if (userRole === 'am') {
        navigate('/dashboard/am');
      } else if (userRole === 'csm') {
        navigate('/dashboard/csm');
      } else {
        navigate('/dashboard');
      }

      // Force a page reload to ensure all state is fresh
      window.location.reload();
    } catch (error) {
      console.error('Error stopping impersonation:', error);
    }
  };

  // Check if user is currently impersonating based on session data
  const isImpersonating = sessionData?.sessionKeys?.includes('isImpersonating') &&
                         sessionData?.sessionKeys?.includes('originalUserId');

  if (!isImpersonating) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border-b border-yellow-200">
      <div className="max-w-7xl mx-auto px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-yellow-400 rounded-full">
              <svg
                className="w-5 h-5 text-yellow-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-yellow-900">
                Impersonation Mode Active
              </p>
              <p className="text-xs text-yellow-700">
                Viewing as: <span className="font-medium">{authData?.user?.name}</span> ({authData?.user?.email})
              </p>
            </div>
          </div>
          <button
            onClick={handleStopImpersonation}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition"
          >
            Exit Impersonation
          </button>
        </div>
      </div>
    </div>
  );
}
