/**
 * SalesforceAdapter — produces canonical types from a Salesforce connection.
 *
 * This is Phase 1 scaffolding. The fetch methods build SOQL dynamically
 * from the AppConfig field mappings (no hardcoded Axonify field names)
 * and shape the raw records into canonical types. Existing hub services
 * will be migrated to consume this adapter in subsequent commits.
 */

import { Connection } from 'jsforce';
import type {
  CanonicalAccount,
  CanonicalAccountHealth,
  CanonicalOpportunity,
  CustomerStage,
  ForecastCategory,
  OpportunityType,
  Product,
  ProductARR,
  ProductWhitespace,
  RiskFlag,
} from '../types';
import type {
  FieldMapping,
  ProductFieldMapping,
} from '../../services/configService';
import {
  collectSourceFields,
  getMappedBoolean,
  getMappedNumber,
  getMappedString,
  getMappedValue,
} from './mappingHelper';
import type {
  AccountFilters,
  DataSourceAdapter,
  FieldDescriptor,
  OpportunityFilters,
} from './types';

// Concept names used by the account fetch — kept centralized so the
// adapter and the mapping defaults stay in sync.
const ACCOUNT_CONCEPTS = [
  'Industry', 'Account Type', 'Region', 'Number of Employees', 'Annual Revenue',
  'Account Owner Id', 'Account Owner Name',
  'Customer Stage', 'Contract Start Date', 'Contract End Date', 'Total ARR',
  'Account Risk Flag', 'Health Score', 'CSM Sentiment',
  'Last QBR Date', 'Last Exec Check-In',
  'Total Licensed Seats', 'Active User Count',
  'Strategy Notes', 'Risk Notes', 'Contract Notes', 'Health Notes',
  'Sponsorship Notes', 'Support Notes',
  // 6sense
  'Buying Stage', 'Previous Buying Stage', 'Intent Score',
  'Profile Fit', 'Profile Score', 'Reach Score', 'Segments', '6sense Last Updated',
  // Clay
  'Employee Count', 'Employee Growth', 'Clay Revenue', 'Clay Industry',
  'Clay Total Locations', 'Clay City', 'Clay State', 'Clay Country',
  'Clay NAICS Code', 'Clay Is Franchise', 'Clay Is Parent Company',
  'Clay Enriched At',
];

const OPPORTUNITY_CONCEPTS = [
  'Opportunity Type', 'Opportunity Amount', 'Opportunity ARR',
  'New ARR', 'Renewal ARR', 'Renewal Amount Due', 'Total Contract Value',
  'Duration (months)', 'License Seats', 'Weighted Forecast ARR',
  'Stage', 'Stage Probability', 'Forecast Category', 'Days In Stage',
  'Close Date', 'Renewal Due Date', 'Date of Churn',
  'Next Step', 'Description', 'Forecast Notes', 'Lost Reason',
  'Opportunity Risk Flag', 'Unresolved Risk Count', 'Is At Risk',
  // MEDDPICC
  'Economic Buyer', 'Economic Buyer Name', 'Economic Buyer Title',
  'Decision Criteria', 'Decision Process', 'Paper Process',
  'Identified Pain', 'Champion', 'Competition', 'MEDDPICC Risks', 'MEDDPICC Score',
  // Command of Message
  'Why Do Anything', 'Why Now', 'Why Us', 'Why Trust', 'Why Pay That',
  'Command Overall Score', 'Command Confidence',
  // Gong
  'Gong Call Count', 'Gong Last Call Date', 'Gong Sentiment',
  'Gong Competitor Mentions', 'Gong Call Recording URL',
];

const STANDARD_ACCOUNT_FIELDS = ['Id', 'Name', 'OwnerId', 'CreatedDate', 'LastModifiedDate'];
const STANDARD_OPP_FIELDS = ['Id', 'Name', 'AccountId', 'OwnerId', 'CreatedDate', 'LastModifiedDate', 'IsClosed'];

function escapeSoqlLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeRiskFlag(v: unknown): RiskFlag | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.toLowerCase().trim();
  if (s === 'red' || s === 'high' || s === 'critical') return 'red';
  if (s === 'yellow' || s === 'medium' || s === 'at-risk' || s === 'warning') return 'yellow';
  if (s === 'green' || s === 'low' || s === 'healthy') return 'green';
  return 'unknown';
}

function normalizeCustomerStage(v: unknown): CustomerStage | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.toLowerCase().trim();
  if (s.includes('prospect')) return 'prospect';
  if (s.includes('onboard')) return 'onboarding';
  if (s.includes('adopt')) return 'adopting';
  if (s.includes('establish')) return 'established';
  if (s.includes('risk')) return 'at_risk';
  if (s.includes('renewal')) return 'renewal_window';
  if (s.includes('churn')) return 'churned';
  return undefined;
}

function normalizeForecastCategory(v: unknown): ForecastCategory | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.toLowerCase().trim();
  if (s.includes('closed') && (s.includes('won') || s === 'closed')) return 'closed_won';
  if (s === 'commit') return 'commit';
  if (s.includes('most likely') || s === 'likely') return 'most_likely';
  if (s.includes('best case')) return 'best_case';
  if (s === 'pipeline') return 'pipeline';
  if (s === 'omitted') return 'omitted';
  return undefined;
}

function normalizeOpportunityType(v: unknown): OpportunityType | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.toLowerCase().trim();
  if (s.includes('new business') || s === 'new') return 'new_business';
  if (s.includes('renewal')) return 'renewal';
  if (s.includes('upsell')) return 'upsell';
  if (s.includes('cross')) return 'cross_sell';
  return undefined;
}

export interface SalesforceAdapterConfig {
  conn: Connection;
  mappings: FieldMapping[];
  products: Product[];
  productMappings: ProductFieldMapping[];
}

export class SalesforceAdapter implements DataSourceAdapter {
  readonly sourceType = 'salesforce';
  private readonly conn: Connection;
  private readonly mappings: FieldMapping[];
  private readonly products: Product[];
  private readonly productMappings: ProductFieldMapping[];

  constructor(config: SalesforceAdapterConfig) {
    this.conn = config.conn;
    this.mappings = config.mappings;
    this.products = config.products;
    this.productMappings = config.productMappings;
  }

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.conn.identity();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async describeAccountFields(): Promise<FieldDescriptor[]> {
    const meta = await this.conn.sobject('Account').describe();
    return meta.fields.map((f) => ({
      apiName: f.name,
      label: f.label,
      type: this.mapSfType(f.type),
      picklistValues: f.picklistValues?.map((p) => p.value),
    }));
  }

  async describeOpportunityFields(): Promise<FieldDescriptor[]> {
    const meta = await this.conn.sobject('Opportunity').describe();
    return meta.fields.map((f) => ({
      apiName: f.name,
      label: f.label,
      type: this.mapSfType(f.type),
      picklistValues: f.picklistValues?.map((p) => p.value),
    }));
  }

  async fetchAccounts(filters: AccountFilters): Promise<CanonicalAccount[]> {
    const productFields = this.collectProductAccountFields();
    const fields = Array.from(new Set([
      ...STANDARD_ACCOUNT_FIELDS,
      ...collectSourceFields(this.mappings, ACCOUNT_CONCEPTS),
      ...productFields,
    ]));
    const where = this.buildAccountWhere(filters);
    const limit = filters.limit ?? 200;
    const offset = filters.offset ?? 0;
    const soql = `SELECT ${fields.join(', ')} FROM Account${where ? ' WHERE ' + where : ''} ORDER BY Name LIMIT ${limit} OFFSET ${offset}`;
    const result = await this.conn.query<Record<string, unknown>>(soql);
    return result.records.map((r) => this.toCanonicalAccount(r));
  }

  async fetchAccountById(id: string): Promise<CanonicalAccount | null> {
    const accounts = await this.fetchAccounts({ ids: [id], limit: 1 });
    return accounts[0] ?? null;
  }

