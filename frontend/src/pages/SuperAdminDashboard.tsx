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
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Logout
            </button>
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
    </div>
  );
}

// Create Customer Modal Component
function CreateCustomerModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [formData, setFormData] = useState({
    companyName: '',
    subdomain: '',
    salesforceInstanceUrl: '',
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
              Salesforce Instance URL
            </label>
            <input
              type="url"
              value={formData.salesforceInstanceUrl}
              onChange={(e) => setFormData({ ...formData, salesforceInstanceUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="https://yourorg.my.salesforce.com"
            />
            <p className="mt-1 text-sm text-gray-500">Customer can connect this later via OAuth</p>
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
  const handleConnectSalesforce = () => {
    // Initiate Salesforce OAuth flow for this customer
    const authUrl = `${config.apiBaseUrl}/auth/salesforce?customerId=${customer.id}`;
    window.open(authUrl, '_blank', 'width=800,height=600');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">{customer.companyName}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Information */}
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
            {customer.salesforceInstanceUrl ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold text-green-800">Connected</span>
                </div>
                <p className="text-sm text-green-700">
                  Instance: <span className="font-mono">{customer.salesforceInstanceUrl}</span>
                </p>
                <button
                  onClick={handleConnectSalesforce}
                  className="mt-3 text-sm text-green-700 hover:text-green-900 font-medium"
                >
                  Reconnect Salesforce
                </button>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold text-yellow-800">Not Connected</span>
                </div>
                <p className="text-sm text-yellow-700 mb-3">
                  This customer needs to connect their Salesforce environment
                </p>
                <button
                  onClick={handleConnectSalesforce}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  Connect Salesforce
                </button>
              </div>
            )}
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
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
