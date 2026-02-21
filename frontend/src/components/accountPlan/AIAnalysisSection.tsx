import AutoSaveTextarea from './AutoSaveTextarea';

export interface AIAnalysisData {
  whyStayEconomicBuyer: string;
  whyStayAdmin: string;
  whyStayProcurement: string;
  whyStayUsers: string;
  whyStayRisks: string;
  pipelineGap: string;
  nextAction: string;
  keyDecisionMakers: string;
  renewalConfidence: string;
  renewalStrategy: string;
  competitiveMentions: string;
  gongSentiment: string;
  whitespaceOpportunities: string;
  whitespaceStrategy: string;
  stakeholderIntelligence: string;
  techStack: string;
  keyThemes: string;
  accountHistory: string;
  resourceNeeds: string;
  generatedAt: string;
  gongCallCount: number;
  gongDateRange: { from: string; to: string } | null;
}

interface AIAnalysisSectionProps {
  aiAnalysis: AIAnalysisData | null;
  onFieldChange: (key: string, value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isAutoGenerating?: boolean;
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const level = confidence?.toLowerCase() || '';
  let color = 'bg-gray-100 text-gray-700';
  if (level.startsWith('high')) color = 'bg-green-100 text-green-700';
  else if (level.startsWith('medium')) color = 'bg-yellow-100 text-yellow-700';
  else if (level.startsWith('low')) color = 'bg-red-100 text-red-700';

  return (
    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${color}`}>
      {confidence || 'Not assessed'}
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const s = sentiment?.toLowerCase() || '';
  let color = 'bg-gray-100 text-gray-700';
  if (s.startsWith('positive')) color = 'bg-green-100 text-green-700';
  else if (s.startsWith('negative')) color = 'bg-red-100 text-red-700';
  else if (s.startsWith('neutral')) color = 'bg-blue-100 text-blue-700';

  return (
    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${color}`}>
      {sentiment || 'Unknown'}
    </span>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-bold text-gray-800 mb-3">{title}</h4>
      {children}
    </div>
  );
}

