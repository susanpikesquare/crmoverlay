/**
 * Canonical data model — the tenant-agnostic shape that every adapter
 * (Salesforce, CSV, HubSpot, etc.) produces and every downstream service consumes.
 *
 * Design rules:
 * - camelCase, no `__c` suffixes, no source-system field names.
 * - No tenant- or product-line-specific fields (e.g. Axonify "Learn"/"Max" SKUs).
 *   Per-product data goes through the `Product` abstraction.
 * - Universal CRM/SaaS concepts only. If a field doesn't apply to most B2B
 *   companies, it doesn't belong here.
 * - 3rd-party intelligence (6sense intent, Clay enrichment, Gong call data) is
 *   universal — kept as first-class optional fields.
 * - All optional fields are nullable/undefined when not provided by the source.
 */

// ────────────────────────────────────────────────────────────────────
// Shared enums
// ────────────────────────────────────────────────────────────────────

export type RiskFlag = 'red' | 'yellow' | 'green' | 'unknown';

export type ForecastCategory =
  | 'closed_won'
  | 'commit'
  | 'most_likely'
  | 'best_case'
  | 'pipeline'
  | 'omitted';

export type OpportunityType = 'new_business' | 'renewal' | 'upsell' | 'cross_sell';

export type CustomerStage =
  | 'prospect'
  | 'onboarding'
  | 'adopting'
  | 'established'
  | 'at_risk'
  | 'renewal_window'
  | 'churned';

// ────────────────────────────────────────────────────────────────────
// Products (tenant-defined)
//
// Each tenant configures the products they sell. Replaces hardcoded SKU
// columns like Learn_Whitespace__c, Active_Users_Max__c, etc.
// Stored on CustomerConfig (Phase 1) and referenced by id.
// ────────────────────────────────────────────────────────────────────

export interface Product {
  /** Tenant-defined stable identifier — e.g. "learn", "marketing-hub-pro". */
  id: string;
  /** Display name. */
  name: string;
  /** Optional grouping (e.g. "Suite", "Add-on") for views that want it. */
  category?: string;
}

export interface ProductARR {
  productId: string;
  arr: number;
}

export interface ProductWhitespace {
  productId: string;
  /** Estimated unrealized ARR for this product on this account. */
  potentialARR: number;
}

// ────────────────────────────────────────────────────────────────────
// Account
// ────────────────────────────────────────────────────────────────────

export interface CanonicalAccount {
  // Identity
  id: string;
  name: string;
  industry?: string;
  region?: string;
  accountType?: string;
  numberOfEmployees?: number;
  annualRevenue?: number;

  // Ownership
  ownerName?: string;
  ownerId?: string;
  csmName?: string;
  csmId?: string;

  // Contract / commercial
  customerStage?: CustomerStage;
  contractStart?: string;   // ISO date
  contractEnd?: string;     // ISO date
  totalARR?: number;
  totalLicensedSeats?: number;
  activeUserCount?: number;
  arrByProduct?: ProductARR[];

  // Expansion opportunity
  whitespaceByProduct?: ProductWhitespace[];
  totalWhitespace?: number;     // sum across products

  // Universal health signals
  healthScore?: number;          // 0-100, source-agnostic (Gainsight, custom, etc.)
  riskFlag?: RiskFlag;
  csmSentiment?: 'positive' | 'neutral' | 'cautious' | 'negative';
  lastQbrDate?: string;
  lastExecCheckIn?: string;

  // 3rd-party intelligence (universal across B2B SaaS)
  sixSense?: SixSenseSignals;
  clay?: ClayEnrichment;

  // Free-text commentary fields (universal concept; CSMs always have notes)
  notes?: AccountNotes;

  // Audit
  createdAt?: string;
  updatedAt?: string;
}

export interface SixSenseSignals {
  intentScore?: number;             // 0-100
  buyingStage?: string;             // 'Awareness' | 'Consideration' | ...
  previousBuyingStage?: string;
  profileFit?: string;              // tenant-specific labels OK here
  profileScore?: number;
  reachScore?: string;
  segments?: string[];
  lastUpdated?: string;
}

export interface ClayEnrichment {
  employeeCount?: number;
  employeeGrowthPct?: number;
  revenue?: number;
  industry?: string;
  totalLocations?: number;
  city?: string;
  state?: string;
  country?: string;
  naicsCode?: number;
  isFranchise?: boolean;
  isParentCompany?: boolean;
  enrichedAt?: string;
}

