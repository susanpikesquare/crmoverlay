# Phase 1 Implementation Plan: AE Daily Hub

## Overview
Transform the existing AEHub into a comprehensive daily workspace that aggregates data from Salesforce, Clay, and 6sense to provide AEs with a single landing page for priorities, pipeline, and actions.

## Current State Analysis

### Existing Features
- ✅ AE Hub with metrics (quota attainment, pipeline coverage, hot prospects, avg deal size)
- ✅ Priority Accounts table (intent score >= 70, grouped by domain)
- ✅ At-Risk Deals table (stale deals >14 days, low MEDDPICC <60%)
- ✅ OpportunityDetail with Command of the Message
- ✅ Account360 with Clay and 6sense data
- ✅ Inline field editing with FLS enforcement
- ✅ Role-based dashboards (AE, AM, CSM, Sales Leader)

### Existing API Endpoints
- `/api/hub/ae/metrics` - Quota, pipeline, prospects
- `/api/hub/ae/priority-accounts` - High-intent accounts
- `/api/hub/ae/at-risk-deals` - Deals needing attention
- `/api/opportunities/:id` - Opportunity detail
- `/api/accounts/:id` - Account detail

## Phase 1 Enhancements

### 1. Today's Priorities Panel

**Goal**: Surface actionable items requiring immediate attention

**Data Sources**:
- Salesforce Opportunities (missing fields, stage duration, next steps)
- Tasks (overdue, due today)
- Clay/6sense (new ICP events, intent spikes)

**Backend Additions**:
```
GET /api/hub/ae/priorities
Returns:
{
  priorities: [
    {
      id: string,
      type: 'deal-risk' | 'missing-info' | 'icp-alert' | 'task-due' | 'no-next-step',
      title: string,
      description: string,
      urgency: 'critical' | 'high' | 'medium',
      relatedAccountId?: string,
      relatedOpportunityId?: string,
      dueDate?: string,
      actionButton: {
        label: string,
        action: string  // URL or action identifier
      }
    }
  ]
}
```

**Priority Types**:
1. **Deal Risk**: Opportunities closing this month missing required Command fields
2. **Stage Stuck**: Opportunities in stage >30 days (configurable threshold)
3. **No Next Meeting**: Opportunities without scheduled next meeting
4. **Missing Info**: Opportunities missing MEDDPICC fields (score <50%)
5. **ICP Alert**: Accounts in territory with new Clay/6sense signals
6. **Task Due**: Overdue or due-today tasks

**Frontend Component**:
- `TodaysPrioritiesPanel.tsx` - Card-based priority list
- Click to navigate to account/opportunity
- Dismissable items (stored in session/local storage)
- Sort by urgency

### 2. Pipeline and Forecast Panel

**Goal**: Show pipeline health and forecast submission status

**Backend Additions**:
```
GET /api/hub/ae/pipeline-forecast
Returns:
{
  currentQuarter: {
    quarterName: string,
    totalPipeline: number,
    commitForecast: number,
    bestCaseForecast: number,
    coverageRatio: number,
    opportunitiesByStage: {
      stageName: string,
      count: number,
      value: number
    }[]
  },
  nextQuarter: {
    // Same structure
  },
  forecastStatus: {
    isSubmitted: boolean,
    lastSubmittedDate?: string,
    submissionUrl: string  // Link to SFDC forecast page
  }
}
```

**Data Sources**:
- Salesforce Opportunities (filtered by owner)
- Salesforce Forecast objects (if available)
- Calculated coverage ratio = Pipeline / Remaining Quota

**Frontend Component**:
- `PipelineForecastPanel.tsx`
- Bar chart showing pipeline by stage
- Coverage metric with color coding (green >3x, yellow 2-3x, red <2x)
- Forecast submission status banner
- Link to SFDC forecast submission

### 3. Enhanced Active Deals Panel

**Goal**: Show top opportunities with health indicators and last touch

