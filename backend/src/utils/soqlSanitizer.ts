/**
 * SOQL Sanitization Utility
 *
 * Prevents SOQL injection by escaping user-provided values
 * before they are interpolated into SOQL queries.
 */

/**
 * Escape a string value for safe use in SOQL queries.
 * - Escapes single quotes (' → \')
 * - Escapes backslashes (\ → \\)
 * - Strips null bytes
 */
export function escapeSoqlValue(value: string): string {
  if (typeof value !== 'string') {
    return String(value);
  }
  return value
    .replace(/\0/g, '')       // strip null bytes
    .replace(/\\/g, '\\\\')   // escape backslashes first
    .replace(/'/g, "\\'");     // escape single quotes
}

/**
 * Escape a string for use in SOQL LIKE clauses.
 * Escapes the LIKE wildcards (% and _) in addition to standard escaping.
 */
export function escapeSoqlLike(value: string): string {
  if (typeof value !== 'string') {
    return String(value);
  }
  const escaped = escapeSoqlValue(value);
  return escaped
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Validate that a field name matches Salesforce naming conventions.
 * Allows standard fields, relationship fields (e.g., Account.Name),
 * and custom fields (ending in __c or __r).
 *
 * Returns true if valid, false otherwise.
 */
export function validateFieldName(field: string): boolean {
  if (!field || typeof field !== 'string') return false;
  // Matches: FieldName, Namespace__FieldName__c, Account.Name, Owner.Name, etc.
  return /^[a-zA-Z_]\w*(\.\w+)?(__[cr])?$/.test(field);
}

/**
 * Validate a Salesforce object type name.
 */
export function validateObjectType(objectType: string): boolean {
  if (!objectType || typeof objectType !== 'string') return false;
  return /^[a-zA-Z_]\w*(__c)?$/.test(objectType);
}
