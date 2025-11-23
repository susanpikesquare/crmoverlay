import React from 'react';

interface CommandOfMessageProps {
  opportunity: {
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
  };
}

export default function CommandOfMessageCard({ opportunity }: CommandOfMessageProps) {
  const commandCriteria = [
    {
      key: 'Command_Why_Do_Anything__c',
      label: 'Why Do Anything?',
      icon: '🎯',
      description: 'Compelling reason for change',
    },
    {
      key: 'Command_Why_Now__c',
      label: 'Why Now?',
      icon: '⏰',
      description: 'Urgency and timing',
    },
    {
      key: 'Command_Why_Us__c',
      label: 'Why Us?',
      icon: '⭐',
      description: 'Competitive differentiation',
    },
    {
      key: 'Command_Why_Trust__c',
      label: 'Why Trust?',
      icon: '🤝',
      description: 'Credibility and proof',
    },
    {
      key: 'Command_Why_Pay_That__c',
      label: 'Why Pay That?',
      icon: '💰',
      description: 'Value justification',
    },
  ];

  // Calculate individual criterion scores from the text fields
  // In real implementation, these would be numeric fields or parsed from the text
  const parseScore = (text?: string): number => {
    if (!text) return 0;
    // Check if text contains score indicator, otherwise estimate based on length/content
    const scoreMatch = text.match(/\[(\d+)%\]/);
    if (scoreMatch) {
      return parseInt(scoreMatch[1]);
    }
    // Simple heuristic: longer = better documented = higher score
    if (text.length > 200) return 85;
    if (text.length > 100) return 70;
    if (text.length > 50) return 55;
    return 30;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-50 border-green-200';
    if (score >= 70) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 90) return 'text-green-800';
    if (score >= 70) return 'text-yellow-800';
    return 'text-red-800';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const overallScore = opportunity.Command_Overall_Score__c || 0;
  const isStale = opportunity.Command_Last_Updated__c
    ? (new Date().getTime() - new Date(opportunity.Command_Last_Updated__c).getTime()) / (1000 * 60 * 60 * 24) > 14
    : true;

  // Check if any Command data exists
  const hasCommandData = commandCriteria.some(
    criterion => opportunity[criterion.key as keyof typeof opportunity]
  );

  if (!hasCommandData) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Command of the Message</h2>
          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
            No Data
          </span>
        </div>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-gray-600 mb-2">No Command of the Message data available</p>
          <p className="text-sm text-gray-500">
            Command data will be populated from Gong call transcripts via Scratchpad
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Command of the Message</h2>
          <p className="text-sm text-gray-600 mt-1">From Gong call analysis via Scratchpad</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Overall Score</p>
          <p
            className={`text-3xl font-bold ${
              overallScore >= 90
                ? 'text-green-600'
                : overallScore >= 70
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {overallScore}%
          </p>
        </div>
      </div>

      {/* Warning Banners */}
      {overallScore < 70 && (
        <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-800">
            <span className="font-semibold">⚠️ At Risk:</span> Command score below 70%. Focus on strengthening weak areas with targeted discovery questions.
          </p>
        </div>
      )}

      {isStale && (
        <div className="mb-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <p className="text-sm text-orange-800">
            <span className="font-semibold">⏰ Stale Data:</span> Command data hasn't been updated in over 14 days. Schedule a discovery call to refresh.
          </p>
        </div>
      )}

      {/* Command Criteria Cards */}
      <div className="space-y-3 mb-6">
        {commandCriteria.map((criterion) => {
          const text = opportunity[criterion.key as keyof typeof opportunity] as string;
          const score = parseScore(text);
          const isWeak = score < 60;

          return (
            <div
              key={criterion.key}
              className={`p-4 rounded-lg border ${getScoreBgColor(score)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">{criterion.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{criterion.label}</h3>
                      {isWeak && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                          ⚠️ Weak
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{criterion.description}</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <span className={`text-lg font-bold ${getScoreTextColor(score)}`}>
                    {score}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full ${getScoreColor(score)}`}
                  style={{ width: `${score}%` }}
                ></div>
              </div>

              {/* Command Text */}
              {text && (
                <div className="mt-2">
                  <p className="text-sm text-gray-700 line-clamp-2">{text}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Metadata Footer */}
      <div className="pt-4 border-t border-gray-200 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-gray-600">Last Updated:</span>
            <span className={`ml-1 font-medium ${isStale ? 'text-orange-600' : 'text-gray-900'}`}>
              {formatDate(opportunity.Command_Last_Updated__c)}
            </span>
          </div>
          {opportunity.Command_Confidence_Level__c && (
            <div>
              <span className="text-gray-600">Confidence:</span>
              <span className="ml-1 font-medium text-gray-900">
                {opportunity.Command_Confidence_Level__c}
              </span>
            </div>
          )}
        </div>
        {opportunity.Gong_Call_Recording_URL__c && (
          <a
            href={opportunity.Gong_Call_Recording_URL__c}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            View Gong Recording
          </a>
        )}
      </div>

      {/* Gong Call Insights */}
      {(opportunity.Gong_Call_Count__c || opportunity.Gong_Sentiment__c || opportunity.Gong_Competitor_Mentions__c) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Gong Call Insights</h3>
          <div className="grid grid-cols-3 gap-4">
            {opportunity.Gong_Call_Count__c !== undefined && (
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{opportunity.Gong_Call_Count__c}</p>
                <p className="text-xs text-gray-600 mt-1">Total Calls</p>
              </div>
            )}
            {opportunity.Gong_Sentiment__c && (
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{opportunity.Gong_Sentiment__c}</p>
                <p className="text-xs text-gray-600 mt-1">Sentiment</p>
              </div>
            )}
            {opportunity.Gong_Last_Call_Date__c && (
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-bold text-gray-900">
                  {formatDate(opportunity.Gong_Last_Call_Date__c)}
                </p>
                <p className="text-xs text-gray-600 mt-1">Last Call</p>
              </div>
            )}
          </div>
          {opportunity.Gong_Competitor_Mentions__c && (
            <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-xs font-medium text-gray-700 mb-1">Competitor Mentions:</p>
              <p className="text-sm text-gray-900">{opportunity.Gong_Competitor_Mentions__c}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