**Backend Enhancements**:
```
GET /api/hub/ae/active-deals
Query params: stage?, minAmount?, closingQuarter?
Returns:
{
  deals: [
    {
      ...existing Opportunity fields,
      healthIndicator: 'healthy' | 'warning' | 'at-risk',
      lastTouchDate: string,
      lastTouchType: 'email' | 'call' | 'meeting',
      daysSinceLastTouch: number,
      nextMeetingDate?: string
    }
  ]
}
```

**Data Sources**:
- Salesforce Opportunities
- Salesforce Tasks (for last activity)
- Agentforce risk flags (if available)
- Command of the Message scores

**Health Calculation**:
- Healthy: MEDDPICC >70%, activity <7 days, on track
- Warning: MEDDPICC 50-70%, activity 7-14 days
- At Risk: MEDDPICC <50%, activity >14 days, or risk flag set

**Frontend Enhancement**:
- Add health indicator column (color-coded dot)
- Add "Last Touch" column
- Add "Open Deal Workspace" button per row
- Filter by stage, close date, health

### 4. Deal Workspace View

**Goal**: Transform OpportunityDetail into comprehensive deal workspace

**Enhancements to Existing OpportunityDetail**:

**4a. Activity Timeline**
```
GET /api/opportunities/:id/timeline
Returns:
{
  activities: [
    {
      id: string,
      type: 'email' | 'call' | 'meeting' | 'task' | 'note',
      date: string,
      subject: string,
      description: string,
      participants?: string[],
      recordingUrl?: string  // For Gong calls when available
    }
  ]
}
```

**Data Sources (Phase 1)**:
- Salesforce Tasks
- Salesforce Events (meetings)
- Opportunity field history (stage changes)

**Frontend Component**:
- `ActivityTimeline.tsx`
- Chronological list with icons per type
- Filter by activity type
- Expandable details

**4b. AI Deal Summary Panel**
```
GET /api/opportunities/:id/ai-summary
Returns:
{
  summary: {
    overview: string,
    stakeholders: string[],
    currentStage: string,
    risks: string[],
    nextActions: string[]
  },
  generatedAt: string
}
```

**AI Generation Logic**:
- Use Salesforce Opportunity fields
- Use Command of the Message fields
- Use MEDDPICC scores
- Use recent activity from timeline
- Generate using Anthropic Claude API

**Frontend Component**:
- `AIDealSummaryPanel.tsx`
- Expandable sections (overview, stakeholders, risks, next actions)
- "Copy to email" button
- "Insert as note" button (creates Salesforce note)

### 5. Prospecting View

**Goal**: New page for prospecting with ICP signals and outreach actions

**Route**: `/prospecting`

**Backend**:
```
GET /api/prospecting/target-accounts
Query params: intentThreshold?, employeeGrowth?, stage?
Returns:
{
  accounts: [
    {
      ...Account fields,
      icpFit: number,  // 0-100 score
      intentScore: number,
      intentTrending: 'up' | 'down' | 'stable',
      claySignals: string[],
      sixsenseSignals: string[],
      hasOpenOpportunity: boolean,
      lastOutreachDate?: string,
      daysSinceOutreach?: number,
      inSequence: boolean
    }
  ]
}
```

