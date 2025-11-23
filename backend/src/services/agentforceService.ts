/**
 * Agentforce AI Service
 *
 * Integrates with Salesforce Agentforce (Einstein AI) to provide intelligent recommendations.
 * Falls back to rule-based recommendations if Agentforce is not available.
 */

import { Connection } from 'jsforce';

const AGENTFORCE_ENABLED = process.env.AGENTFORCE_ENABLED === 'true';
const AGENTFORCE_CACHE_TTL = parseInt(process.env.AGENTFORCE_CACHE_TTL || '3600', 10);

interface RecommendationContext {
  objectType: 'Account' | 'Opportunity';
  recordId: string;
  data: any;
  promptType: string;
}

interface Recommendation {
  text: string;
  confidence: number;
  reasoning?: string;
  actions?: Array<{
    type: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
  }>;
}

// Simple in-memory cache
const recommendationCache = new Map<string, { recommendation: Recommendation; timestamp: number }>();

/**
 * Get AI recommendation from Agentforce or fallback to rules
 */
export async function getRecommendation(
  connection: Connection,
  context: RecommendationContext
): Promise<Recommendation> {
  // Check cache first
  const cacheKey = `${context.objectType}:${context.recordId}:${context.promptType}`;
  const cached = recommendationCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < AGENTFORCE_CACHE_TTL * 1000) {
    console.log('Returning cached recommendation for', cacheKey);
    return cached.recommendation;
  }

  let recommendation: Recommendation;

  if (AGENTFORCE_ENABLED) {
    try {
      recommendation = await getAgentforceRecommendation(connection, context);
      console.log('Got Agentforce recommendation for', cacheKey);
    } catch (error) {
      console.error('Agentforce error, falling back to rules:', error);
      recommendation = getRuleBasedRecommendation(context);
    }
  } else {
    recommendation = getRuleBasedRecommendation(context);
  }

  // Cache the recommendation
  recommendationCache.set(cacheKey, { recommendation, timestamp: Date.now() });

  return recommendation;
}

/**
 * Get recommendation from Salesforce Agentforce API
 */
async function getAgentforceRecommendation(
  connection: Connection,
  context: RecommendationContext
): Promise<Recommendation> {
  // TODO: Implement actual Agentforce API call once configured in Salesforce
  // For now, this is a placeholder that would call Einstein API

  /*
  Example API call:

  const response = await connection.request({
    method: 'POST',
    url: '/services/data/v60.0/einstein/prompt-templates/{templateId}/generations',
    body: {
      input: {
        ...context.data
      },
      parameters: {
        temperature: 0.7,
        max_tokens: 500
      }
    }
  });

  return {
    text: response.generations[0].text,
    confidence: response.generations[0].confidence,
    reasoning: response.generations[0].reasoning
  };
  */

  // For now, fall back to rule-based
  return getRuleBasedRecommendation(context);
}

/**
 * Rule-based recommendation fallback (current implementation)
 */
function getRuleBasedRecommendation(context: RecommendationContext): Recommendation {
  const { promptType, data } = context;

  switch (promptType) {
    case 'ae_priority_account':
      return getAEPriorityAccountRecommendation(data);

    case 'ae_at_risk_deal':
      return getAEAtRiskDealRecommendation(data);

    case 'am_renewal_risk':
      return getAMRenewalRiskRecommendation(data);

    case 'am_expansion':
      return getAMExpansionRecommendation(data);

    case 'csm_health_intervention':
      return getCSMHealthInterventionRecommendation(data);

    case 'csm_adoption':
      return getCSMAdoptionRecommendation(data);

    default:
      return {
        text: 'Review this record and take appropriate action based on current data.',
        confidence: 0.5,
      };
  }
}

/**
 * AE: Priority Account Recommendation
 */
