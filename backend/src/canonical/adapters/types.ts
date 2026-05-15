/**
 * DataSourceAdapter interface.
 *
 * Every data source the app can pull from (Salesforce, CSV upload, future
 * HubSpot/Pipedrive/etc.) implements this interface. Downstream services
 * (hubData, salesforceData callers, etc.) consume only canonical types,
 * never raw source records.
 *
 * Adapters are stateless per request — construct with the relevant config
 * (mapping table, connection, etc.), then call the fetch methods.
 */

import type {
  CanonicalAccount,
  CanonicalAccountHealth,
  CanonicalOpportunity,
} from '../types';

export interface OpportunityFilters {
  /** Account ID — restrict to opportunities belonging to this account. */
  accountId?: string;
  /** Stage filter (canonical stage names). */
  stages?: string[];
  /** Open-only flag. */
  openOnly?: boolean;
  /** Close-date range (ISO yyyy-mm-dd). */
  closeDateFrom?: string;
  closeDateTo?: string;
  /** Owner / manager / region filters. */
  ownerId?: string;
  ownerIds?: string[];
  /** Limit + offset for paging. */
  limit?: number;
  offset?: number;
}

export interface AccountFilters {
  /** Account name search (substring). */
  search?: string;
  /** Filter to a specific set of account IDs. */
  ids?: string[];
  /** Owner / CSM filter. */
  ownerId?: string;
  csmId?: string;
  /** Risk filter. */
  riskFlag?: 'red' | 'yellow' | 'green';
  /** Limit + offset for paging. */
  limit?: number;
  offset?: number;
}

/**
 * Descriptor for a field exposed by the data source, used to populate the
 * field-mapping picker in the admin UI.
 */
export interface FieldDescriptor {
  apiName: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'reference' | 'picklist';
  picklistValues?: string[];
  /** Whether this field is available to the current user given FLS. */
  accessible?: boolean;
}

export interface DataSourceAdapter {
  /** Stable identifier for the source ('salesforce', 'csv', etc.). */
  readonly sourceType: string;

  /** Sanity check that the connection (or file) is usable. */
  healthCheck(): Promise<{ ok: boolean; message?: string }>;

  /** Schema introspection — feeds the admin field-mapping picker. */
  describeAccountFields(): Promise<FieldDescriptor[]>;
  describeOpportunityFields(): Promise<FieldDescriptor[]>;

  /** Canonical-shape fetches. */
  fetchAccounts(filters: AccountFilters): Promise<CanonicalAccount[]>;
  fetchAccountById(id: string): Promise<CanonicalAccount | null>;
  fetchAccountHealth(accountId: string): Promise<CanonicalAccountHealth | null>;
  fetchOpportunities(filters: OpportunityFilters): Promise<CanonicalOpportunity[]>;
  fetchOpportunityById(id: string): Promise<CanonicalOpportunity | null>;
}
