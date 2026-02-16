import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import apiClient from '../services/api';

export default function Navigation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [showAccountsMenu, setShowAccountsMenu] = useState(false);
  const accountsMenuRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ accounts: any[]; opportunities: any[] } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    setShowSearchResults(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await apiClient.get('/api/search', { params: { q: searchQuery.trim() } });
        setSearchResults(response.data.data);
      } catch {
        setSearchResults({ accounts: [], opportunities: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const handleSearchSelect = (type: 'account' | 'opportunity', id: string) => {
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults(null);
    navigate(type === 'account' ? `/account/${id}` : `/opportunity/${id}`);
  };

  // Close accounts dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountsMenuRef.current && !accountsMenuRef.current.contains(e.target as Node)) {
        setShowAccountsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: brandingData } = useQuery({
    queryKey: ['branding'],
    queryFn: async () => {
      const response = await apiClient.get('/api/branding');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: authData } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/user');
      return response.data.data;
    },
  });

  // Check if user has admin profile
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/current-user-profile');
      return response.data.data;
    },
  });

  // Fetch object permissions for conditional nav links
  const { data: objectPermissions } = useQuery({
    queryKey: ['objectPermissions'],
    queryFn: async () => {
      const response = await apiClient.get('/api/metadata/object-permissions');
      return response.data.data as Record<string, { accessible: boolean }>;
    },
    staleTime: 30 * 60 * 1000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/users');
      return response.data.data;
    },
    enabled: showUserSelector,
  });

  const isAdmin = currentUserData?.profileName?.toLowerCase().includes('admin') ||
                  currentUserData?.profileName?.toLowerCase().includes('system administrator');

  const canAccessAccounts = objectPermissions?.Account?.accessible !== false;
  const canAccessOpportunities = objectPermissions?.Opportunity?.accessible !== false;

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/');
    }
  };

  const handleImpersonate = async (userId: string) => {
    try {
      await apiClient.post('/auth/impersonate', { userId });
      setShowUserSelector(false);
      queryClient.clear();

      const userResponse = await apiClient.get('/api/user/me');
      const userRole = userResponse.data.data.role;

      if (userRole === 'executive') navigate('/dashboard/executive');
      else if (userRole === 'ae') navigate('/dashboard/ae');
      else if (userRole === 'am') navigate('/dashboard/am');
      else if (userRole === 'csm') navigate('/dashboard/csm');
      else navigate('/dashboard');

      window.location.reload();
    } catch (error) {
      console.error('Impersonation error:', error);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center mr-8">
            {brandingData?.logoBase64 ? (
              <img
                src={brandingData.logoBase64}
                alt={brandingData.brandName || 'Logo'}
                style={{ height: `${brandingData.logoHeight || 32}px` }}
                className="object-contain"
              />
            ) : brandingData?.brandName ? (
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {brandingData.brandName}
              </span>
            ) : (
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                FormationIQ
              </span>
            )}
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-gray-700 hover:text-gray-900 font-medium transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Hub
            </Link>
            {canAccessAccounts && (
              <Link
                to="/accounts"
                className="text-gray-700 hover:text-gray-900 font-medium transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Accounts
              </Link>
            )}
            {canAccessOpportunities && (
              <Link
                to="/opportunities"
                className="text-gray-700 hover:text-gray-900 font-medium transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Opportunities
              </Link>
            )}
            {/* Admin Link - Only show for admins */}
            {(authData?.user?.isAdmin || authData?.user?.role === 'admin') && (
              <Link
                to="/admin"
                className="text-purple-700 hover:text-purple-900 font-medium transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Link>
            )}
          </div>

          {/* Global Search */}
          <div className="relative" ref={searchRef}>
            <div className="flex items-center bg-gray-100 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-purple-400 focus-within:bg-white transition">
              <svg className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search accounts & opps..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults) setShowSearchResults(true); }}
                onKeyDown={e => { if (e.key === 'Escape') { setShowSearchResults(false); (e.target as HTMLInputElement).blur(); } }}
                className="bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400 w-52"
              />
            </div>
            {showSearchResults && (
              <div className="absolute left-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                {searchLoading ? (
                  <div className="px-4 py-6 text-center text-gray-500 text-sm">
                    <svg className="animate-spin h-5 w-5 mx-auto mb-2 text-purple-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Searching...
                  </div>
                ) : searchResults && searchResults.accounts.length === 0 && searchResults.opportunities.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-500 text-sm">No results found</div>
                ) : (
                  <>
                    {searchResults && searchResults.accounts.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                          Accounts
                        </div>
                        {searchResults.accounts.map((acc: any) => (
                          <button
                            key={acc.id}
                            onClick={() => handleSearchSelect('account', acc.id)}
                            className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition border-b border-gray-50 last:border-0"
                          >
                            <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                            <p className="text-xs text-gray-500">
                              {acc.ownerName && <span>Owner: {acc.ownerName}</span>}
                              {acc.ownerName && acc.industry && <span> &middot; </span>}
                              {acc.industry && <span>{acc.industry}</span>}
                            </p>
                          </button>
                        ))}
                      </>
                    )}
                    {searchResults && searchResults.opportunities.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                          Opportunities
                        </div>
                        {searchResults.opportunities.map((opp: any) => (
                          <button
                            key={opp.id}
                            onClick={() => handleSearchSelect('opportunity', opp.id)}
                            className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition border-b border-gray-50 last:border-0"
                          >
                            <p className="text-sm font-medium text-gray-900">{opp.name}</p>
                            <p className="text-xs text-gray-500">
                              {opp.accountName && <span>{opp.accountName}</span>}
                              {opp.accountName && opp.ownerName && <span> &middot; </span>}
                              {opp.ownerName && <span>Owner: {opp.ownerName}</span>}
                              {(opp.accountName || opp.ownerName) && opp.stageName && <span> &middot; </span>}
                              {opp.stageName && <span>{opp.stageName}</span>}
                            </p>
                          </button>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                {authData?.user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-600">
                {authData?.user?.email || ''}
              </p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
              {getInitials(authData?.user?.name || 'User')}
            </div>

            {/* User Impersonation Button - Only show for admins */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowUserSelector(!showUserSelector)}
                  className="ml-2 px-4 py-2 text-sm font-medium text-purple-700 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition flex items-center gap-2"
                  title="Impersonate User"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Switch User
                </button>

              {/* User Selector Dropdown */}
              {showUserSelector && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">Select User to Impersonate</h3>
                  </div>
                  <div className="py-2">
                    {!usersData ? (
                      <div className="px-4 py-8 text-center text-gray-500 text-sm">Loading users...</div>
                    ) : usersData.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500 text-sm">No users found</div>
                    ) : (
                      usersData.map((user: any) => (
                        <button
                          key={user.id}
                          onClick={() => handleImpersonate(user.id)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3"
                        >
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                            {getInitials(user.name)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-600">{user.email}</p>
                            {user.profileName && (
                              <p className="text-xs text-gray-500">{user.profileName}</p>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              </div>
            )}

            <button
              onClick={handleLogout}
              className="ml-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