function getAEPriorityAccountRecommendation(data: any): Recommendation {
  const { intentScore, buyingStage, signals, employeeCount, industry } = data;

  let text = '';
  let confidence = 0.7;
  const actions = [];

  // High intent + Decision stage
  if (intentScore >= 85 && buyingStage?.toLowerCase().includes('decision')) {
    text = `High-priority opportunity! Intent score of ${intentScore} with Decision stage indicates strong buying signals. `;
    text += `Schedule a discovery call this week to understand requirements and position your solution against decision criteria.`;
    confidence = 0.92;
    actions.push({
      type: 'call',
      priority: 'high' as const,
      description: 'Schedule discovery call within 48 hours',
    });
    actions.push({
      type: 'email',
      priority: 'high' as const,
      description: 'Send case study relevant to their industry',
    });
  }
  // High intent + Consideration
  else if (intentScore >= 80 && buyingStage?.toLowerCase().includes('consideration')) {
    text = `Strong buying intent detected (${intentScore}). Prospect is in consideration phase. `;
    text += `Research key stakeholders on LinkedIn and send personalized value proposition highlighting ROI for ${industry || 'their industry'}.`;
    confidence = 0.88;
    actions.push({
      type: 'research',
      priority: 'high' as const,
      description: 'Research decision makers on LinkedIn',
    });
    actions.push({
      type: 'email',
      priority: 'medium' as const,
      description: 'Send personalized value prop with ROI calculator',
    });
  }
  // Moderate intent
  else if (intentScore >= 70) {
    text = `Moderate intent (${intentScore}). ${buyingStage ? `Stage: ${buyingStage}.` : ''} `;
    text += `Monitor engagement and send targeted content about their pain points. Set up nurture campaign.`;
    confidence = 0.75;
    actions.push({
      type: 'nurture',
      priority: 'medium' as const,
      description: 'Add to targeted nurture campaign',
    });
  }

  // Add signal-based insights
  if (signals?.includes('new') || signals?.toLowerCase().includes('hired')) {
    text += ` New executive hire detected - excellent timing for outreach to influence new initiatives.`;
    actions.push({
      type: 'linkedin',
      priority: 'high' as const,
      description: 'Connect with new executive on LinkedIn',
    });
  }

  // Company size insights
  if (employeeCount && employeeCount > 1000) {
    text += ` Large enterprise (${employeeCount.toLocaleString()} employees) - consider multi-threading strategy.`;
  }

  return { text, confidence, actions };
}

/**
 * AE: At-Risk Deal Recommendation
 */
function getAEAtRiskDealRecommendation(data: any): Recommendation {
  const { daysSinceActivity, meddpiccScore, missingElements, stage, amount } = data;

  let text = '';
  let confidence = 0.85;
  const actions = [];

  // Stale deal
  if (daysSinceActivity > 21) {
    text = `URGENT: No activity for ${daysSinceActivity} days. Risk of deal going dark. `;
    text += `Schedule check-in call immediately to re-engage and understand current status.`;
    actions.push({
      type: 'call',
      priority: 'high' as const,
      description: `Call within 24 hours to re-engage`,
    });
    confidence = 0.95;
  } else if (daysSinceActivity > 14) {
    text = `Deal needs attention - ${daysSinceActivity} days since last activity. `;
    text += `Send recap email with next steps and schedule follow-up call.`;
    actions.push({
      type: 'email',
      priority: 'high' as const,
      description: 'Send recap with clear next steps',
    });
  }

  // Low MEDDPICC score
  if (meddpiccScore < 50) {
    text += ` MEDDPICC score critically low (${meddpiccScore}%). `;

    if (missingElements?.includes('Economic Buyer')) {
      text += `Missing Economic Buyer - schedule multi-threading call to reach decision maker. `;
      actions.push({
        type: 'call',
        priority: 'high' as const,
        description: 'Multi-threading call to identify Economic Buyer',
      });
    }

    if (missingElements?.includes('Champion')) {
      text += `No Champion identified - find internal advocate who will sell on your behalf. `;
      actions.push({
        type: 'meeting',
        priority: 'high' as const,
        description: 'Identify and cultivate Champion',
      });
    }

    if (missingElements?.includes('Decision Process')) {
      text += `Decision process unclear - ask Champion to map out approval steps and timeline. `;
    }
  } else if (meddpiccScore < 70) {
    text += ` MEDDPICC incomplete (${meddpiccScore}%). Update qualification criteria, especially ${missingElements?.[0] || 'missing elements'}.`;
    actions.push({
      type: 'update',
      priority: 'medium' as const,
      description: 'Complete MEDDPICC fields in Salesforce',
    });
  }

  // High-value deal at risk
  if (amount && amount > 200000) {
    text += ` High-value opportunity ($${(amount / 1000).toFixed(0)}K) - escalate to sales leadership for support.`;
    actions.push({
      type: 'escalate',
      priority: 'high' as const,
      description: 'Loop in sales leadership',
    });
  }

  return { text, confidence, actions };
}