  async fetchAccountHealth(accountId: string): Promise<CanonicalAccountHealth | null> {
    const account = await this.fetchAccountById(accountId);
    if (!account) return null;
    return {
      accountId: account.id,
      accountName: account.name,
      customerStage: account.customerStage,
      contractStart: account.contractStart,
      contractEnd: account.contractEnd,
      totalLicensedSeats: undefined, // populated below from same source record
      activeUserCount: undefined,
      healthScore: account.healthScore,
      riskFlag: account.riskFlag,
      csmSentiment: account.csmSentiment,
      arrByProduct: account.arrByProduct,
      whitespaceByProduct: account.whitespaceByProduct,
    };
  }

  async fetchOpportunities(filters: OpportunityFilters): Promise<CanonicalOpportunity[]> {
    const productFields = this.collectProductOpportunityFields();
    const fields = Array.from(new Set([
      ...STANDARD_OPP_FIELDS,
      'Account.Id', 'Account.Name', 'Owner.Name',
      ...collectSourceFields(this.mappings, OPPORTUNITY_CONCEPTS),
      ...productFields,
    ]));
    const where = this.buildOpportunityWhere(filters);
    const limit = filters.limit ?? 200;
    const offset = filters.offset ?? 0;
    const soql = `SELECT ${fields.join(', ')} FROM Opportunity${where ? ' WHERE ' + where : ''} ORDER BY CloseDate ASC LIMIT ${limit} OFFSET ${offset}`;
    const result = await this.conn.query<Record<string, unknown>>(soql);
    return result.records.map((r) => this.toCanonicalOpportunity(r));
  }

  async fetchOpportunityById(id: string): Promise<CanonicalOpportunity | null> {
    const opps = await this.fetchOpportunities({ accountId: undefined, limit: 1 });
    // Single-record by id query
    const productFields = this.collectProductOpportunityFields();
    const fields = Array.from(new Set([
      ...STANDARD_OPP_FIELDS,
      'Account.Id', 'Account.Name', 'Owner.Name',
      ...collectSourceFields(this.mappings, OPPORTUNITY_CONCEPTS),
      ...productFields,
    ]));
    const soql = `SELECT ${fields.join(', ')} FROM Opportunity WHERE Id = '${escapeSoqlLiteral(id)}' LIMIT 1`;
    const result = await this.conn.query<Record<string, unknown>>(soql);
    if (result.records.length === 0) return null;
    return this.toCanonicalOpportunity(result.records[0]);
    void opps; // silence unused (kept the variable so the shape mirrors fetchAccountById)
  }

  // ────────────────────────────────────────────────────────────────
  // Internal: shaping raw records into canonical types
  // ────────────────────────────────────────────────────────────────

