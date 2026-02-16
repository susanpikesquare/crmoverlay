/**
 * Filter Types for SOQL Query Builder
 *
 * Defines structured types for server-side filtering, scoping, and sorting
 * that mirror Salesforce report-style capabilities.
 */

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'lt'
  | 'gt'
  | 'lte'
  | 'gte'
  | 'contains'
  | 'in'
  | 'not_in'
  | 'between';

export type OwnershipScope = 'my' | 'team' | 'all';

export interface FilterCriteria {
  field: string;
  operator: FilterOperator;
  value: string | number | string[];
}

export interface ListQueryParams {
  scope?: OwnershipScope;
  filters?: FilterCriteria[];
  search?: string;
  sortField?: string;
  sortDir?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  listViewId?: string;
}

export interface ScopeDefaults {
  ae: OwnershipScope;
  am: OwnershipScope;
  csm: OwnershipScope;
  'sales-leader': OwnershipScope;
  executive: OwnershipScope;
  unknown: OwnershipScope;
}