/**
 * AM: Renewal Risk Recommendation
 */
function getAMRenewalRiskRecommendation(data: any): Recommendation {
  const { daysToRenewal, healthScore, riskFactors, contractValue } = data;

  let text = '';
  let confidence = 0.9;
  const actions = [];

  // Critical - less than 30 days
  if (daysToRenewal < 30 && healthScore < 60) {
    text = `CRITICAL: Renewal in ${daysToRenewal} days with ${healthScore}% health score. Immediate intervention required. `;
    text += `Schedule emergency QBR this week. Address all support escalations. Engage executive sponsor.`;
    confidence = 0.95;
    actions.push({
      type: 'qbr',
      priority: 'high' as const,
      description: 'Emergency QBR within 48 hours',
    });
    actions.push({
      type: 'escalation',
      priority: 'high' as const,
      description: 'Resolve all open support tickets',
    });
    actions.push({
      type: 'executive',
      priority: 'high' as const,
      description: 'Executive sponsor engagement',
    });
  }
  // Warning - 30-60 days
  else if (daysToRenewal < 60 && healthScore < 70) {
    text = `Renewal at risk: ${daysToRenewal} days out with ${healthScore}% health. `;
    text += `Schedule QBR to review value delivered, address concerns, and build renewal business case.`;
    actions.push({
      type: 'qbr',
      priority: 'high' as const,
      description: 'QBR scheduled within 2 weeks',
    });
    actions.push({
      type: 'value_review',
      priority: 'medium' as const,
      description: 'Prepare ROI report showing value delivered',
    });
  }

  // Risk factor specific guidance
  if (riskFactors?.includes('Champion left')) {
    text += ` Champion departure detected - identify and onboard new champion immediately. Research replacement.`;
    actions.push({
      type: 'research',
      priority: 'high' as const,
      description: 'Identify new champion/stakeholder',
    });
  }

  if (riskFactors?.includes('Usage down')) {
    text += ` Usage declining - investigate root cause. Offer training or new features to drive re-engagement.`;
    actions.push({
      type: 'training',
      priority: 'medium' as const,
      description: 'Offer product training session',
    });
  }

  // High-value renewal
  if (contractValue > 150000) {
    text += ` High-value renewal ($${(contractValue / 1000).toFixed(0)}K) - coordinate internal task force (CS + Support + AM).`;
  }

  return { text, confidence, actions };
}

/**
 * AM: Expansion Opportunity Recommendation
 */
function getAMExpansionRecommendation(data: any): Recommendation {
  const { healthScore, usagePercent, employeeGrowth, currentValue } = data;

  let text = '';
  let confidence = 0.85;
  const actions = [];

  if (healthScore > 80 && usagePercent > 80) {
    text = `Perfect expansion opportunity! Health at ${healthScore}% and using ${usagePercent}% of licenses. `;
    text += `Propose additional licenses now. Champion will advocate internally given strong results.`;
    confidence = 0.92;
    actions.push({
      type: 'proposal',
      priority: 'high' as const,
      description: 'Draft expansion business case',
    });
    actions.push({
      type: 'meeting',
      priority: 'high' as const,
      description: 'Schedule expansion discussion with champion',
    });
  } else if (healthScore > 75 && employeeGrowth > 15) {
    text = `Company growing rapidly (+${employeeGrowth}% employees). Proactively offer expansion for new hires. `;
    text += `Reference current success and growth trajectory in expansion pitch.`;
    actions.push({
      type: 'outreach',
      priority: 'medium' as const,
      description: 'Proactive expansion outreach',
    });
  }

  return { text, confidence, actions };
}

