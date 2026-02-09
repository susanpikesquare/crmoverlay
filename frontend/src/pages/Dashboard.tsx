import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  profile: string;
  role: 'executive' | 'sales-leader' | 'ae' | 'am' | 'csm' | 'unknown';
}

export default function Dashboard() {
  const navigate = useNavigate();

  // Fetch user info to determine role
  const { data: userInfo, isLoading } = useQuery({
    queryKey: ['userInfo'],
    queryFn: async () => {
      const response = await apiClient.get('/api/user/me');
      return response.data.data as UserInfo;
    },
  });

  // Redirect based on role
  useEffect(() => {
    if (!isLoading && userInfo) {
      switch (userInfo.role) {
        case 'executive':
          navigate('/dashboard/executive', { replace: true });
          break;
        case 'sales-leader':
          navigate('/dashboard/sales-leader', { replace: true });
          break;
        case 'ae':
          navigate('/dashboard/ae', { replace: true });
          break;
        case 'am':
          navigate('/dashboard/am', { replace: true });
          break;
        case 'csm':
          navigate('/dashboard/csm', { replace: true });
          break;
        default:
          // Unknown role - stay on this page and show error
          break;
      }
    }
  }, [userInfo, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userInfo || userInfo.role === 'unknown') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <span className="text-4xl mb-4 block">⚠️</span>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard Not Available</h2>
            <p className="text-gray-600 mb-6">
              Your Salesforce profile ({userInfo?.profile || 'Unknown'}) does not have an assigned dashboard role.
              Please contact your administrator.
            </p>
            <a
              href="/accounts"
              className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              View Accounts
            </a>
          </div>
        </div>
      </div>
    );
  }

  // This should never render since we redirect above
  return null;
}
