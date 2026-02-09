import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';

interface GongCall {
  id: string;
  title: string;
  started: string;
  duration: number;
  direction: string;
  parties: Array<{
    name?: string;
    emailAddress?: string;
    affiliation?: string;
  }>;
  url?: string;
  topics?: string[];
  sentiment?: string;
}

interface Props {
  opportunityId?: string;
  accountId?: string;
}

export default function GongCallInsights({ opportunityId, accountId }: Props) {
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  const queryParams = opportunityId
    ? `opportunityId=${opportunityId}`
    : accountId
    ? `accountId=${accountId}`
    : '';

  const { data: callsData, isLoading } = useQuery({
    queryKey: ['gong-calls', opportunityId, accountId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/gong/calls?${queryParams}`);
      return response.data;
    },
    enabled: !!(opportunityId || accountId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: transcriptData, isLoading: transcriptLoading } = useQuery({
    queryKey: ['gong-transcript', expandedCall],
    queryFn: async () => {
      const response = await apiClient.get(`/api/gong/transcript/${expandedCall}`);
      return response.data.data;
    },
    enabled: !!expandedCall,
    staleTime: 10 * 60 * 1000,
  });

  const calls: GongCall[] = callsData?.data || [];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}m`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Don't render if Gong is not configured (empty response with message)
  if (!isLoading && callsData?.message === 'Gong integration not configured') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Gong Call Insights</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Gong Call Insights</h2>
          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
            No Calls
          </span>
        </div>
        <p className="text-gray-500 text-center py-4">
          No Gong calls found for this {opportunityId ? 'opportunity' : 'account'}.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gong Call Insights</h2>
          <p className="text-sm text-gray-600 mt-1">{calls.length} call{calls.length !== 1 ? 's' : ''} found</p>
        </div>
      </div>

      {/* Call Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-700">{calls.length}</p>
          <p className="text-xs text-gray-600">Total Calls</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-700">
            {formatDuration(calls.reduce((sum, c) => sum + c.duration, 0))}
          </p>
          <p className="text-xs text-gray-600">Total Duration</p>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <p className="text-sm font-bold text-purple-700">
            {formatDate(calls[0]?.started)}
          </p>
          <p className="text-xs text-gray-600">Most Recent</p>
        </div>
      </div>

      {/* Call List */}
      <div className="space-y-3">
        {calls.map((call) => {
          const isExpanded = expandedCall === call.id;
          const externalParties = call.parties.filter(p => p.affiliation === 'External');
          const internalParties = call.parties.filter(p => p.affiliation === 'Internal');

          return (
            <div key={call.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Call Header */}
              <button
                onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{call.title}</span>
                      {call.sentiment && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          call.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                          call.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {call.sentiment}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>{formatDate(call.started)}</span>
                      <span>{formatDuration(call.duration)}</span>
                      {externalParties.length > 0 && (
                        <span>{externalParties.length} external</span>
                      )}
                    </div>
                    {call.topics && call.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {call.topics.slice(0, 5).map((topic, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {call.url && (
                      <a
                        href={call.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open in Gong
                      </a>
                    )}
                    <span className="text-gray-400">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {/* Participants */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Participants</h4>
                    <div className="flex flex-wrap gap-2">
                      {call.parties.map((party, i) => (
                        <span
                          key={i}
                          className={`px-2 py-1 text-xs rounded ${
                            party.affiliation === 'External'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {party.name || party.emailAddress || 'Unknown'}
                          {party.affiliation && ` (${party.affiliation})`}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Transcript Preview */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Transcript</h4>
                    {transcriptLoading ? (
                      <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ) : transcriptData?.transcript && transcriptData.transcript.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto space-y-2 text-sm">
                        {transcriptData.transcript.slice(0, 10).map((segment: any, i: number) => (
                          <div key={i} className="pl-3 border-l-2 border-gray-300">
                            {segment.topic && (
                              <span className="text-xs font-medium text-blue-600 block mb-0.5">
                                {segment.topic}
                              </span>
                            )}
                            {segment.sentences?.slice(0, 3).map((sentence: any, j: number) => (
                              <p key={j} className="text-gray-700">{sentence.text}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Click to load transcript</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
