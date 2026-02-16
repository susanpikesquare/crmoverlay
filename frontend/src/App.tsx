import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import Landing from './pages/Landing';
import Login from './pages/Login';
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Dashboard from './pages/Dashboard';
import SalesLeaderDashboard from './pages/SalesLeaderDashboard';
import ExecutiveHub from './pages/ExecutiveHub';
import AEHub from './pages/AEHub';
import AMHub from './pages/AMHub';
import CSMHub from './pages/CSMHub';
import Account360 from './pages/Account360';
import AccountsList from './pages/AccountsList';
import OpportunitiesList from './pages/OpportunitiesList';
import OpportunityDetail from './pages/OpportunityDetail';
import AdminPanel from './pages/AdminPanel';
import AccountPlansList from './pages/AccountPlansList';
import AccountPlan from './pages/AccountPlan';
import AccountPlanNew from './pages/AccountPlanNew';
import GongAISearchPage from './pages/GongAISearchPage';
import Navigation from './components/Navigation';
import ImpersonationBanner from './components/ImpersonationBanner';
import apiClient from './services/api';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Permission gate wrapper for object-level access control
function PermissionGate({ objectType, children }: { objectType: string; children: React.ReactNode }) {
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['objectPermissions'],
    queryFn: async () => {
      const response = await apiClient.get('/api/metadata/object-permissions');
      return response.data.data as Record<string, { accessible: boolean }>;
    },
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (permissions && permissions[objectType] && !permissions[objectType].accessible) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}

// Access denied page
function AccessDenied() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-gray-300 mb-4">403</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this resource. Contact your Salesforce administrator if you believe this is an error.
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}

// Layout wrapper to conditionally show navigation
function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  // Don't show nav on landing page, login pages, or super admin pages
  const showNav =
    location.pathname !== '/' &&
    location.pathname !== '/login' &&
    !location.pathname.startsWith('/superadmin');

  return (
    <>
      {showNav && (
        <>
          <Navigation />
          <ImpersonationBanner />
        </>
      )}
      {children}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/superadmin/login" element={<SuperAdminLogin />} />
            <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/executive" element={<ExecutiveHub />} />
            <Route path="/dashboard/sales-leader" element={<SalesLeaderDashboard />} />
            <Route path="/dashboard/ae" element={<AEHub />} />
            <Route path="/dashboard/am" element={<AMHub />} />
            <Route path="/dashboard/csm" element={<CSMHub />} />
            <Route path="/accounts" element={<PermissionGate objectType="Account"><AccountsList /></PermissionGate>} />
            <Route path="/account/:id" element={<PermissionGate objectType="Account"><Account360 /></PermissionGate>} />
            <Route path="/opportunities" element={<PermissionGate objectType="Opportunity"><OpportunitiesList /></PermissionGate>} />
            <Route path="/opportunity/:id" element={<PermissionGate objectType="Opportunity"><OpportunityDetail /></PermissionGate>} />
            <Route path="/account-plans" element={<PermissionGate objectType="Account"><AccountPlansList /></PermissionGate>} />
            <Route path="/account-plan/new/:accountId" element={<PermissionGate objectType="Account"><AccountPlanNew /></PermissionGate>} />
            <Route path="/account-plan/:id" element={<PermissionGate objectType="Account"><AccountPlan /></PermissionGate>} />
            <Route path="/gong-search" element={<GongAISearchPage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/access-denied" element={<AccessDenied />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
