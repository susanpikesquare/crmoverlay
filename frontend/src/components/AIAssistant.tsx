import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';

interface AIAssistantProps {
  userRole?: string;
  userName?: string;
  compact?: boolean;
}

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIAssistant({ userRole, userName, compact = true }: AIAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);

  // Check AI configuration status
  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: async () => {
      const response = await apiClient.get('/api/ai/status');
      return response.data?.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const isAIConfigured = aiStatus?.isConfigured ?? true; // default true to avoid flash

  const askAIMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiClient.post('/api/ai/ask', { question });
      return response.data.data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          timestamp: new Date(),
        },
      ]);
    },
    onError: (error: any) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: error.response?.data?.error || 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: input,
        timestamp: new Date(),
      },
    ]);

    // Send to AI
    askAIMutation.mutate(input);

    // Clear input
    setInput('');
  };

  const suggestedQuestions = [
    "What should I focus on today?",
    "Which deals need attention?",
    "Show me at-risk accounts",
  ];

  if (!isExpanded) {
    return (
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-md px-4 py-3 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">AI Assistant</h3>
                <span className="text-xs text-white/70 hidden sm:inline">
                  {isAIConfigured ? 'Ask me anything about your work' : 'Not configured \u2014 click to set up'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {suggestedQuestions.slice(0, 2).map((question, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setIsExpanded(true);
                  setInput(question);
                }}
                className="hidden md:block px-3 py-1.5 bg-white/20 text-white text-xs rounded-lg hover:bg-white/30 transition truncate max-w-[150px]"
              >
                {question}
              </button>
            ))}
            <button
              onClick={() => setIsExpanded(true)}
              className="px-4 py-1.5 bg-white text-purple-600 font-medium text-sm rounded-lg hover:bg-white/95 transition shadow-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Ask AI
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-xl px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold">AI Assistant</h3>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="text-white/80 hover:text-white transition p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
        {!isAIConfigured && messages.length === 0 ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium text-sm mb-1">AI Assistant Not Configured</p>
            <p className="text-gray-500 text-xs mb-2">
              {aiStatus?.message || 'No AI provider is set up yet.'}
            </p>
            <p className="text-gray-500 text-xs">
              Go to <strong>Admin &gt; AI Configuration</strong> to add an API key for Anthropic (Claude), OpenAI, or Google Gemini.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm mb-1">
              {aiStatus?.primaryProvider ? `Powered by ${aiStatus.primaryProvider}` : 'Ask me anything about your work!'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {suggestedQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(question)}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs hover:bg-purple-100 transition"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, idx) => (
            <div
              key={idx}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        {askAIMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                <p className="text-xs text-gray-600">Thinking...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={askAIMutation.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || askAIMutation.isPending}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium text-sm rounded-lg hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
