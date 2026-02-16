/**
 * SOQL Query Builder Service
 *
 * Constructs safe, parameterized SOQL queries from structured criteria.
 * Replaces raw template string interpolation with escaped, validated inputs.
 */

import { escapeSoqlValue, escapeSoqlLike, validateFieldName } from '../utils/soqlSanitizer';
import { FilterCriteria, ListQueryParams, FilterOperator } from '../types/filters';

export class QueryBuilder {
  private selectFields: string[] = [];
  private fromObject: string = '';
  private whereClauses: string[] = [];
  private orderByClause: string = '';
  private limitValue: number | null = null;
  private offsetValue: number | null = null;

  constructor(objectType: string) {
    this.fromObject = objectType;
  }

  /**
   * Set the fields to select
   */
  select(fields: string[]): QueryBuilder {
    this.selectFields = fields;
    return this;
  }

  /**
   * Add an ownership scope filter.
   * @param ownerIds - Array of user IDs to filter by OwnerId, or null for no filter (all).
   */
  withScope(ownerIds: string[] | null): QueryBuilder {
    if (ownerIds === null || ownerIds.length === 0) {
      return this; // 'all' scope — no OwnerId filter
    }
    if (ownerIds.length === 1) {
      this.whereClauses.push(`OwnerId = '${escapeSoqlValue(ownerIds[0])}'`);
    } else {
      const idList = ownerIds.map(id => `'${escapeSoqlValue(id)}'`).join(', ');
      this.whereClauses.push(`OwnerId IN (${idList})`);
    }
    return this;
  }

  /**
   * Apply structured filter criteria
   */
  withFilters(filters: FilterCriteria[]): QueryBuilder {
    for (const filter of filters) {
      if (!validateFieldName(filter.field)) {
        throw new Error(`Invalid field name: ${filter.field}`);
      }
      const clause = this.buildFilterClause(filter);
      if (clause) {
        this.whereClauses.push(clause);
      }
    }
    return this;
  }

  /**
   * Add a text search across multiple fields using LIKE
   */
  withSearch(searchTerm: string, fields: string[]): QueryBuilder {
    if (!searchTerm || searchTerm.trim().length === 0) return this;
    const escaped = escapeSoqlLike(searchTerm.trim());
    const likes = fields
      .filter(f => validateFieldName(f))
      .map(f => `${f} LIKE '%${escaped}%'`);
    if (likes.length > 0) {
      this.whereClauses.push(`(${likes.join(' OR ')})`);
    }
    return this;
  }

  /**
   * Add a raw WHERE clause (for complex conditions that can't be expressed via filters)
   */
  withWhere(clause: string): QueryBuilder {
    if (clause && clause.trim()) {
      this.whereClauses.push(clause);
    }
    return this;
  }

  /**
   * Set sort order
   */
  withSort(field: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    if (field && validateFieldName(field)) {
      this.orderByClause = `${field} ${direction}`;
    }
    return this;
  }

  /**
   * Set pagination
   */
  withPagination(limit?: number, offset?: number): QueryBuilder {
    if (limit !== undefined && limit > 0) {
      this.limitValue = Math.min(limit, 2000); // SF max
    }
    if (offset !== undefined && offset > 0) {
      this.offsetValue = offset;
    }
    return this;
  }

  /**
   * Strip fields from SELECT that the user doesn't have access to
   */
  withAccessibleFieldsOnly(accessibleFields: Set<string>): QueryBuilder {
    this.selectFields = this.selectFields.filter(field => {
      // Always keep relationship fields (Account.Name) and standard Id
      if (field.includes('.') || field === 'Id') return true;
      return accessibleFields.has(field);
    });
    return this;
  }

  /**
   * Build the final SOQL query string
   */
  build(): string {
    if (this.selectFields.length === 0) {
      throw new Error('No fields selected for query');
    }
    if (!this.fromObject) {
      throw new Error('No object type specified');
    }

    let query = `SELECT ${this.selectFields.join(', ')} FROM ${this.fromObject}`;

    if (this.whereClauses.length > 0) {
      query += ` WHERE ${this.whereClauses.join(' AND ')}`;
    }

    if (this.orderByClause) {
      query += ` ORDER BY ${this.orderByClause}`;
    }

    if (this.limitValue !== null) {
      query += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== null) {
      query += ` OFFSET ${this.offsetValue}`;
    }

    return query;
  }

  /**
   * Convenience: build query from ListQueryParams
   */
  static fromParams(
    objectType: string,
    fields: string[],
    params: ListQueryParams,
    searchFields: string[],
    ownerIds: string[] | null
  ): string {
    const builder = new QueryBuilder(objectType)
      .select(fields)
      .withScope(ownerIds);

    if (params.filters && params.filters.length > 0) {
      builder.withFilters(params.filters);
    }

    if (params.search) {
      builder.withSearch(params.search, searchFields);
    }

    if (params.sortField) {
      builder.withSort(params.sortField, params.sortDir || 'ASC');
    }

    builder.withPagination(params.limit, params.offset);

    return builder.build();
  }

  /**
   * Convert a single FilterCriteria into a SOQL WHERE clause fragment
   */
  private buildFilterClause(filter: FilterCriteria): string {
    const { field, operator, value } = filter;

    switch (operator as FilterOperator) {
      case 'eq':
        return `${field} = ${this.formatValue(value)}`;
      case 'neq':
        return `${field} != ${this.formatValue(value)}`;
      case 'lt':
        return `${field} < ${this.formatValue(value)}`;
      case 'gt':
        return `${field} > ${this.formatValue(value)}`;
      case 'lte':
        return `${field} <= ${this.formatValue(value)}`;
      case 'gte':
        return `${field} >= ${this.formatValue(value)}`;
      case 'contains':
        return `${field} LIKE '%${escapeSoqlLike(String(value))}%'`;
      case 'in': {
        const values = Array.isArray(value) ? value : [value];
        const formatted = values.map(v => this.formatValue(v)).join(', ');
        return `${field} IN (${formatted})`;
      }
      case 'not_in': {
        const vals = Array.isArray(value) ? value : [value];
        const formattedVals = vals.map(v => this.formatValue(v)).join(', ');
        return `${field} NOT IN (${formattedVals})`;
      }
      case 'between': {
        if (Array.isArray(value) && value.length === 2) {
          return `${field} >= ${this.formatValue(value[0])} AND ${field} <= ${this.formatValue(value[1])}`;
        }
        return '';
      }
      default:
        return '';
    }
  }

  /**
   * Format a value for SOQL (string → quoted/escaped, number → raw)
   */
  private formatValue(value: string | number | string[]): string {
    if (typeof value === 'number') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map(v => this.formatValue(v)).join(', ');
    }
    return `'${escapeSoqlValue(String(value))}'`;
  }
}