/**
 * CSM: Health Intervention Recommendation
 */
function getCSMHealthInterventionRecommendation(data: any): Recommendation {
  const { healthScore, healthTrend, riskFactors, daysSinceTouch } = data;

  let text = '';
  let confidence = 0.88;
  const actions = [];

  // Critical health
  if (healthScore < 40) {
    text = `CRITICAL health score (${healthScore}%). Create immediate intervention plan: `;
    text += `1) Schedule call this week 2) Address all support issues 3) Identify new executive sponsor 4) Create success plan with milestones.`;
    confidence = 0.95;
    actions.push({
      type: 'intervention_call',
      priority: 'high' as const,
      description: 'Health intervention call within 48 hours',
    });
    actions.push({
      type: 'support',
      priority: 'high' as const,
      description: 'Resolve all open support tickets',
    });
    actions.push({
      type: 'success_plan',
      priority: 'high' as const,
      description: 'Create 90-day success plan',
    });
  }
  // Declining health
  else if (healthTrend === 'declining' && healthScore < 70) {
    text = `Health declining (${healthScore}%, trend: down). Proactive intervention needed before it becomes critical. `;
    text += `Schedule check-in to understand issues. Review usage data to identify adoption gaps.`;
    actions.push({
      type: 'check_in',
      priority: 'high' as const,
      description: 'Proactive health check-in call',
    });
    actions.push({
      type: 'analysis',
      priority: 'medium' as const,
      description: 'Deep dive on usage data',
    });
  }

  // Specific risk factors
  if (riskFactors?.includes('No executive sponsor')) {
    text += ` Missing executive sponsor - critical gap. Identify and engage C-level stakeholder.`;
  }

  if (daysSinceTouch > 30) {
    text += ` Last touch ${daysSinceTouch} days ago - too long. Increase cadence to weekly/biweekly check-ins.`;
  }

  return { text, confidence, actions };
}

/**
 * CSM: Adoption Recommendation
 */
function getCSMAdoptionRecommendation(data: any): Recommendation {
  const { adoptionRate, mobileUsage, featureAdoption, industry } = data;

  let text = '';
  let confidence = 0.8;
  const actions = [];

  // Low mobile usage for mobile-first industries
  if (industry && ['Retail', 'Healthcare', 'Manufacturing', 'Hospitality'].includes(industry)) {
    if (mobileUsage < 30) {
      text = `${industry} account with only ${mobileUsage}% mobile usage - huge opportunity! `;
      text += `Run "Mobile Learning Week" campaign with frontline managers. Offer training session on mobile features.`;
      actions.push({
        type: 'campaign',
        priority: 'high' as const,
        description: 'Launch Mobile Learning campaign',
      });
      actions.push({
        type: 'training',
        priority: 'medium' as const,
        description: 'Mobile features training session',
      });
      confidence = 0.9;
    }
  }

  // Low overall adoption
  if (adoptionRate < 60) {
    text += `Adoption at ${adoptionRate}% - significant room for improvement. `;
    text += `Identify underutilized features. Create adoption playbook with champion. Set 30/60/90 day goals.`;
    actions.push({
      type: 'playbook',
      priority: 'medium' as const,
      description: 'Create feature adoption playbook',
    });
  }

  // Good adoption - expand usage
  if (adoptionRate > 80 && featureAdoption < 70) {
    text = `Strong adoption (${adoptionRate}%)! Expand to additional features. Showcase advanced capabilities in next touch.`;
    actions.push({
      type: 'upsell',
      priority: 'low' as const,
      description: 'Introduce advanced features',
    });
  }

  return { text, confidence, actions };
}

/**
 * Clear recommendation cache (call when data changes)
 */
export function clearRecommendationCache(recordId?: string): void {
  if (recordId) {
    // Clear cache for specific record
    for (const key of recommendationCache.keys()) {
      if (key.includes(recordId)) {
        recommendationCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    recommendationCache.clear();
  }
}