export interface AccountNotes {
  strategy?: string;
  risk?: string;
  contract?: string;
  health?: string;
  sponsorship?: string;
  support?: string;
}

// ────────────────────────────────────────────────────────────────────
// Account Health — detail view (Account 360 detail page)
//
// Universal customer-health concepts only. Per-product engagement metrics
// (Axonify license utilization, participation, frequency) are intentionally
// dropped — they don't generalize to non-Axonify tenants and the user
// confirmed dropping them entirely.
// ────────────────────────────────────────────────────────────────────

export interface CanonicalAccountHealth {
  accountId: string;
  accountName: string;

  // Identity / contract
  customerStage?: CustomerStage;
  contractStart?: string;
  contractEnd?: string;
  totalLicensedSeats?: number;
  activeUserCount?: number;

  // Health scoring
  healthScore?: number;
  riskFlag?: RiskFlag;
  riskFlagSecondary?: RiskFlag;
  overallRiskLabel?: string;
  csmSentiment?: 'positive' | 'neutral' | 'cautious' | 'negative';
  csmSentimentNotes?: string;
  csInsights?: string;
  riskNotes?: string;

  // Commercial breakdown
  arrByProduct?: ProductARR[];
  whitespaceByProduct?: ProductWhitespace[];

  // Business context
  businessObjectives?: string;
}

// ────────────────────────────────────────────────────────────────────
// Opportunity
// ────────────────────────────────────────────────────────────────────

export interface CanonicalOpportunity {
  // Identity
  id: string;
  name: string;
  accountId?: string;
  accountName?: string;

  // Ownership
  ownerId?: string;
  ownerName?: string;
  managerName?: string;
  vpName?: string;

  // Commercial
  type?: OpportunityType;
  amount?: number;
  arr?: number;
  newARR?: number;
  renewalARR?: number;
  renewalAmountDue?: number;
  totalContractValue?: number;
  durationMonths?: number;
  licenseSeats?: number;
  weightedForecastARR?: number;

  // Per-product breakdown (used when porting Account 360 features)
  amountByProduct?: ProductARR[];

  // Pipeline state
  stage?: string;
  stageProbability?: number;
  forecastCategory?: ForecastCategory;
  isClosed?: boolean;
  daysInStage?: number;

  // Dates
  closeDate?: string;
  renewalDueDate?: string;
  dateOfChurn?: string;
  createdAt?: string;
  updatedAt?: string;

  // Notes / coaching
  nextStep?: string;
  description?: string;
  forecastNotes?: string;
  lostReason?: string;
  lostNotes?: string;

  // Risk
  riskFlag?: RiskFlag;
  unresolvedRiskCount?: number;
  isAtRisk?: boolean;

  // MEDDPICC qualification
  meddpicc?: MeddpiccFields;

  // Command of the Message (universal sales framework, not Axonify-specific)
  commandOfMessage?: CommandOfMessageFields;

  // Gong call insights (universal — applies to any company using Gong)
  gong?: GongOpportunityInsights;

  // Account context rolled onto the opp row
  industry?: string;
  region?: string;
}

export interface MeddpiccFields {
  metrics?: string;
  economicBuyerName?: string;
  economicBuyerTitle?: string;
  economicBuyer?: string;       // free-text from MEDDPICCR_Economic_Buyer
  decisionCriteria?: string;
  decisionProcess?: string;
  paperProcess?: string;
  implicatePain?: string;
  champion?: string;
  competition?: string;
  risks?: string;
  overallScore?: number;
}

export interface CommandOfMessageFields {
  whyDoAnything?: string;
  whyNow?: string;
  whyUs?: string;
  whyTrust?: string;
  whyPayThat?: string;
  overallScore?: number;
  confidenceLevel?: string;
  lastUpdated?: string;
}

export interface GongOpportunityInsights {
  callCount?: number;
  lastCallDate?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  competitorMentions?: string;
  callRecordingUrl?: string;
}

// ────────────────────────────────────────────────────────────────────
// Computed aggregates
// ────────────────────────────────────────────────────────────────────

export interface PipelineSummary {
  closedWonARR: number;
  commitARR: number;
  mostLikelyARR: number;
  bestCaseARR: number;
  pipelineARR: number;
  omittedARR: number;
  weightedARR: number;
  count: number;
}

export interface RenewalSummary {
  totalRenewalARR: number;
  closedWonARR: number;
  closedLostARR: number;
  inForecastARR: number;
  openPipelineARR: number;
  churnedARR: number;
  newARRTotal: number;
  netARR: number;
  count: number;
}
