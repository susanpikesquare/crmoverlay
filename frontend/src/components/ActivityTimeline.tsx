import { useState } from 'react';

interface TimelineActivity {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'task' | 'note' | 'stage_change';
  date: string;
  subject: string;
  description: string;
  participants?: string[];
  relatedTo?: string;
  status?: string;
}

interface ActivityTimelineProps {
  activities: TimelineActivity[];
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<string>('all');
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return '✉️';
      case 'call':
        return '📞';
      case 'meeting':
        return '👥';
      case 'task':
        return '✅';
      case 'note':
        return '📝';
      case 'stage_change':
        return '🔄';
      default:
        return '📌';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email':
        return 'bg-green-100';
      case 'call':
        return 'bg-blue-100';
      case 'meeting':
        return 'bg-purple-100';
      case 'task':
        return 'bg-yellow-100';
      case 'note':
        return 'bg-gray-100';
      case 'stage_change':
        return 'bg-indigo-100';
      default:
        return 'bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedActivities(newExpanded);
  };

  const filteredActivities = filter === 'all'
    ? activities
    : activities.filter(a => a.type === filter);

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Activity Timeline</h2>
        <div className="text-center py-8">
          <span className="text-4xl mb-3 block">📅</span>
          <p className="text-gray-600">No activities recorded yet</p>
          <p className="text-sm text-gray-500 mt-1">Activities from Salesforce will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Activity Timeline</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded-lg ${
              filter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('call')}
            className={`px-3 py-1 text-sm rounded-lg ${
              filter === 'call'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Calls
          </button>
          <button
            onClick={() => setFilter('meeting')}
            className={`px-3 py-1 text-sm rounded-lg ${
              filter === 'meeting'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Meetings
          </button>
          <button
            onClick={() => setFilter('email')}
            className={`px-3 py-1 text-sm rounded-lg ${
              filter === 'email'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Emails
          </button>
        </div>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {filteredActivities.map((activity) => {
          const isExpanded = expandedActivities.has(activity.id);
          const hasDetails = activity.description || (activity.participants && activity.participants.length > 0);

          return (
            <div key={activity.id} className="flex gap-4">
              <div className={`flex-shrink-0 w-10 h-10 ${getTypeColor(activity.type)} rounded-full flex items-center justify-center`}>
                <span className="text-lg">{getTypeIcon(activity.type)}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{activity.subject}</p>
                    <p className="text-sm text-gray-600">{formatDate(activity.date)}</p>

                    {activity.status && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        {activity.status}
                      </span>
                    )}

                    {activity.participants && activity.participants.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        With: {activity.participants.join(', ')}
                      </p>
                    )}
                  </div>

                  {hasDetails && (
                    <button
                      onClick={() => toggleExpanded(activity.id)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  )}
                </div>

                {isExpanded && activity.description && (
                  <p className="text-sm text-gray-700 mt-2 pl-4 border-l-2 border-gray-200">
                    {activity.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredActivities.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-600">No {filter} activities found</p>
        </div>
      )}
    </div>
  );
}