**Data Sources**:
- Salesforce Accounts (user's territory)
- Clay ICP events
- 6sense intent data
- Salesforce Tasks (for last outreach)

**Frontend Component**:
- `ProspectingView.tsx`
- Filterable table (ICP fit, intent, no recent outreach)
- Action buttons per account:
  - "View Account 360"
  - "Draft Email" (opens AI assistant)
  - "Create Task"
- Bulk select for batch actions

### 6. AI Assistant Sidebar

**Goal**: Persistent right sidebar for AI assistance

**Backend**:
```
POST /api/ai/chat
Body: {
  messages: [{role, content}],
  context: {
    accountId?: string,
    opportunityId?: string,
    action?: 'draft-email' | 'summarize' | 'suggest-actions'
  }
}
Returns:
{
  response: string,
  suggestions?: string[]
}
```

**Context Injection**:
- If accountId provided, fetch account details, Clay data, 6sense data
- If opportunityId provided, fetch opportunity, Command fields, MEDDPICC, timeline
- Pass relevant data as system message to Claude API

**Frontend Component**:
- `AIAssistantSidebar.tsx`
- Chat interface with message history
- Context indicator (shows current account/opp)
- Quick action buttons:
  - "Draft follow-up email"
  - "Summarize this deal"
  - "Suggest next steps"
  - "Prep for call"
- Copy/insert response buttons

**Layout Change**:
- Update App.tsx layout to include sidebar
- Sidebar collapses on mobile
- Toggle button to show/hide

### 7. Global Search

**Goal**: Search across accounts, opportunities, contacts

**Backend**:
```
GET /api/search
Query params: q (query string), types? (account|opportunity|contact)
Returns:
{
  results: {
    accounts: Account[],
    opportunities: Opportunity[],
    contacts: Contact[]
  }
}
```

**Search Logic**:
- SOSL query across Name fields
- Limit to user's accessible records (respects sharing rules)
- Return top 5 per type

**Frontend Component**:
- Add search bar to Navigation component
- Dropdown results grouped by type
- Click to navigate to detail page

### 8. Notifications Panel

**Goal**: Alert users to important events

**Backend**:
```
GET /api/notifications
Returns:
{
  notifications: [
    {
      id: string,
      type: 'icp-event' | 'intent-spike' | 'risk-flag' | 'forecast-reminder',
      title: string,
      message: string,
      timestamp: string,
      read: boolean,
      relatedAccountId?: string,
      relatedOpportunityId?: string
    }
  ]
}

POST /api/notifications/:id/read
Mark notification as read
```

**Notification Types (Phase 1)**:
1. New Clay ICP events (weekly digest)
2. 6sense intent spikes (>20 point increase)
3. Deal risk flags from Agentforce
4. Forecast submission reminders

**Frontend Component**:
- Bell icon in Navigation with unread count badge
- Dropdown panel showing recent notifications
- Click to navigate to related record
- "Mark all as read" button

## Implementation Order

### Week 1: Enhanced AE Hub Home
1. ✅ Create TodaysPrioritiesPanel component
2. ✅ Add `/api/hub/ae/priorities` endpoint
3. ✅ Create PipelineForecastPanel component
4. ✅ Add `/api/hub/ae/pipeline-forecast` endpoint
5. ✅ Enhance AEHub page to include new panels
6. ✅ Update active deals with health indicators

### Week 2: Deal Workspace
1. ✅ Create ActivityTimeline component
2. ✅ Add `/api/opportunities/:id/timeline` endpoint
3. ✅ Integrate Claude API for AI summaries
4. ✅ Create AIDealSummaryPanel component
5. ✅ Add `/api/opportunities/:id/ai-summary` endpoint
6. ✅ Update OpportunityDetail page with new sections

### Week 3: Prospecting & AI Assistant
1. ✅ Create ProspectingView page
2. ✅ Add `/api/prospecting/target-accounts` endpoint
3. ✅ Create AIAssistantSidebar component
4. ✅ Add `/api/ai/chat` endpoint
5. ✅ Update App layout to include sidebar
6. ✅ Add route for /prospecting

### Week 4: Search & Notifications
1. ✅ Add global search to Navigation
2. ✅ Add `/api/search` endpoint
3. ✅ Create NotificationsPanel component
4. ✅ Add `/api/notifications` endpoints
5. ✅ Set up notification generation logic
6. ✅ Test and refine entire Phase 1

## Configuration & Admin

**Admin Settings** (to be added in later phase):
- Command field mappings
- Stage duration thresholds
- ICP scoring rules
- Notification preferences per user

## Success Metrics

- Time to first action reduced (dashboard load → action taken)
- Increase in daily active users
- Reduction in deals missing required fields
- Increase in pipeline coverage
- Higher forecast accuracy

## Next Phases

**Phase 2**: Gmail, Calendar, Gong, Dock integrations
**Phase 3**: RFP workflow, CPQ integration, HeySam
**Phase 4**: Advanced AI, forecasting, territory planning