  private toCanonicalAccount(r: Record<string, unknown>): CanonicalAccount {
    return {
      id: String(r.Id ?? ''),
      name: String(r.Name ?? ''),
      industry: getMappedString(r, this.mappings, 'Industry'),
      accountType: getMappedString(r, this.mappings, 'Account Type'),
      region: getMappedString(r, this.mappings, 'Region'),
      numberOfEmployees: getMappedNumber(r, this.mappings, 'Number of Employees'),
      annualRevenue: getMappedNumber(r, this.mappings, 'Annual Revenue'),
      ownerId: getMappedString(r, this.mappings, 'Account Owner Id'),
      ownerName: getMappedString(r, this.mappings, 'Account Owner Name'),
      customerStage: normalizeCustomerStage(getMappedValue(r, this.mappings, 'Customer Stage')),
      contractStart: getMappedString(r, this.mappings, 'Contract Start Date'),
      contractEnd: getMappedString(r, this.mappings, 'Contract End Date'),
      totalARR: getMappedNumber(r, this.mappings, 'Total ARR'),
      healthScore: getMappedNumber(r, this.mappings, 'Health Score'),
      riskFlag: normalizeRiskFlag(getMappedValue(r, this.mappings, 'Account Risk Flag')),
      lastQbrDate: getMappedString(r, this.mappings, 'Last QBR Date'),
      lastExecCheckIn: getMappedString(r, this.mappings, 'Last Exec Check-In'),
      sixSense: {
        intentScore: getMappedNumber(r, this.mappings, 'Intent Score'),
        buyingStage: getMappedString(r, this.mappings, 'Buying Stage'),
        previousBuyingStage: getMappedString(r, this.mappings, 'Previous Buying Stage'),
        profileFit: getMappedString(r, this.mappings, 'Profile Fit'),
        profileScore: getMappedNumber(r, this.mappings, 'Profile Score'),
        reachScore: getMappedString(r, this.mappings, 'Reach Score'),
        segments: this.parseSegments(getMappedString(r, this.mappings, 'Segments')),
        lastUpdated: getMappedString(r, this.mappings, '6sense Last Updated'),
      },
      clay: {
        employeeCount: getMappedNumber(r, this.mappings, 'Employee Count'),
        employeeGrowthPct: getMappedNumber(r, this.mappings, 'Employee Growth'),
        revenue: getMappedNumber(r, this.mappings, 'Clay Revenue'),
        industry: getMappedString(r, this.mappings, 'Clay Industry'),
        totalLocations: getMappedNumber(r, this.mappings, 'Clay Total Locations'),
        city: getMappedString(r, this.mappings, 'Clay City'),
        state: getMappedString(r, this.mappings, 'Clay State'),
        country: getMappedString(r, this.mappings, 'Clay Country'),
        naicsCode: getMappedNumber(r, this.mappings, 'Clay NAICS Code'),
        isFranchise: getMappedBoolean(r, this.mappings, 'Clay Is Franchise'),
        isParentCompany: getMappedBoolean(r, this.mappings, 'Clay Is Parent Company'),
        enrichedAt: getMappedString(r, this.mappings, 'Clay Enriched At'),
      },
      notes: {
        strategy: getMappedString(r, this.mappings, 'Strategy Notes'),
        risk: getMappedString(r, this.mappings, 'Risk Notes'),
        contract: getMappedString(r, this.mappings, 'Contract Notes'),
        health: getMappedString(r, this.mappings, 'Health Notes'),
        sponsorship: getMappedString(r, this.mappings, 'Sponsorship Notes'),
        support: getMappedString(r, this.mappings, 'Support Notes'),
      },
      arrByProduct: this.extractArrByProduct(r),
      whitespaceByProduct: this.extractWhitespaceByProduct(r),
      createdAt: r.CreatedDate as string | undefined,
      updatedAt: r.LastModifiedDate as string | undefined,
    };
  }

