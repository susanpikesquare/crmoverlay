/**
 * Account Plan AI Service
 *
 * Orchestrates Gong data fetching and Claude AI analysis for strategic account plans.
 * Adapted from the Google Apps Script's runAIAnalysis approach.
 */

import crypto from 'crypto';
import { createGongServiceFromDB, GongCall, GongTranscript } from './gongService';
import { aiService } from './aiService';
import AccountPlan from '../models/AccountPlan';

// ── Types ──

interface GongSnapshot {
  calls: Array<{
    id: string;
    title: string;
    date: string;
    duration: number;
    parties: string[];
    topics: string[];
    sentiment?: string;
    transcriptExcerpt?: string;
  }>;
  emails: Array<{
    subject: string;
    sentAt: string;
    opened: boolean;
    replied: boolean;
  }>;
  callCount: number;
  emailCount: number;
  dateRange: { from: string; to: string };
}

interface AIAnalysisResult {
  aiAnalysis: Record<string, any>;
  leadershipAsks: Record<string, any>[];
  dayPlans: Record<string, any>;
  actionItems: Record<string, any>[];
  gongSnapshot: GongSnapshot;
}

// ── Function 1: Fetch Gong Data ──

export async function fetchGongDataForPlan(
  accountName: string,
  contactsSnapshot: Record<string, any>[],
  salesforceAccountId?: string
): Promise<GongSnapshot | null> {
  const gongService = await createGongServiceFromDB();
  if (!gongService) {
    console.log('[AccountPlanAI] Gong not configured, skipping Gong data fetch');
    return null;
  }

  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const dateRange = {
    from: twelveMonthsAgo.toISOString(),
    to: now.toISOString(),
  };

  try {
    // Fetch all calls in the 12-month window
    const allCalls = await gongService.getCallsPaginated(
      { fromDateTime: dateRange.from, toDateTime: dateRange.to },
      500
    );

    // Build domain set from contacts for matching
    const contactDomains = new Set<string>();
    const contactEmails = new Set<string>();
    for (const contact of contactsSnapshot) {
      const email = contact.Email?.toLowerCase();
      if (email) {
        contactEmails.add(email);
        const domain = email.split('@')[1];
        if (domain && !['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(domain)) {
          contactDomains.add(domain);
        }
      }
    }

    const accountNameLower = accountName.toLowerCase();

    // Match calls by: CRM account association, contact email domain, or title containing account name
    const matchedCalls = allCalls.filter((call: GongCall) => {
      // Check CRM account association
      if (salesforceAccountId && call.crmAssociations?.accountIds?.includes(salesforceAccountId)) {
        return true;
      }

      // Check if any party email matches contact domains
      for (const party of call.parties) {
        const email = party.emailAddress?.toLowerCase();
        if (email) {
          if (contactEmails.has(email)) return true;
          const domain = email.split('@')[1];
          if (domain && contactDomains.has(domain)) return true;
        }
      }

      // Check title contains account name
      if (call.title?.toLowerCase().includes(accountNameLower)) {
        return true;
      }

      return false;
    });

    // Sort by date descending, take top 20
    const sortedCalls = matchedCalls
      .sort((a: GongCall, b: GongCall) => new Date(b.started).getTime() - new Date(a.started).getTime())
      .slice(0, 20);

    // Fetch transcripts for matched calls
    const callIds = sortedCalls.map((c: GongCall) => c.id);
    let transcripts = new Map<string, GongTranscript>();
    if (callIds.length > 0) {
      transcripts = await gongService.getTranscriptsBatch(callIds);
    }

    // Fetch email activity
    let emails: any[] = [];
    try {
      emails = await gongService.getEmailActivity({
        fromDateTime: dateRange.from,
        toDateTime: dateRange.to,
      });
      // Filter emails to matching account
      emails = emails.filter((email: any) => {
        if (salesforceAccountId && email.accountId === salesforceAccountId) return true;
        const toEmails = (email.to || []).map((t: string) => t.toLowerCase());
        for (const to of toEmails) {
          const domain = to.split('@')[1];
          if (domain && contactDomains.has(domain)) return true;
        }
        return false;
      });
    } catch {
      console.log('[AccountPlanAI] Email fetch failed, continuing without emails');
    }

    // Build snapshot
    const gongSnapshot: GongSnapshot = {
      calls: sortedCalls.map((call: GongCall) => {
        const transcript = transcripts.get(call.id);
        let transcriptExcerpt = '';
        if (transcript?.transcript) {
          // Take first ~1000 chars of transcript text
          const lines: string[] = [];
          let charCount = 0;
          for (const segment of transcript.transcript) {
            for (const sentence of segment.sentences) {
              if (charCount > 1000) break;
              lines.push(sentence.text);
              charCount += sentence.text.length;
            }
            if (charCount > 1000) break;
          }
          transcriptExcerpt = lines.join(' ');
        }

        return {
          id: call.id,
          title: call.title,
          date: call.started,
          duration: call.duration,
          parties: call.parties.map(p => p.name || p.emailAddress || 'Unknown').filter(Boolean) as string[],
          topics: call.topics || [],
          sentiment: call.sentiment,
          transcriptExcerpt,
        };
      }),
      emails: emails.slice(0, 50).map((email: any) => ({
        subject: email.subject,
        sentAt: email.sentAt,
        opened: email.opened,
        replied: email.replied,
      })),
      callCount: matchedCalls.length,
      emailCount: emails.length,
      dateRange,
    };

    return gongSnapshot;
  } catch (error) {
    console.error('[AccountPlanAI] Error fetching Gong data:', error);
    return null;
  }
}

// ── Function 2: Run AI Analysis ──

export async function runAccountPlanAI(
  accountSnapshot: Record<string, any>,
  renewals: Record<string, any>[],
  expansions: Record<string, any>[],
  contacts: Record<string, any>[],
  gongSnapshot: GongSnapshot | null
): Promise<{ aiAnalysis: Record<string, any>; leadershipAsks: any[]; dayPlans: Record<string, any>; actionItems: any[] }> {

  // Build the prompt
  let prompt = `You are a strategic account planning AI assistant. Analyze the following account data and generate a comprehensive strategic analysis.

## Account Data

**Account Name:** ${accountSnapshot.Name || 'Unknown'}
**Industry:** ${accountSnapshot.Industry || 'Unknown'}
**Total ARR:** ${accountSnapshot.Total_ARR__c ? `$${Number(accountSnapshot.Total_ARR__c).toLocaleString()}` : 'Unknown'}
**Contracted Users:** ${accountSnapshot.Contract_Total_License_Seats__c || accountSnapshot.of_Axonify_Users__c || 'Unknown'}
**Customer Stage:** ${accountSnapshot.Customer_Stage__c || 'Unknown'}
**Risk Level:** ${accountSnapshot.Risk__c || 'Unknown'}
**Success Score:** ${accountSnapshot.Customer_Success_Score__c || accountSnapshot.Current_Gainsight_Score__c || 'Unknown'}
**Max Utilization:** ${accountSnapshot.License_Utilization_Max__c != null ? `${Math.round(accountSnapshot.License_Utilization_Max__c)}%` : 'Unknown'}
**Contract End:** ${accountSnapshot.Agreement_Expiry_Date__c || 'Unknown'}
**Account Owner:** ${accountSnapshot.Owner?.Name || 'Unknown'}
**Parent Account:** ${accountSnapshot.Parent?.Name || accountSnapshot.Clay_Parent_Account__c || 'N/A'}
`;

  if (accountSnapshot.Risk_Notes__c) prompt += `**Risk Notes:** ${accountSnapshot.Risk_Notes__c}\n`;
  if (accountSnapshot.Strategy_Notes__c) prompt += `**Strategy Notes:** ${accountSnapshot.Strategy_Notes__c}\n`;
  if (accountSnapshot.Overall_Customer_Health_Notes__c) prompt += `**Health Notes:** ${accountSnapshot.Overall_Customer_Health_Notes__c}\n`;
  if (accountSnapshot.Support_Notes__c) prompt += `**Support Notes:** ${accountSnapshot.Support_Notes__c}\n`;

  // Renewal opps
  if (renewals.length > 0) {
    prompt += `\n## Renewal Opportunities (${renewals.length})\n`;
    renewals.forEach((opp, i) => {
      prompt += `${i + 1}. **${opp.Name}** — $${Number(opp.Amount || opp.ARR__c || 0).toLocaleString()} — Stage: ${opp.StageName} — Close: ${opp.CloseDate}\n`;
      if (opp.MEDDPICCR_Economic_Buyer__c) prompt += `   Economic Buyer: ${opp.MEDDPICCR_Economic_Buyer__c}\n`;
      if (opp.MEDDPICCR_Champion__c) prompt += `   Champion: ${opp.MEDDPICCR_Champion__c}\n`;
      if (opp.MEDDPICCR_Competition__c) prompt += `   Competition: ${opp.MEDDPICCR_Competition__c}\n`;
      if (opp.MEDDPICCR_Risks__c) prompt += `   Risks: ${opp.MEDDPICCR_Risks__c}\n`;
    });
  }

  // Expansion opps
  if (expansions.length > 0) {
    prompt += `\n## Expansion Opportunities (${expansions.length})\n`;
    expansions.forEach((opp, i) => {
      prompt += `${i + 1}. **${opp.Name}** — $${Number(opp.Amount || opp.ARR__c || 0).toLocaleString()} — Stage: ${opp.StageName} — Close: ${opp.CloseDate}\n`;
    });
  }

  // Contacts
  if (contacts.length > 0) {
    prompt += `\n## Key Contacts (${contacts.length})\n`;
    contacts.slice(0, 20).forEach((c, i) => {
      prompt += `${i + 1}. **${c.Name || `${c.FirstName || ''} ${c.LastName || ''}`.trim()}** — ${c.Title || 'No title'} — ${c.Email || ''}\n`;
    });
  }

  // Gong data
  if (gongSnapshot && gongSnapshot.calls.length > 0) {
    prompt += `\n## Gong Call Intelligence (${gongSnapshot.callCount} calls found, showing ${gongSnapshot.calls.length})\n`;
    prompt += `Date range: ${new Date(gongSnapshot.dateRange.from).toLocaleDateString()} to ${new Date(gongSnapshot.dateRange.to).toLocaleDateString()}\n\n`;

    gongSnapshot.calls.forEach((call, i) => {
      prompt += `### Call ${i + 1}: ${call.title} (${new Date(call.date).toLocaleDateString()})\n`;
      prompt += `Duration: ${Math.round(call.duration / 60)}min | Participants: ${call.parties.join(', ')}\n`;
      if (call.topics?.length) prompt += `Topics: ${call.topics.join(', ')}\n`;
      if (call.sentiment) prompt += `Sentiment: ${call.sentiment}\n`;
      if (call.transcriptExcerpt) {
        prompt += `Excerpt: ${call.transcriptExcerpt.substring(0, 500)}\n`;
      }
      prompt += '\n';
    });

    if (gongSnapshot.emails.length > 0) {
      prompt += `\n## Gong Email Activity (${gongSnapshot.emailCount} emails)\n`;
      const opened = gongSnapshot.emails.filter(e => e.opened).length;
      const replied = gongSnapshot.emails.filter(e => e.replied).length;
      prompt += `Opened: ${opened}/${gongSnapshot.emails.length} | Replied: ${replied}/${gongSnapshot.emails.length}\n`;
    }
  }

  prompt += `
## Instructions

Based on ALL the data above, return a single JSON object (no markdown, no code fences) with these fields:

{
  "whyStayEconomicBuyer": "Why the economic buyer should stay (based on ROI, business value)",
  "whyStayAdmin": "Why admins/day-to-day users love the platform",
  "whyStayProcurement": "Value proposition for procurement (cost, consolidation, compliance)",
  "whyStayUsers": "What end users get from the platform (engagement, learning, etc.)",
  "whyStayRisks": "Key risks to retention and how to address them",
  "pipelineGap": "Analysis of ARR gap or pipeline risk vs target",
  "nextAction": "The single most important next action for this account",
  "keyDecisionMakers": "Key decision makers and their stance/sentiment",
  "renewalConfidence": "High/Medium/Low with explanation",
  "renewalStrategy": "Recommended renewal strategy (2-3 sentences)",
  "competitiveMentions": "Any competitors mentioned in calls or data, with context",
  "gongSentiment": "Overall sentiment from calls (Positive/Neutral/Negative with detail)",
  "whitespaceOpportunities": "Expansion/upsell opportunities identified",
  "whitespaceStrategy": "How to approach the whitespace opportunities",
  "stakeholderIntelligence": "Key insights about stakeholder dynamics and relationships",
  "techStack": "Known tech stack and integration points",
  "keyThemes": "Top 3-5 themes from calls and account data",
  "accountHistory": "Brief narrative of the account journey",
  "resourceNeeds": "Resources or support needed from leadership/other teams",
  "leadershipAsks": [
    {
      "initiative": "What needs to happen",
      "urgency": "High",
      "action": "Specific ask",
      "owner": "Suggested owner role",
      "quarter": "Q1/Q2/Q3/Q4"
    }
  ],
  "thirtyDayPlan": "Specific actions for the next 30 days",
  "sixtyDayPlan": "Actions for days 31-60",
  "ninetyDayPlan": "Actions for days 61-90",
  "suggestedActionItems": [
    {
      "description": "Specific action to take",
      "owner": "Role/person responsible",
      "dueDate": "YYYY-MM-DD",
      "priority": "high/medium/low"
    }
  ]
}

Be specific and actionable. Reference actual data, names, and numbers from the account data above. Do not invent information not present in the data. If Gong data is available, heavily leverage call insights for sentiment, competitive mentions, and stakeholder intelligence. Return ONLY the JSON object.`;

  const response = await aiService.askWithContext(prompt, 16000);

  // Parse the JSON response
  let parsed: any;
  try {
    // Try to extract JSON from the response (handle potential markdown wrapping)
    let jsonStr = response.trim();
    // Strip markdown code fences if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    // If JSON is truncated (no closing brace), try to repair it
    if (!jsonStr.endsWith('}')) {
      // Find the last complete key-value pair and close the object
      const lastCompleteComma = jsonStr.lastIndexOf('",');
      const lastCompleteBracket = jsonStr.lastIndexOf('],');
      const lastCompleteBrace = jsonStr.lastIndexOf('},');
      const cutoff = Math.max(lastCompleteComma, lastCompleteBracket, lastCompleteBrace);
      if (cutoff > 0) {
        jsonStr = jsonStr.substring(0, cutoff + 1);
        // Count open brackets/braces to close them
        const openBraces = (jsonStr.match(/\{/g) || []).length - (jsonStr.match(/\}/g) || []).length;
        const openBrackets = (jsonStr.match(/\[/g) || []).length - (jsonStr.match(/\]/g) || []).length;
        jsonStr += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
      }
    }
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('[AccountPlanAI] Failed to parse AI response as JSON:', parseError);
    console.error('[AccountPlanAI] Raw response (first 1000 chars):', response.substring(0, 1000));
    console.error('[AccountPlanAI] Raw response (last 500 chars):', response.substring(response.length - 500));
    throw new Error('AI returned invalid JSON response. Please try again.');
  }

  // Extract and structure the result
  const aiAnalysis: Record<string, any> = {
    whyStayEconomicBuyer: parsed.whyStayEconomicBuyer || '',
    whyStayAdmin: parsed.whyStayAdmin || '',
    whyStayProcurement: parsed.whyStayProcurement || '',
    whyStayUsers: parsed.whyStayUsers || '',
    whyStayRisks: parsed.whyStayRisks || '',
    pipelineGap: parsed.pipelineGap || '',
    nextAction: parsed.nextAction || '',
    keyDecisionMakers: parsed.keyDecisionMakers || '',
    renewalConfidence: parsed.renewalConfidence || '',
    renewalStrategy: parsed.renewalStrategy || '',
    competitiveMentions: parsed.competitiveMentions || '',
    gongSentiment: parsed.gongSentiment || '',
    whitespaceOpportunities: parsed.whitespaceOpportunities || '',
    whitespaceStrategy: parsed.whitespaceStrategy || '',
    stakeholderIntelligence: parsed.stakeholderIntelligence || '',
    techStack: parsed.techStack || '',
    keyThemes: parsed.keyThemes || '',
    accountHistory: parsed.accountHistory || '',
    resourceNeeds: parsed.resourceNeeds || '',
    generatedAt: new Date().toISOString(),
    gongCallCount: gongSnapshot?.callCount || 0,
    gongDateRange: gongSnapshot?.dateRange || null,
  };

  const leadershipAsks = (parsed.leadershipAsks || []).map((ask: any) => ({
    id: crypto.randomUUID(),
    initiative: ask.initiative || '',
    urgency: ask.urgency || 'Medium',
    action: ask.action || '',
    owner: ask.owner || '',
    quarter: ask.quarter || '',
  }));

  const dayPlans = {
    thirtyDay: parsed.thirtyDayPlan || '',
    sixtyDay: parsed.sixtyDayPlan || '',
    ninetyDay: parsed.ninetyDayPlan || '',
  };

  const actionItems = (parsed.suggestedActionItems || []).map((item: any) => ({
    id: crypto.randomUUID(),
    description: item.description || '',
    status: 'todo',
    dueDate: item.dueDate || null,
    owner: item.owner || '',
    completedAt: null,
    createdAt: new Date().toISOString(),
    source: 'ai',
  }));

  return { aiAnalysis, leadershipAsks, dayPlans, actionItems };
}

// ── Function 3: Orchestrator ──

export async function generateAccountPlanAI(planId: string): Promise<AccountPlan> {
  const plan = await AccountPlan.findByPk(planId);
  if (!plan) {
    throw new Error(`Account plan not found: ${planId}`);
  }

  const accountName = plan.accountSnapshot?.Name || 'Unknown Account';

  // Step 1: Fetch Gong data
  console.log(`[AccountPlanAI] Fetching Gong data for "${accountName}"...`);
  const gongSnapshot = await fetchGongDataForPlan(
    accountName,
    plan.contactsSnapshot || [],
    plan.salesforceAccountId
  );

  if (gongSnapshot) {
    console.log(`[AccountPlanAI] Found ${gongSnapshot.callCount} calls, ${gongSnapshot.emailCount} emails`);
  } else {
    console.log('[AccountPlanAI] No Gong data available, running with SF data only');
  }

  // Step 2: Run AI analysis
  console.log(`[AccountPlanAI] Running AI analysis...`);
  const result = await runAccountPlanAI(
    plan.accountSnapshot || {},
    plan.renewalOppsSnapshot || [],
    plan.expansionOppsSnapshot || [],
    plan.contactsSnapshot || [],
    gongSnapshot
  );

  // Step 3: Update the plan with all new data
  await plan.update({
    aiAnalysis: result.aiAnalysis,
    leadershipAsks: result.leadershipAsks,
    dayPlans: result.dayPlans,
    actionItems: result.actionItems,
    gongSnapshot: gongSnapshot,
  });

  console.log(`[AccountPlanAI] Analysis complete for "${accountName}"`);

  return plan;
}
