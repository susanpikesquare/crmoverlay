# AI Configuration Guide

## Overview

The CRM Overlay now includes AI-powered deal summaries that analyze your Salesforce opportunities and provide actionable insights. The AI service supports **three different AI providers**, giving you flexibility to use your existing AI subscription.

## Supported AI Providers

### 1. Anthropic Claude (Recommended)
**Best for:** Highest quality deal analysis and recommendations
**Model Used:** `claude-3-5-sonnet-20241022`
**Cost:** ~$3 per 1M tokens (input), ~$15 per 1M tokens (output)

**How to get an API key:**
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Add to your environment: `ANTHROPIC_API_KEY=sk-ant-api03-...`

### 2. OpenAI ChatGPT
**Best for:** Customers with existing OpenAI or Azure OpenAI subscriptions
**Model Used:** `gpt-4-turbo-preview`
**Cost:** ~$10 per 1M tokens (input), ~$30 per 1M tokens (output)

**How to get an API key:**
1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API keys
4. Create a new API key
5. Add to your environment: `OPENAI_API_KEY=sk-proj-...`

### 3. Google Gemini
**Best for:** Customers with existing Google Cloud / Vertex AI subscriptions
**Model Used:** `gemini-pro`
**Cost:** Free tier available, then pay-as-you-go pricing

**How to get an API key:**
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Create an API key
4. Add to your environment: `GOOGLE_AI_API_KEY=...`

## Configuration

### Local Development

1. Copy `.env.example` to `.env` in the backend folder
2. Add ONE of the AI API keys (the service will use whichever is configured)
3. Restart your backend server

```bash
cd backend
cp .env.example .env
# Edit .env and add your chosen API key
npm run dev
```

### Heroku Production

Set the environment variable in Heroku:

```bash
# For Claude (recommended):
heroku config:set ANTHROPIC_API_KEY=sk-ant-api03-... --app formation-production

# OR for OpenAI:
heroku config:set OPENAI_API_KEY=sk-proj-... --app formation-production

# OR for Gemini:
heroku config:set GOOGLE_AI_API_KEY=... --app formation-production
```

The service will automatically restart and use the configured provider.

## Priority Order

If multiple API keys are configured, the service uses this priority:
1. **Anthropic Claude** (if `ANTHROPIC_API_KEY` is set)
2. **OpenAI ChatGPT** (if `OPENAI_API_KEY` is set)
3. **Google Gemini** (if `GOOGLE_AI_API_KEY` is set)

You can change this priority in `backend/src/services/aiService.ts` if needed.

## What the AI Analyzes

The AI Deal Summary considers:
- **Opportunity data:** Name, stage, amount, close date, days in stage
- **Command of the Message scores:** Why Do Anything, Why Now, Why Us
- **MEDDPICC scores:** Overall qualification score
- **Recent activity:** Last 5 tasks, calls, meetings, emails
- **Risk indicators:** At-risk flag, deal velocity

## AI-Generated Insights

For each deal, the AI provides:
1. **Overview** - 2-3 sentence summary of the deal
2. **Key Stakeholders** - List of decision-makers and influencers mentioned
3. **Current Status** - Assessment of deal health and momentum
4. **Risks & Blockers** - 2-3 main concerns or obstacles
5. **Next Actions** - 2-3 recommended next steps with owners

## Security & Privacy

- **Data in transit:** All AI providers use HTTPS encryption
- **Data retention:**
  - Anthropic: 30 days for safety/abuse monitoring (not used for training)
  - OpenAI: 30 days for safety/abuse monitoring (not used for training)
  - Google: Per your Google Cloud data processing agreement
- **Salesforce data:** Only opportunity and activity data is sent, not sensitive PII
- **Caching:** AI summaries are cached for 5 minutes in the browser to reduce costs

## Cost Estimation

Based on typical usage patterns:

**Per deal summary:**
- Input: ~800 tokens (opportunity data + activities)
- Output: ~300 tokens (JSON response)
- **Cost per summary:**
  - Claude: ~$0.003 per summary
  - OpenAI: ~$0.017 per summary
  - Gemini: Free (within quota)

**Monthly estimates** (assuming 100 deals viewed/day):
- Claude: ~$9/month
- OpenAI: ~$51/month
- Gemini: Free (up to quota limits)

## Troubleshooting

### "AI summary generation is not configured"
- No API key is set. Add one of the three API keys to your environment.

### "Failed to generate AI summary"
- Check your API key is valid
- Verify you have credits/quota with the provider
- Check Heroku logs: `heroku logs --tail --app formation-production`

### Wrong provider being used
- Check which API keys are set: `heroku config --app formation-production`
- The service uses priority: Anthropic > OpenAI > Gemini
- Remove unwanted API keys or change priority in code

## Testing AI Summaries

1. Navigate to any opportunity detail page
2. The AI Deal Summary appears below the Command of Message card
3. Click the "Copy" button to copy insights to clipboard
4. Collapse/expand sections as needed

## Next Steps

After configuring AI:
1. Test with a few deals to validate quality
2. Gather user feedback on AI recommendations
3. Monitor costs in your AI provider dashboard
4. Consider upgrading to production tier if using free tiers

## Support

For issues specific to:
- **Anthropic:** https://docs.anthropic.com/
- **OpenAI:** https://platform.openai.com/docs
- **Google Gemini:** https://ai.google.dev/docs

For CRM Overlay AI integration issues, check the server logs or contact your administrator.
