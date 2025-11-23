# Agentforce Integration for AI Recommendations

## Overview

Agentforce is Salesforce's AI platform that can be integrated into the CRM Overlay to provide intelligent, context-aware recommendations for AEs, AMs, and CSMs.

## Integration Approach

### Option 1: Agentforce Einstein Recommendations API (Recommended)

Use Salesforce's Einstein API to get AI-powered recommendations based on account/opportunity data.

**Endpoint:** `https://your-instance.salesforce.com/services/data/v60.0/einstein/recommendations`

**Authentication:** Uses existing Salesforce OAuth connection

**Benefits:**
- Already authenticated via our OAuth flow
- Native Salesforce integration
- Access to all Salesforce data context
- Can leverage Einstein models trained on your data

### Option 2: Agentforce Prompt Builder

Use Salesforce's Prompt Builder to create custom prompts that generate recommendations.

**Endpoint:** `https://your-instance.salesforce.com/services/data/v60.0/einstein/prompt-templates/{templateId}/generations`

**Benefits:**
- Customizable prompts per use case
- Can include specific business rules
- Leverages GPT models within Salesforce
- Maintains data residency in Salesforce

### Option 3: Custom Apex REST Endpoint

Create a custom Apex REST endpoint in Salesforce that calls Agentforce and returns recommendations.

**Example Endpoint:** `https://your-instance.salesforce.com/services/apexrest/AgentforceRecommendations`

**Benefits:**
- Full control over logic
- Can combine multiple Agentforce features
- Custom business rules enforcement
- Easy to version and update

## Implementation Plan

### Phase 1: Backend Service (Current)

Create an `agentforceService.ts` that:
1. Connects to Salesforce Agentforce API
2. Sends account/opportunity context
3. Receives AI recommendations
4. Caches recommendations to reduce API calls

### Phase 2: Recommendation Types

**For AE Hub:**
- Next best action for high-intent accounts
- Outreach messaging suggestions
- Competitive positioning advice
- Deal risk alerts

**For AM Hub:**
- Renewal risk predictions
- Expansion opportunity identification
- QBR talking points
- Health score interventions

**For CSM Hub:**
- Adoption improvement strategies
- Churn prediction alerts
- Feature recommendation for specific accounts
- Executive engagement suggestions

### Phase 3: Fallback Logic

If Agentforce API is unavailable or not configured:
- Use rule-based recommendations (current approach)
- Log that AI recommendations are disabled
- Provide clear path to enable Agentforce

## Setup Instructions

### 1. Enable Agentforce in Salesforce

1. Go to Setup → Einstein → Einstein Recommendations
2. Enable Einstein Recommendations for your org
3. Configure recommendation models
4. Create custom prompt templates if needed

### 2. Grant API Permissions

Ensure the Connected App has permissions:
- `api` - Standard API access
- `einstein_gpt_api` - Agentforce/Einstein GPT API access
- `full` - Full access (if using custom Apex endpoints)

### 3. Environment Variables

Add to `backend/.env`:
```bash
# Agentforce Configuration
AGENTFORCE_ENABLED=true
AGENTFORCE_MODEL=gpt-4  # or your specific model
AGENTFORCE_CACHE_TTL=3600  # Cache recommendations for 1 hour
```

### 4. Create Prompt Templates (Optional)

If using Prompt Builder, create templates in Salesforce:

**AE Priority Account Prompt:**
```
Given this account information:
- Company: {!Account.Name}
- Industry: {!Account.Industry}
- Employee Count: {!Account.Clay_Employee_Count__c}
- Intent Score: {!Account.accountIntentScore6sense__c}
- Buying Stage: {!Account.accountBuyingStage6sense__c}
- Recent Signals: {!Account.Clay_Active_Signals__c}

Generate a personalized next best action for an Account Executive to engage this prospect. Focus on:
1. Why now is the right time to reach out
2. Specific personalization based on company/industry
3. Recommended channel and message
4. Expected outcome
```

**AM Renewal Risk Prompt:**
```
Given this renewal situation:
- Account: {!Account.Name}
- Days to Renewal: {daysToRenewal}
- Health Score: {!Account.Current_Gainsight_Score__c}
- Usage Trend: {usageTrend}
- Last QBR: {!Account.Last_QBR__c}
- Risk Factors: {riskFactors}

Generate an action plan to save this renewal, including:
1. Immediate actions (next 48 hours)
2. Key stakeholders to engage
3. Value points to emphasize
4. Success metrics to track
```

## API Examples

### Example 1: Get Recommendation via Einstein API

```typescript
// Get recommendation for priority account
const recommendation = await agentforce.getRecommendation({
  objectType: 'Account',
  recordId: accountId,
  context: {
    intentScore: 89,
    buyingStage: 'Decision',
    signals: ['New VP hired', 'Website activity up 3x']
  },
  promptType: 'ae_priority_action'
});

// Returns:
{
  recommendation: "Research new VP Sarah Chen on LinkedIn...",
  confidence: 0.92,
  reasoning: "High intent score combined with executive change...",
  suggestedActions: [
    { type: 'email', priority: 'high', template: '...' },
    { type: 'linkedin', priority: 'medium', message: '...' }
  ]
}
```

### Example 2: Batch Recommendations

```typescript
// Get recommendations for multiple accounts at once
const recommendations = await agentforce.getBatchRecommendations([
  { accountId: '001...', type: 'priority_action' },
  { accountId: '001...', type: 'priority_action' },
  { opportunityId: '006...', type: 'deal_risk' }
]);
```

## Cost Considerations

- Einstein API calls count toward Salesforce API limits
- Agentforce/GPT calls may have usage-based pricing
- Implement caching to reduce costs:
  - Cache recommendations for 1-4 hours
  - Invalidate cache on data changes
  - Use batch calls when possible

## Monitoring

Track these metrics:
- API call volume to Agentforce
- Recommendation quality (user feedback)
- Cache hit rate
- API errors/failures
- Recommendation adoption rate (% of recs acted upon)

## Next Steps

1. ✅ Create agentforceService.ts with API integration
2. ✅ Add recommendation caching layer
3. ✅ Update hub components to use Agentforce recommendations
4. ⬜ Create Salesforce prompt templates
5. ⬜ Configure Einstein Recommendations in Salesforce
6. ⬜ Test and validate recommendations
7. ⬜ Add user feedback mechanism
8. ⬜ Monitor and optimize

---

**Note:** For now, we'll implement the service with fallback logic. The AI recommendations will use Agentforce when available, and fall back to rule-based recommendations otherwise.