export default function AIAnalysisSection({
  aiAnalysis,
  onFieldChange,
  onGenerate,
  isGenerating,
  saveStatus,
  isAutoGenerating,
}: AIAnalysisSectionProps) {
  // Empty state
  if (!aiAnalysis) {
    const generating = isGenerating || isAutoGenerating;
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            {generating ? (
              <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">AI Strategic Analysis</h3>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            {generating
              ? 'Analyzing Salesforce data and Gong call intelligence... This may take 30-60 seconds.'
              : 'Generate AI-powered insights from your Salesforce data and Gong call intelligence. This will analyze renewal risk, stakeholder sentiment, whitespace opportunities, and more.'
            }
          </p>
          {!generating && (
            <button
              onClick={onGenerate}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition shadow-md inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate AI Analysis
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">AI Strategic Analysis</h2>
          {aiAnalysis.generatedAt && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Generated {new Date(aiAnalysis.generatedAt).toLocaleString()}
            </span>
          )}
          {aiAnalysis.gongCallCount > 0 && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
              {aiAnalysis.gongCallCount} Gong calls analyzed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${
            saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' :
            saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
            saveStatus === 'error' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {saveStatus === 'saving' ? 'Saving...' :
             saveStatus === 'saved' ? 'Saved' :
             saveStatus === 'error' ? 'Error saving' : ''}
          </span>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition disabled:opacity-50 inline-flex items-center gap-1"
          >
            {isGenerating ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Regenerating...
              </>
            ) : 'Regenerate'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Key Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Renewal Confidence</div>
            <ConfidenceBadge confidence={aiAnalysis.renewalConfidence} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Gong Sentiment</div>
            <SentimentBadge sentiment={aiAnalysis.gongSentiment} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Next Action</div>
            <p className="text-sm font-medium text-gray-900">{aiAnalysis.nextAction || '—'}</p>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Pipeline Gap</div>
            <p className="text-sm font-medium text-gray-900">{aiAnalysis.pipelineGap || '—'}</p>
          </div>
        </div>

        {/* Why Stay Personas */}
        <SubSection title="Why Stay — Stakeholder Perspectives">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AutoSaveTextarea
              label="Economic Buyer"
              fieldName="whyStayEconomicBuyer"
              value={aiAnalysis.whyStayEconomicBuyer || ''}
              placeholder="Why the economic buyer should renew..."
              onChange={onFieldChange}
              rows={3}
            />
            <AutoSaveTextarea
              label="Admin / Power Users"
              fieldName="whyStayAdmin"
              value={aiAnalysis.whyStayAdmin || ''}
              placeholder="Why admins value the platform..."
              onChange={onFieldChange}
              rows={3}
            />
            <AutoSaveTextarea
              label="Procurement"
              fieldName="whyStayProcurement"
              value={aiAnalysis.whyStayProcurement || ''}
              placeholder="Value proposition for procurement..."
              onChange={onFieldChange}
              rows={3}
            />
            <AutoSaveTextarea
              label="End Users"
              fieldName="whyStayUsers"
              value={aiAnalysis.whyStayUsers || ''}
              placeholder="What end users get..."
              onChange={onFieldChange}
              rows={3}
            />
          </div>
          <div className="mt-4">
            <AutoSaveTextarea
              label="Retention Risks"
              fieldName="whyStayRisks"
              value={aiAnalysis.whyStayRisks || ''}
              placeholder="Key risks to retention..."
              onChange={onFieldChange}
              rows={3}
            />
          </div>
        </SubSection>

        {/* Renewal & Strategy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SubSection title="Renewal Strategy">
            <AutoSaveTextarea
              label="Confidence & Reasoning"
              fieldName="renewalConfidence"
              value={aiAnalysis.renewalConfidence || ''}
              placeholder="Renewal confidence assessment..."
              onChange={onFieldChange}
              rows={3}
            />
            <div className="mt-3">
              <AutoSaveTextarea
                label="Recommended Approach"
                fieldName="renewalStrategy"
                value={aiAnalysis.renewalStrategy || ''}
                placeholder="Renewal strategy..."
                onChange={onFieldChange}
                rows={3}
              />
            </div>
          </SubSection>

          <SubSection title="Competitive Intelligence">
            <AutoSaveTextarea
              label="Competitor Mentions"
              fieldName="competitiveMentions"
              value={aiAnalysis.competitiveMentions || ''}
              placeholder="Competitors mentioned in calls or data..."
              onChange={onFieldChange}
              rows={3}
            />
            <div className="mt-3">
              <AutoSaveTextarea
                label="Gong Sentiment Details"
                fieldName="gongSentiment"
                value={aiAnalysis.gongSentiment || ''}
                placeholder="Overall sentiment from calls..."
                onChange={onFieldChange}
                rows={3}
              />
            </div>
          </SubSection>
        </div>

        {/* Whitespace */}
        <SubSection title="Whitespace & Growth">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AutoSaveTextarea
              label="Opportunities"
              fieldName="whitespaceOpportunities"
              value={aiAnalysis.whitespaceOpportunities || ''}
              placeholder="Expansion/upsell opportunities..."
              onChange={onFieldChange}
              rows={3}
            />
            <AutoSaveTextarea
              label="Approach Strategy"
              fieldName="whitespaceStrategy"
              value={aiAnalysis.whitespaceStrategy || ''}
              placeholder="How to approach these opportunities..."
              onChange={onFieldChange}
              rows={3}
            />
          </div>
        </SubSection>

        {/* Intelligence & Context */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SubSection title="Stakeholder Intelligence">
            <AutoSaveTextarea
              label="Key Insights"
              fieldName="stakeholderIntelligence"
              value={aiAnalysis.stakeholderIntelligence || ''}
              placeholder="Stakeholder dynamics and relationships..."
              onChange={onFieldChange}
              rows={4}
            />
          </SubSection>

          <SubSection title="Key Decision Makers">
            <AutoSaveTextarea
              label="Decision Makers & Stance"
              fieldName="keyDecisionMakers"
              value={aiAnalysis.keyDecisionMakers || ''}
              placeholder="Key decision makers and their sentiment..."
              onChange={onFieldChange}
              rows={4}
            />
          </SubSection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SubSection title="Tech Stack & Integrations">
            <AutoSaveTextarea
              label="Known Technology"
              fieldName="techStack"
              value={aiAnalysis.techStack || ''}
              placeholder="Tech stack and integration points..."
              onChange={onFieldChange}
              rows={3}
            />
          </SubSection>

          <SubSection title="Key Themes">
            <AutoSaveTextarea
              label="Top Themes from Calls & Data"
              fieldName="keyThemes"
              value={aiAnalysis.keyThemes || ''}
              placeholder="Top themes from account activity..."
              onChange={onFieldChange}
              rows={3}
            />
          </SubSection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SubSection title="Account History">
            <AutoSaveTextarea
              label="Account Journey"
              fieldName="accountHistory"
              value={aiAnalysis.accountHistory || ''}
              placeholder="Brief narrative of the account journey..."
              onChange={onFieldChange}
              rows={3}
            />
          </SubSection>

          <SubSection title="Resource Needs">
            <AutoSaveTextarea
              label="Support & Resources"
              fieldName="resourceNeeds"
              value={aiAnalysis.resourceNeeds || ''}
              placeholder="Resources needed from leadership..."
              onChange={onFieldChange}
              rows={3}
            />
          </SubSection>
        </div>
      </div>
    </div>
  );
}
