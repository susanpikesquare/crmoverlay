import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../services/api';
import CommandOfMessageCard from '../components/CommandOfMessageCard';

interface Opportunity {
  Id: string;
  Name: string;
  AccountId: string;
  Account: { Name: string };
  StageName: string;
  Amount: number;
  Probability: number;
  CloseDate: string;
  Owner: {
    Name: string;
    Email: string;
  };
  CreatedDate: string;
  LastModifiedDate: string;
  DaysInStage__c: number;
  IsAtRisk__c: boolean;
  MEDDPICC_Metrics__c: number;
  MEDDPICC_Economic_Buyer__c: number;
  MEDDPICC_Decision_Criteria__c: number;
  MEDDPICC_Decision_Process__c: number;
  MEDDPICC_Paper_Process__c: number;
  MEDDPICC_Identify_Pain__c: number;
  MEDDPICC_Champion__c: number;
  MEDDPICC_Competition__c: number;
  MEDDPICC_Overall_Score__c: number;
  NextStep: string;
  Description: string;
  Command_Why_Do_Anything__c?: string;
  Command_Why_Now__c?: string;
  Command_Why_Us__c?: string;
  Command_Why_Trust__c?: string;
  Command_Why_Pay_That__c?: string;
  Command_Overall_Score__c?: number;
  Command_Last_Updated__c?: string;
  Command_Confidence_Level__c?: string;
  Gong_Call_Count__c?: number;
  Gong_Last_Call_Date__c?: string;
  Gong_Sentiment__c?: string;
  Gong_Competitor_Mentions__c?: string;
  Gong_Call_Recording_URL__c?: string;
}

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: opportunity, isLoading } = useQuery({
    queryKey: ['opportunity', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/opportunities/${id}`);
      return response.data.data as Opportunity;
    },
    enabled: !!id,
  });

  const { data: authData } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/user');
      return response.data.data;
    },
  });

  const handleViewInSalesforce = () => {
    if (authData?.instanceUrl && opportunity?.Id) {
      window.open(`${authData.instanceUrl}/${opportunity.Id}`, '_blank');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Discovery':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Value Confirmation':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Negotiation':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getMEDDPICCItemColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const meddpiccItems = [
    { label: 'Metrics', key: 'MEDDPICC_Metrics__c', icon: '📊' },
    { label: 'Economic Buyer', key: 'MEDDPICC_Economic_Buyer__c', icon: '💰' },
    { label: 'Decision Criteria', key: 'MEDDPICC_Decision_Criteria__c', icon: '📋' },
    { label: 'Decision Process', key: 'MEDDPICC_Decision_Process__c', icon: '🔄' },
    { label: 'Paper Process', key: 'MEDDPICC_Paper_Process__c', icon: '📄' },
    { label: 'Identify Pain', key: 'MEDDPICC_Identify_Pain__c', icon: '🎯' },
    { label: 'Champion', key: 'MEDDPICC_Champion__c', icon: '👤' },
    { label: 'Competition', key: 'MEDDPICC_Competition__c', icon: '🏆' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded-xl mb-8"></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 rounded-xl"></div>
              <div className="h-64 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Opportunity Not Found</h2>
          <p className="text-gray-600 mb-6">
            The opportunity you're looking for doesn't exist.
          </p>
          <Link
            to="/dashboard"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        {/* Back Button */}
        <Link
          to="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <span className="mr-2">←</span> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <h1 className="text-3xl font-bold text-gray-900">{opportunity.Name}</h1>
                <span
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${getStageColor(
                    opportunity.StageName
                  )}`}
                >
                  {opportunity.StageName}
                </span>
                {opportunity.IsAtRisk__c && (
                  <span className="px-4 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-800 border border-red-300">
                    ⚠️ At Risk
                  </span>
                )}
              </div>
              <Link
                to={`/account/${opportunity.AccountId}`}
                className="text-blue-600 hover:text-blue-800 text-lg font-medium mb-4 block"
              >
                {opportunity.Account.Name}
              </Link>
              <div className="grid grid-cols-4 gap-6 mt-6">
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(opportunity.Amount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Close Date</p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">
                    {formatDate(opportunity.CloseDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Probability</p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">
                    {opportunity.Probability}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Days in Stage</p>
                  <p
                    className={`text-xl font-semibold mt-1 ${
                      opportunity.DaysInStage__c > 14 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {opportunity.DaysInStage__c}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
              <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition shadow-md">
                Update Stage
              </button>
              <button className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-gray-400 transition">
                Log Call
              </button>
              <button
                onClick={handleViewInSalesforce}
                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-blue-600 hover:text-blue-600 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                View in Salesforce
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-8">
          {/* Command of the Message - Full Width */}
          <CommandOfMessageCard opportunity={opportunity} />

          {/* Two Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* MEDDPICC Scoring */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">MEDDPICC Qualification</h2>
              <div className="text-right">
                <p className="text-sm text-gray-600">Overall Score</p>
                <p
                  className={`text-3xl font-bold ${
                    opportunity.MEDDPICC_Overall_Score__c >= 80
                      ? 'text-green-600'
                      : opportunity.MEDDPICC_Overall_Score__c >= 60
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
                  {opportunity.MEDDPICC_Overall_Score__c}%
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {meddpiccItems.map((item) => {
                const score = opportunity[item.key as keyof Opportunity] as number;
                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span>{item.icon}</span>
                        <span className="font-medium text-gray-900">{item.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{score}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getMEDDPICCItemColor(score)}`}
                        style={{ width: `${score}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {opportunity.MEDDPICC_Overall_Score__c < 60 && (
              <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800">
                  <span className="font-semibold">⚠️ Action Required:</span> MEDDPICC score is
                  below 60%. Focus on improving weak areas to increase win probability.
                </p>
              </div>
            )}
              </div>
            </div>

          {/* Opportunity Details */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Details</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Owner</label>
                <p className="text-gray-900 mt-1">{opportunity.Owner.Name}</p>
                <p className="text-sm text-gray-600">{opportunity.Owner.Email}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Description</label>
                <p className="text-gray-900 mt-1">{opportunity.Description}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Next Step</label>
                <p className="text-gray-900 mt-1">{opportunity.NextStep}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="text-sm font-medium text-gray-600">Created</label>
                  <p className="text-gray-900 mt-1">{formatDate(opportunity.CreatedDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Modified</label>
                  <p className="text-gray-900 mt-1">
                    {formatDate(opportunity.LastModifiedDate)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Competitive Encounters */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Competitive Encounters</h2>

            <div className="space-y-3">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">Cornerstone OnDemand</h3>
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                    Primary
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  Incumbent solution. Position on modern UI and better mobile experience.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">SAP SuccessFactors</h3>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                    Secondary
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  Being evaluated. Differentiate on ease of use and faster implementation.
                </p>
              </div>
            </div>

            <button className="mt-4 w-full px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:border-gray-400 transition">
              Add Competitor
            </button>
          </div>

          {/* Timeline & Activity */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h2>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">📞</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Discovery call completed</p>
                  <p className="text-sm text-gray-600">2 days ago</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Discussed technical requirements and integration needs with IT Director.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">✉️</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Proposal sent</p>
                  <p className="text-sm text-gray-600">5 days ago</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Sent detailed proposal with ROI analysis and implementation timeline.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">👥</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Demo conducted</p>
                  <p className="text-sm text-gray-600">1 week ago</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Executive demo with VP of Learning and HR Director. Positive feedback.
                  </p>
                </div>
              </div>
            </div>

            <button className="mt-6 w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition">
              Log New Activity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
