import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AEHub from './pages/AEHub';
import AMHub from './pages/AMHub';
import CSMHub from './pages/CSMHub';
import Account360 from './pages/Account360';
import AccountsList from './pages/AccountsList';
import OpportunitiesList from './pages/OpportunitiesList';
import OpportunityDetail from './pages/OpportunityDetail';
import AdminPanel from './pages/AdminPanel';
import Navigation from './components/Navigation';
import ImpersonationBanner from './components/ImpersonationBanner';

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

// Layout wrapper to conditionally show navigation
function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const showNav = location.pathname !== '/';

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
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/ae" element={<AEHub />} />
            <Route path="/dashboard/am" element={<AMHub />} />
            <Route path="/dashboard/csm" element={<CSMHub />} />
            <Route path="/accounts" element={<AccountsList />} />
            <Route path="/account/:id" element={<Account360 />} />
            <Route path="/opportunities" element={<OpportunitiesList />} />
            <Route path="/opportunity/:id" element={<OpportunityDetail />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