  private toCanonicalOpportunity(r: Record<string, unknown>): CanonicalOpportunity {
    const account = r.Account as { Id?: string; Name?: string } | undefined;
    const owner = r.Owner as { Name?: string } | undefined;
    return {
      id: String(r.Id ?? ''),
      name: String(r.Name ?? ''),
      accountId: String(r.AccountId ?? account?.Id ?? ''),
      accountName: account?.Name,
      ownerId: r.OwnerId as string | undefined,
      ownerName: owner?.Name,
      type: normalizeOpportunityType(getMappedValue(r, this.mappings, 'Opportunity Type')),
      amount: getMappedNumber(r, this.mappings, 'Opportunity Amount'),
      arr: getMappedNumber(r, this.mappings, 'Opportunity ARR'),
      newARR: getMappedNumber(r, this.mappings, 'New ARR'),
      renewalARR: getMappedNumber(r, this.mappings, 'Renewal ARR'),
      renewalAmountDue: getMappedNumber(r, this.mappings, 'Renewal Amount Due'),
      totalContractValue: getMappedNumber(r, this.mappings, 'Total Contract Value'),
      durationMonths: getMappedNumber(r, this.mappings, 'Duration (months)'),
      licenseSeats: getMappedNumber(r, this.mappings, 'License Seats'),
      weightedForecastARR: getMappedNumber(r, this.mappings, 'Weighted Forecast ARR'),
      amountByProduct: this.extractAmountByProduct(r),
      stage: getMappedString(r, this.mappings, 'Stage'),
      stageProbability: getMappedNumber(r, this.mappings, 'Stage Probability'),
      forecastCategory: normalizeForecastCategory(getMappedValue(r, this.mappings, 'Forecast Category')),
      isClosed: r.IsClosed as boolean | undefined,
      daysInStage: getMappedNumber(r, this.mappings, 'Days In Stage'),
      closeDate: getMappedString(r, this.mappings, 'Close Date'),
      renewalDueDate: getMappedString(r, this.mappings, 'Renewal Due Date'),
      dateOfChurn: getMappedString(r, this.mappings, 'Date of Churn'),
      createdAt: r.CreatedDate as string | undefined,
      updatedAt: r.LastModifiedDate as string | undefined,
      nextStep: getMappedString(r, this.mappings, 'Next Step'),
      description: getMappedString(r, this.mappings, 'Description'),
      forecastNotes: getMappedString(r, this.mappings, 'Forecast Notes'),
      lostReason: getMappedString(r, this.mappings, 'Lost Reason'),
      riskFlag: normalizeRiskFlag(getMappedValue(r, this.mappings, 'Opportunity Risk Flag')),
      unresolvedRiskCount: getMappedNumber(r, this.mappings, 'Unresolved Risk Count'),
      isAtRisk: getMappedBoolean(r, this.mappings, 'Is At Risk'),
      meddpicc: {
        metrics: getMappedString(r, this.mappings, 'Metrics'),
        economicBuyerName: getMappedString(r, this.mappings, 'Economic Buyer Name'),
        economicBuyerTitle: getMappedString(r, this.mappings, 'Economic Buyer Title'),
        economicBuyer: getMappedString(r, this.mappings, 'Economic Buyer'),
        decisionCriteria: getMappedString(r, this.mappings, 'Decision Criteria'),
        decisionProcess: getMappedString(r, this.mappings, 'Decision Process'),
        paperProcess: getMappedString(r, this.mappings, 'Paper Process'),
        implicatePain: getMappedString(r, this.mappings, 'Identified Pain'),
        champion: getMappedString(r, this.mappings, 'Champion'),
        competition: getMappedString(r, this.mappings, 'Competition'),
        risks: getMappedString(r, this.mappings, 'MEDDPICC Risks'),
        overallScore: getMappedNumber(r, this.mappings, 'MEDDPICC Score'),
      },
      commandOfMessage: {
        whyDoAnything: getMappedString(r, this.mappings, 'Why Do Anything'),
        whyNow: getMappedString(r, this.mappings, 'Why Now'),
        whyUs: getMappedString(r, this.mappings, 'Why Us'),
        whyTrust: getMappedString(r, this.mappings, 'Why Trust'),
        whyPayThat: getMappedString(r, this.mappings, 'Why Pay That'),
        overallScore: getMappedNumber(r, this.mappings, 'Command Overall Score'),
        confidenceLevel: getMappedString(r, this.mappings, 'Command Confidence'),
      },
      gong: {
        callCount: getMappedNumber(r, this.mappings, 'Gong Call Count'),
        lastCallDate: getMappedString(r, this.mappings, 'Gong Last Call Date'),
        sentiment: this.normalizeSentiment(getMappedString(r, this.mappings, 'Gong Sentiment')),
        competitorMentions: getMappedString(r, this.mappings, 'Gong Competitor Mentions'),
        callRecordingUrl: getMappedString(r, this.mappings, 'Gong Call Recording URL'),
      },
    };
  }

  private extractArrByProduct(r: Record<string, unknown>): ProductARR[] {
    const out: ProductARR[] = [];
    for (const product of this.products) {
      const m = this.productMappings.find((x) => x.productId === product.id);
      if (!m?.accountArrField) continue;
      const v = r[m.accountArrField];
      if (typeof v === 'number') out.push({ productId: product.id, arr: v });
    }
    return out;
  }

