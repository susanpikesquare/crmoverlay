/**
 * Field-mapping lookup helpers shared by every adapter.
 *
 * Adapters use `getMappedValue` to read a canonical concept from a raw
 * source record. The mapping table (AppConfig.fieldMappings) declares
 * which source field name to use for each canonical concept; this helper
 * indirects through it so the rest of the adapter code is source-agnostic.
 */

import type { FieldMapping, ProductFieldMapping } from '../../services/configService';

/**
 * Look up the source field name for a canonical concept and read the
 * value from a raw source record.
 *
 * Returns undefined if no mapping exists, the mapping has no source field,
 * or the record doesn't carry that field.
 */
export function getMappedValue<T = unknown>(
  record: Record<string, unknown>,
  mappings: FieldMapping[],
  conceptName: string,
): T | undefined {
  const m = mappings.find((x) => x.conceptName === conceptName);
  if (!m || !m.salesforceField) return undefined;
  const v = record[m.salesforceField];
  return v as T | undefined;
}

export function getMappedString(
  record: Record<string, unknown>,
  mappings: FieldMapping[],
  conceptName: string,
): string | undefined {
  const v = getMappedValue<unknown>(record, mappings, conceptName);
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  return String(v);
}

export function getMappedNumber(
  record: Record<string, unknown>,
  mappings: FieldMapping[],
  conceptName: string,
): number | undefined {
  const v = getMappedValue<unknown>(record, mappings, conceptName);
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function getMappedBoolean(
  record: Record<string, unknown>,
  mappings: FieldMapping[],
  conceptName: string,
): boolean | undefined {
  const v = getMappedValue<unknown>(record, mappings, conceptName);
  if (v == null) return undefined;
  return Boolean(v);
}

/**
 * Returns the set of source field API names to include in a SELECT for
 * the given list of canonical concepts. Concepts without a mapping or
 * with `salesforceField: null` are skipped — adapters should NOT throw
 * if a concept isn't mapped; the corresponding canonical field will
 * simply be undefined.
 */
export function collectSourceFields(
  mappings: FieldMapping[],
  conceptNames: string[],
): string[] {
  const fields = new Set<string>();
  for (const concept of conceptNames) {
    const m = mappings.find((x) => x.conceptName === concept);
    if (m?.salesforceField) fields.add(m.salesforceField);
  }
  return Array.from(fields);
}

/**
 * Look up per-product source fields for the given product id.
 */
export function getProductMapping(
  productMappings: ProductFieldMapping[],
  productId: string,
): ProductFieldMapping | undefined {
  return productMappings.find((m) => m.productId === productId);
}
