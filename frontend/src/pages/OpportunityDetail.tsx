import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../services/api';
import CommandOfMessageCard from '../components/CommandOfMessageCard';
import ActivityTimeline from '../components/ActivityTimeline';
import AIDealSummary from '../components/AIDealSummary';
import AIAssistant from '../components/AIAssistant';
import GongCallInsights from '../components/GongCallInsights';
import GongAISearch from '../components/GongAISearch';

interface DetailField {
  label: string;
  salesforceField: string;
  fieldType: 'score' | 'text' | 'currency' | 'date' | 'percent' | 'url';
  showProgressBar?: boolean;
}

interface DetailSection {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  fields: DetailField[];
}

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: opportunity, isLoading } = useQuery({
    queryKey: ['opportunity', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/opportunities/${id}`);
      return response.data.data as Record<string, any>;
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

  const { data: configData } = useQuery({
    queryKey: ['adminConfig'],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/config');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: timelineData } = useQuery({
    queryKey: ['opportunity-timeline', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/opportunities/${id}/timeline`);
      return response.data.data;
    },
    enabled: !!id,
  });

  const { data: aiSummary, isLoading: aiLoading } = useQuery({
    queryKey: ['opportunity-ai-summary', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/opportunities/${id}/ai-summary`);
      return response.data.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const detailSections: DetailSection[] = configData?.opportunityDetailConfig?.sections || [];

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
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStageColor = (stage: string) => {
    const s = stage?.toLowerCase() || '';
    if (s.includes('closed won') || s.includes('won')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (s.includes('closed lost') || s.includes('lost') || s.includes('abandoned')) return 'bg-red-100 text-red-800 border-red-300';
    if (s.includes('negotiation') || s.includes('stage a')) return 'bg-green-100 text-green-800 border-green-300';
    if (s.includes('discovery') || s.includes('stage f')) return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  /** Render a single field value based on its type */
  const renderFieldValue = (field: DetailField, value: any) => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-gray-400 italic">No data</span>;
    }

    switch (field.fieldType) {
      case 'score': {
        const numVal = typeof value === 'number' ? value : parseFloat(value) || 0;
        return (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900">{field.label}</span>
              <span className={`text-sm font-semibold ${getScoreTextColor(numVal)}`}>{numVal}%</span>
            </div>
            {field.showProgressBar !== false && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getScoreColor(numVal)}`}
                  style={{ width: `${Math.min(numVal, 100)}%` }}
                />
              </div>
            )}
          </div>
        );
      }
      case 'currency':
        return <p className="text-gray-900 mt-1 font-semibold">{formatCurrency(Number(value))}</p>;
      case 'date':
        return <p className="text-gray-900 mt-1">{formatDate(String(value))}</p>;
      case 'percent':
        return <p className="text-gray-900 mt-1">{value}%</p>;
      case 'url':
        return (
          <a
            href={String(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 mt-1 inline-block"
          >
            {String(value).length > 60 ? String(value).slice(0, 60) + '...' : String(value)}
          </a>
        );
      case 'text':
      default:
        return <p className="text-gray-900 mt-1 whitespace-pre-wrap">{String(value)}</p>;
    }
  };

  /** Render a section with score-type fields (e.g., MEDDPICC) */
  const renderScoreSection = (section: DetailSection, opp: Record<string, any>) => {
    // Calculate overall score from individual scores
    const scores = section.fields
      .map(f => ({ field: f, value: opp[f.salesforceField] }))
      .filter(s => typeof s.value === 'number');
    const overallScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.value, 0) / scores.length)
      : null;

    // Also check for an explicit overall score field
    const overallScoreField = opp.MEDDPICC_Overall_Score__c;
    const displayScore = overallScoreField ?? overallScore;

    const hasData = section.fields.some(f => opp[f.salesforceField] !== undefined && opp[f.salesforceField] !== null);

    if (!hasData) {
      return (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{section.label}</h2>
            <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">No Data</span>
          </div>
          <p className="text-gray-500 text-center py-4">No data available for this section</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{section.label}</h2>
          {displayScore !== null && displayScore !== undefined && (
            <div className="text-right">
              <p className="text-sm text-gray-600">Overall Score</p>
              <p className={`text-3xl font-bold ${getScoreTextColor(displayScore)}`}>{displayScore}%</p>
            </div>
          )}
        </div>
        <div className="space-y-4">
          {section.fields.map((field) => {
            const value = opp[field.salesforceField];
            return (
              <div key={field.salesforceField}>
                {renderFieldValue(field, value)}
              </div>
            );
          })}
        </div>
        {displayScore !== null && displayScore !== undefined && displayScore < 60 && (
          <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Action Required:</span> {section.label} score is below 60%. Focus on improving weak areas.
            </p>
          </div>
        )}
      </div>
    );
  };

  /** Render a section with text-type fields (e.g., Details, Competitive) */
  const renderTextSection = (section: DetailSection, opp: Record<string, any>) => {
    const hasData = section.fields.some(f => {
      const v = opp[f.salesforceField];
      return v !== undefined && v !== null && v !== '';
    });

    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{section.label}</h2>
        {section.fields.length === 0 || !hasData ? (
          <p className="text-gray-500 text-center py-4">No data available</p>
        ) : (
          <div className="space-y-4">
            {section.fields.map((field) => {
              const value = opp[field.salesforceField];
              if (field.fieldType === 'score') {
                return (
                  <div key={field.salesforceField}>
                    {renderFieldValue(field, value)}
                  </div>
                );
              }
              return (
                <div key={field.salesforceField}>
                  <label className="text-sm font-medium text-gray-600">{field.label}</label>
                  {renderFieldValue(field, value)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /** Render a config-driven section */
  const renderSection = (section: DetailSection, opp: Record<string, any>) => {
    if (!section.enabled) return null;

    // Determine rendering style based on field types
    const allScores = section.fields.length > 0 && section.fields.every(f => f.fieldType === 'score');

    if (allScores) {
      return renderScoreSection(section, opp);
    }

    // Special case: "command" section — use existing CommandOfMessageCard if fields match
    if (section.id === 'command') {
      // Build the field key map for CommandOfMessageCard
      const commandFields = section.fields.map(f => ({
        key: f.salesforceField,
        label: f.label,
      }));
      return <CommandOfMessageCard opportunity={opp} configuredFields={commandFields} />;
    }

    return renderTextSection(section, opp);
  };

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
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Sort sections by order, filter enabled
  const enabledSections = [...detailSections]
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  // Separate command section (rendered full-width above others)
  const commandSection = enabledSections.find(s => s.id === 'command');
  const otherSections = enabledSections.filter(s => s.id !== 'command');

  // Split into pairs for 2-column layout
  const sectionPairs: DetailSection[][] = [];
  for (let i = 0; i < otherSections.length; i += 2) {
    sectionPairs.push(otherSections.slice(i, i + 2));
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        {/* Back Button */}
        <Link
          to="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <span className="mr-2">&larr;</span> Back to Dashboard
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
                    At Risk
                  </span>
                )}
              </div>
              <Link
                to={`/account/${opportunity.AccountId}`}
                className="text-blue-600 hover:text-blue-800 text-lg font-medium mb-4 block"
              >
                {opportunity.Account?.Name}
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
                      (opportunity.DaysInStage__c || 0) > 14 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {opportunity.DaysInStage__c ?? 'N/A'}
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
          {/* Command of the Message - Full Width (if configured) */}
          {commandSection && renderSection(commandSection, opportunity)}

          {/* AI Deal Summary - Full Width */}
          <AIDealSummary summary={aiSummary} isLoading={aiLoading} />

          {/* Owner & Dates - Always shown */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Owner & Dates</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-600">Owner</label>
                <p className="text-gray-900 mt-1">{opportunity.Owner?.Name}</p>
                {opportunity.Owner?.Email && (
                  <p className="text-sm text-gray-600">{opportunity.Owner.Email}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Created</label>
                <p className="text-gray-900 mt-1">{formatDate(opportunity.CreatedDate)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Last Modified</label>
                <p className="text-gray-900 mt-1">{formatDate(opportunity.LastModifiedDate)}</p>
              </div>
            </div>
          </div>

          {/* Config-driven sections in 2-column layout */}
          {sectionPairs.map((pair, pIdx) => (
            <div key={pIdx} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {pair.map((section) => (
                <div key={section.id}>
                  {renderSection(section, opportunity)}
                </div>
              ))}
            </div>
          ))}

          {/* Gong Call Insights */}
          <GongCallInsights opportunityId={opportunity.Id} accountId={opportunity.AccountId} />

          {/* Gong AI Search */}
          <GongAISearch
            scope="opportunity"
            opportunityId={opportunity.Id}
            opportunityName={opportunity.Name}
            accountId={opportunity.AccountId}
            accountName={opportunity.Account?.Name}
          />

          {/* Activity Timeline */}
          <ActivityTimeline activities={timelineData || []} />

          {/* AI Assistant */}
          <div className="mt-6">
            <AIAssistant />
          </div>
        </div>
      </div>
    </div>
  );
}