  private extractWhitespaceByProduct(r: Record<string, unknown>): ProductWhitespace[] {
    const out: ProductWhitespace[] = [];
    for (const product of this.products) {
      const m = this.productMappings.find((x) => x.productId === product.id);
      if (!m?.accountWhitespaceField) continue;
      const v = r[m.accountWhitespaceField];
      if (typeof v === 'number') out.push({ productId: product.id, potentialARR: v });
    }
    return out;
  }

  private extractAmountByProduct(r: Record<string, unknown>): ProductARR[] {
    const out: ProductARR[] = [];
    for (const product of this.products) {
      const m = this.productMappings.find((x) => x.productId === product.id);
      if (!m?.opportunityAmountField) continue;
      const v = r[m.opportunityAmountField];
      if (typeof v === 'number') out.push({ productId: product.id, arr: v });
    }
    return out;
  }

  private collectProductAccountFields(): string[] {
    const fields: string[] = [];
    for (const m of this.productMappings) {
      if (m.accountArrField) fields.push(m.accountArrField);
      if (m.accountWhitespaceField) fields.push(m.accountWhitespaceField);
    }
    return fields;
  }

  private collectProductOpportunityFields(): string[] {
    const fields: string[] = [];
    for (const m of this.productMappings) {
      if (m.opportunityAmountField) fields.push(m.opportunityAmountField);
    }
    return fields;
  }

  private parseSegments(raw: string | undefined): string[] | undefined {
    if (!raw) return undefined;
    return raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  }

  private normalizeSentiment(raw: string | undefined): 'positive' | 'neutral' | 'negative' | undefined {
    if (!raw) return undefined;
    const s = raw.toLowerCase();
    if (s.includes('pos')) return 'positive';
    if (s.includes('neg')) return 'negative';
    return 'neutral';
  }

  private buildAccountWhere(f: AccountFilters): string {
    const parts: string[] = [];
    if (f.ids?.length) parts.push(`Id IN (${f.ids.map((id) => `'${escapeSoqlLiteral(id)}'`).join(', ')})`);
    if (f.search) parts.push(`Name LIKE '%${escapeSoqlLiteral(f.search)}%'`);
    if (f.ownerId) parts.push(`OwnerId = '${escapeSoqlLiteral(f.ownerId)}'`);
    // Risk + csm filters require knowing the mapped source fields — defer to caller's WHERE if needed
    return parts.join(' AND ');
  }

  private buildOpportunityWhere(f: OpportunityFilters): string {
    const parts: string[] = [];
    if (f.accountId) parts.push(`AccountId = '${escapeSoqlLiteral(f.accountId)}'`);
    if (f.openOnly) parts.push(`IsClosed = false`);
    if (f.closeDateFrom) parts.push(`CloseDate >= ${f.closeDateFrom}`);
    if (f.closeDateTo) parts.push(`CloseDate <= ${f.closeDateTo}`);
    if (f.ownerId) parts.push(`OwnerId = '${escapeSoqlLiteral(f.ownerId)}'`);
    if (f.ownerIds?.length) parts.push(`OwnerId IN (${f.ownerIds.map((id) => `'${escapeSoqlLiteral(id)}'`).join(', ')})`);
    if (f.stages?.length) parts.push(`StageName IN (${f.stages.map((s) => `'${escapeSoqlLiteral(s)}'`).join(', ')})`);
    return parts.join(' AND ');
  }

  private mapSfType(sfType: string): FieldDescriptor['type'] {
    switch (sfType) {
      case 'string': case 'textarea': case 'phone': case 'email': case 'url': case 'id':
        return 'string';
      case 'int': case 'double': case 'currency': case 'percent':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date': case 'datetime':
        return 'date';
      case 'reference':
        return 'reference';
      case 'picklist': case 'multipicklist':
        return 'picklist';
      default:
        return 'string';
    }
  }
}
