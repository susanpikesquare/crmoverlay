import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config';

interface Customer {
  id: string;
  companyName: string;
  subdomain: string;
  salesforceInstanceUrl: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  isSuspended: boolean;
  suspendedReason: string | null;
  suspendedAt: string | null;
  trialEndsAt: string | null;
  userCount: number;
  createdAt: string;
}

interface Stats {
  customers: {
    total: number;
    active: number;
    suspended: number;
  };
  users: {
    total: number;
    superAdmins: number;
  };
}

export default function SuperAdminDashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateSuperAdminModal, setShowCreateSuperAdminModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch stats
      const statsResponse = await fetch(`${config.apiBaseUrl}/api/superadmin/stats`, {
        credentials: 'include',
      });

      if (!statsResponse.ok) {
        if (statsResponse.status === 403) {
          navigate('/superadmin/login');
          return;
        }
        throw new Error('Failed to fetch stats');
      }

      const statsData = await statsResponse.json();
      setStats(statsData.data);

      // Fetch customers
      const customersResponse = await fetch(`${config.apiBaseUrl}/api/superadmin/customers`, {
        credentials: 'include',
      });

      if (!customersResponse.ok) {
        throw new Error('Failed to fetch customers');
      }

      const customersData = await customersResponse.json();
      setCustomers(customersData.data.customers);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (customerId: string, companyName: string) => {
    const reason = prompt(`Enter reason for suspending ${companyName}:`);
    if (!reason) return;

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/superadmin/customers/${customerId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to suspend customer');
      }

      await fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleUnsuspend = async (customerId: string, companyName: string) => {
    if (!confirm(`Are you sure you want to unsuspend ${companyName}?`)) return;

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/superadmin/customers/${customerId}/unsuspend`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to unsuspend customer');
      }

      await fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleViewDetails = async (customerId: string) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/superadmin/customers/${customerId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customer details');
      }

      const data = await response.json();
      setSelectedCustomer(data.data.customer);
      setShowDetailModal(true);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCreateCustomer = async (customerData: any) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/superadmin/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create customer');
      }

      setShowCreateModal(false);
      await fetchData();
      alert('Customer created successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCreateSuperAdmin = async (userData: any) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/superadmin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create super admin user');
      }

      setShowCreateSuperAdminModal(false);
      await fetchData();
      alert('Super admin user created successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${config.apiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      navigate('/superadmin/login');
    } catch (err) {
      navigate('/superadmin/login');
    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.subdomain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">FormationIQ Super Admin</h1>
              <p className="text-sm text-gray-600">Platform Administration</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateSuperAdminModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Create Super Admin
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600 mb-2">Total Customers</div>
              <div className="text-3xl font-bold text-gray-900">{stats.customers.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600 mb-2">Active Customers</div>
              <div className="text-3xl font-bold text-green-600">{stats.customers.active}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600 mb-2">Suspended</div>
              <div className="text-3xl font-bold text-red-600">{stats.customers.suspended}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600 mb-2">Total Users</div>
              <div className="text-3xl font-bold text-blue-600">{stats.users.total}</div>
            </div>
          </div>
        )}

        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Customers</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Create New Customer
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subdomain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className={customer.isSuspended ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{customer.companyName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{customer.subdomain}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {customer.subscriptionTier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.isSuspended ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Suspended
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {customer.subscriptionStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {customer.userCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {customer.isSuspended ? (
                        <button
                          onClick={() => handleUnsuspend(customer.id, customer.companyName)}
                          className="text-green-600 hover:text-green-900 mr-4"
                        >
                          Unsuspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspend(customer.id, customer.companyName)}
                          className="text-red-600 hover:text-red-900 mr-4"
                        >
                          Suspend
                        </button>
                      )}
                      <button
                        onClick={() => handleViewDetails(customer.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No customers found</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <CreateCustomerModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateCustomer}
        />
      )}

      {/* Customer Detail Modal */}
      {showDetailModal && selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCustomer(null);
          }}
          onRefresh={fetchData}
        />
      )}

      {/* Create Super Admin Modal */}
      {showCreateSuperAdminModal && (
        <CreateSuperAdminModal
          onClose={() => setShowCreateSuperAdminModal(false)}
          onCreate={handleCreateSuperAdmin}
        />
      )}
    </div>
  );
}

// Create Customer Modal Component
function CreateCustomerModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [formData, setFormData] = useState({
    companyName: '',
    subdomain: '',
    salesforceInstanceUrl: '',
    salesforceClientId: '',
    salesforceClientSecret: '',
    subscriptionTier: 'starter',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Create New Customer</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="Acme Corporation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subdomain *
            </label>
            <input
              type="text"
              required
              value={formData.subdomain}
              onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="acme"
            />
            <p className="mt-1 text-sm text-gray-500">Lowercase letters, numbers, and hyphens only</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Salesforce Instance URL *
            </label>
            <input
              type="url"
              required
              value={formData.salesforceInstanceUrl}
              onChange={(e) => setFormData({ ...formData, salesforceInstanceUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="https://yourorg.my.salesforce.com"
            />
            <p className="mt-1 text-sm text-gray-500">The customer's Salesforce org URL</p>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Salesforce Connected App Credentials</h3>
            <p className="text-sm text-gray-600 mb-4">
              The customer must create a Connected App in their Salesforce org and provide these credentials.
              <a
                href="https://help.salesforce.com/s/articleView?id=sf.connected_app_create.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-700 ml-1"
              >
                Learn how →
              </a>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consumer Key (Client ID) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.salesforceClientId}
                  onChange={(e) => setFormData({ ...formData, salesforceClientId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent font-mono text-sm"
                  placeholder="3MVG9..."
                />
                <p className="mt-1 text-sm text-gray-500">From the Connected App in Salesforce</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consumer Secret (Client Secret) *
                </label>
                <input
                  type="password"
                  required
                  value={formData.salesforceClientSecret}
                  onChange={(e) => setFormData({ ...formData, salesforceClientSecret: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent font-mono text-sm"
                  placeholder="Enter consumer secret"
                />
                <p className="mt-1 text-sm text-gray-500">Will be encrypted and stored securely</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subscription Tier *
            </label>
            <select
              value={formData.subscriptionTier}
              onChange={(e) => setFormData({ ...formData, subscriptionTier: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            >
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Customer Detail Modal Component
function CustomerDetailModal({ customer, onClose, onRefresh }: { customer: Customer; onClose: () => void; onRefresh: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [formData, setFormData] = useState({
    companyName: customer.companyName,
    subdomain: customer.subdomain,
    salesforceInstanceUrl: customer.salesforceInstanceUrl || '',
    salesforceClientId: '',
    salesforceClientSecret: '',
    subscriptionTier: customer.subscriptionTier,
    subscriptionStatus: customer.subscriptionStatus,
  });

  const handleConnectSalesforce = () => {
    const authUrl = `${config.apiBaseUrl}/auth/salesforce?customerId=${customer.id}`;
    window.open(authUrl, '_blank', 'width=800,height=600');
  };

  const handleSave = async () => {
    setEditError('');
    setSaving(true);

    try {
      // Only send fields that were actually changed
      const updates: Record<string, string> = {};
      if (formData.companyName !== customer.companyName) updates.companyName = formData.companyName;
      if (formData.subdomain !== customer.subdomain) updates.subdomain = formData.subdomain;
      if (formData.salesforceInstanceUrl !== (customer.salesforceInstanceUrl || '')) updates.salesforceInstanceUrl = formData.salesforceInstanceUrl;
      if (formData.salesforceClientId) updates.salesforceClientId = formData.salesforceClientId;
      if (formData.salesforceClientSecret) updates.salesforceClientSecret = formData.salesforceClientSecret;
      if (formData.subscriptionTier !== customer.subscriptionTier) updates.subscriptionTier = formData.subscriptionTier;
      if (formData.subscriptionStatus !== customer.subscriptionStatus) updates.subscriptionStatus = formData.subscriptionStatus;

      if (Object.keys(updates).length === 0) {
        setIsEditing(false);
        return;
      }

      const response = await fetch(`${config.apiBaseUrl}/api/superadmin/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update customer');
      }

      setIsEditing(false);
      await onRefresh();
    } catch (err: any) {
      setEditError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError('');
    setFormData({
      companyName: customer.companyName,
      subdomain: customer.subdomain,
      salesforceInstanceUrl: customer.salesforceInstanceUrl || '',
      salesforceClientId: '',
      salesforceClientSecret: '',
      subscriptionTier: customer.subscriptionTier,
      subscriptionStatus: customer.subscriptionStatus,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? `Edit: ${customer.companyName}` : customer.companyName}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {editError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{editError}</p>
            </div>
          )}

          {isEditing ? (
            /* ---- Edit Mode ---- */
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subdomain</label>
                  <input
                    type="text"
                    value={formData.subdomain}
                    onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                  <p className="mt-1 text-sm text-gray-500">Lowercase letters, numbers, and hyphens only</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Tier</label>
                  <select
                    value={formData.subscriptionTier}
                    onChange={(e) => setFormData({ ...formData, subscriptionTier: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  >
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Status</label>
                  <select
                    value={formData.subscriptionStatus}
                    onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  >
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="past_due">Past Due</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Salesforce Integration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Instance URL</label>
                    <input
                      type="url"
                      value={formData.salesforceInstanceUrl}
                      onChange={(e) => setFormData({ ...formData, salesforceInstanceUrl: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="https://yourorg.my.salesforce.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Consumer Key (Client ID)</label>
                    <input
                      type="text"
                      value={formData.salesforceClientId}
                      onChange={(e) => setFormData({ ...formData, salesforceClientId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent font-mono text-sm"
                      placeholder="Leave blank to keep current value"
                    />
                    <p className="mt-1 text-sm text-gray-500">Leave blank to keep the existing encrypted value</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Consumer Secret (Client Secret)</label>
                    <input
                      type="password"
                      value={formData.salesforceClientSecret}
                      onChange={(e) => setFormData({ ...formData, salesforceClientSecret: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent font-mono text-sm"
                      placeholder="Leave blank to keep current value"
                    />
                    <p className="mt-1 text-sm text-gray-500">Leave blank to keep the existing encrypted value</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ---- View Mode ---- */
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Company Name</label>
                  <p className="text-lg font-semibold text-gray-900">{customer.companyName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Subdomain</label>
                  <p className="text-lg font-semibold text-gray-900">{customer.subdomain}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Subscription Tier</label>
                  <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                    {customer.subscriptionTier}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    customer.isSuspended ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {customer.isSuspended ? 'Suspended' : customer.subscriptionStatus}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">User Count</label>
                  <p className="text-lg font-semibold text-gray-900">{customer.userCount}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Created</label>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Salesforce Connection */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Salesforce Integration</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Instance URL</label>
                    <p className="text-sm font-mono text-gray-900">{customer.salesforceInstanceUrl || 'Not configured'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Connected App Status</label>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-semibold text-green-800">Credentials Configured</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Consumer Key and Secret are securely stored and encrypted
                    </p>
                  </div>
                  <div className="pt-2">
                    <p className="text-sm text-gray-600 mb-2">
                      Users from this customer can now authenticate with their Salesforce org using OAuth.
                    </p>
                    <button
                      onClick={handleConnectSalesforce}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      Test OAuth Connection
                    </button>
                  </div>
                </div>
              </div>

              {/* Suspension Info */}
              {customer.isSuspended && customer.suspendedReason && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Suspension Details</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700">
                      <span className="font-semibold">Reason:</span> {customer.suspendedReason}
                    </p>
                    {customer.suspendedAt && (
                      <p className="text-sm text-red-700 mt-1">
                        <span className="font-semibold">Suspended on:</span>{' '}
                        {new Date(customer.suspendedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Create Super Admin Modal Component
function CreateSuperAdminModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.firstName) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName) {
      newErrors.lastName = 'Last name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onCreate(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Create Super Admin User</h2>
          <p className="text-sm text-gray-600 mt-1">
            Super admins have full access to manage all customers and platform settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="admin@example.com"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                errors.firstName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="John"
            />
            {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                errors.lastName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Doe"
            />
            {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Minimum 8 characters"
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password *
            </label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Re-enter password"
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-yellow-800">
                Super admins have unrestricted access to all platform features and customer data. Only create super admin accounts for trusted personnel.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Create Super Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
