import { useNavigate } from 'react-router-dom';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      title: 'Account 360° View',
      description: 'Get a complete view of your accounts with comprehensive data from your CRM, including account details, opportunities, and custom fields.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      title: 'Opportunity Intelligence',
      description: 'Track opportunities across all stages with detailed insights, real-time updates, and comprehensive opportunity management.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: 'CRM Integration',
      description: 'Seamlessly connect with your existing systems using secure OAuth authentication for real-time data access and synchronization.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      title: 'Multi-Tenant Architecture',
      description: 'Built for scale with secure multi-tenant architecture, allowing multiple organizations to use the platform with complete data isolation.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      title: 'Dashboard Analytics',
      description: 'Powerful dashboard with key metrics, recent activities, and actionable insights to drive your revenue intelligence.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: 'Role-Based Access',
      description: 'Granular access control with role-based permissions for Account Executives, Account Managers, CSMs, and Admins.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
  ];

  const screenshots = [
    {
      title: 'Dashboard Overview',
      description: 'Your revenue intelligence hub with key metrics and recent activity',
      image: '/screenshots/dashboard.png',
    },
    {
      title: 'Account 360° View',
      description: 'Complete account details with opportunities and custom data',
      image: '/screenshots/account360.png',
    },
    {
      title: 'Opportunities List',
      description: 'Track and manage opportunities across all stages',
      image: '/screenshots/opportunities.png',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-2 rounded-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  FormationIQ
                </h1>
                <p className="text-xs text-gray-500">by PikeSquare</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
            >
              Customer Login
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Your Central Work Hub
            <span className="block mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              For Revenue Teams
            </span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            FormationIQ is your single starting point to manage your day. Get intelligent insights,
            prioritize actions, and drive revenue growth—all powered by your existing systems.
            Connect your CRM, get AI-driven recommendations, and focus on what matters most.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl"
            >
              Get Started
            </button>
            <a
              href="#features"
              className="px-8 py-4 bg-white text-purple-600 rounded-lg hover:bg-gray-50 transition-colors font-semibold text-lg border-2 border-purple-600"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white rounded-3xl shadow-xl my-12">
        <div className="text-center mb-16">
          <h3 className="text-4xl font-bold text-gray-900 mb-4">Powerful Features</h3>
          <p className="text-xl text-gray-600">Everything you need for revenue intelligence</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-200">
              <div className="text-purple-600 mb-4">{feature.icon}</div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h4>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h3 className="text-4xl font-bold text-gray-900 mb-4">See It In Action</h3>
          <p className="text-xl text-gray-600">Explore the platform's intuitive interface</p>
        </div>
        <div className="space-y-12">
          {screenshots.map((screenshot, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-8 bg-gradient-to-r from-purple-50 to-indigo-50">
                <h4 className="text-2xl font-bold text-gray-900 mb-2">{screenshot.title}</h4>
                <p className="text-gray-600">{screenshot.description}</p>
              </div>
              <div className="bg-gray-100 p-4">
                <img
                  src={screenshot.image}
                  alt={screenshot.title}
                  className="w-full h-auto rounded-lg shadow-lg"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.className = 'bg-gray-100 p-8 min-h-[400px] flex items-center justify-center';
                      parent.innerHTML = `
                        <div class="text-center">
                          <svg class="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p class="text-gray-400 font-medium">Screenshot: ${screenshot.title}</p>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl shadow-2xl my-12 text-white">
        <div className="text-center mb-16">
          <h3 className="text-4xl font-bold mb-4">How It Works</h3>
          <p className="text-xl text-purple-100">Get started in minutes</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-white/20 backdrop-blur-lg rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold">1</span>
            </div>
            <h4 className="text-xl font-bold mb-2">Connect Your Systems</h4>
            <p className="text-purple-100">Securely authenticate with your CRM and other tools using OAuth</p>
          </div>
          <div className="text-center">
            <div className="bg-white/20 backdrop-blur-lg rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold">2</span>
            </div>
            <h4 className="text-xl font-bold mb-2">Get AI-Powered Insights</h4>
            <p className="text-purple-100">FormationIQ analyzes your data and delivers personalized recommendations</p>
          </div>
          <div className="text-center">
            <div className="bg-white/20 backdrop-blur-lg rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold">3</span>
            </div>
            <h4 className="text-xl font-bold mb-2">Focus on What Matters</h4>
            <p className="text-purple-100">Spend less time searching, more time selling with your centralized work hub</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center">
          <h3 className="text-4xl font-bold text-gray-900 mb-4">Ready to Simplify Your Workday?</h3>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join revenue teams using FormationIQ as their central hub to prioritize actions, get AI recommendations, and close more deals
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl"
          >
            Access Your Account
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold">FormationIQ</h3>
                  <p className="text-sm text-gray-400">by PikeSquare</p>
                </div>
              </div>
              <p className="text-gray-400">Your central hub powered by your systems</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><button onClick={() => navigate('/login')} className="hover:text-white transition-colors">Login</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>PikeSquare</li>
                <li>Revenue Intelligence Platform</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} FormationIQ by PikeSquare. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
