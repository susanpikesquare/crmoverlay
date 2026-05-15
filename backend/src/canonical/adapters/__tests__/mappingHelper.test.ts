import {
  collectSourceFields,
  getMappedBoolean,
  getMappedNumber,
  getMappedString,
  getMappedValue,
  getProductMapping,
} from '../mappingHelper';
import type { FieldMapping, ProductFieldMapping } from '../../../services/configService';

const mappings: FieldMapping[] = [
  { conceptName: 'Industry', category: 'account', salesforceField: 'Industry', calculateInApp: false },
  { conceptName: 'Total ARR', category: 'account', salesforceField: 'Total_ARR__c', calculateInApp: false },
  { conceptName: 'Health Score', category: 'health', salesforceField: 'Current_Gainsight_Score__c', calculateInApp: false },
  { conceptName: 'Computed Score', category: 'opportunity', salesforceField: null, calculateInApp: true },
];

describe('mappingHelper', () => {
  describe('getMappedValue', () => {
    it('returns the value at the mapped source field', () => {
      const r = { Industry: 'Technology', Total_ARR__c: 100000 };
      expect(getMappedValue(r, mappings, 'Industry')).toBe('Technology');
    });

    it('returns undefined when concept is not mapped', () => {
      const r = { Industry: 'Tech' };
      expect(getMappedValue(r, mappings, 'Unknown Concept')).toBeUndefined();
    });

    it('returns undefined when the mapped field is null (calculated in app)', () => {
      const r = { Industry: 'Tech' };
      expect(getMappedValue(r, mappings, 'Computed Score')).toBeUndefined();
    });

    it('returns undefined when the record lacks the source field', () => {
      const r = { Industry: 'Tech' };
      expect(getMappedValue(r, mappings, 'Total ARR')).toBeUndefined();
    });
  });

  describe('getMappedString', () => {
    it('returns string directly when value is a string', () => {
      const r = { Industry: 'Tech' };
      expect(getMappedString(r, mappings, 'Industry')).toBe('Tech');
    });

    it('coerces non-string values to string', () => {
      const r = { Total_ARR__c: 100000 };
      expect(getMappedString(r, mappings, 'Total ARR')).toBe('100000');
    });

    it('returns undefined when value is null/undefined', () => {
      const r = { Industry: null };
      expect(getMappedString(r, mappings, 'Industry')).toBeUndefined();
    });
  });

  describe('getMappedNumber', () => {
    it('returns number directly when value is a number', () => {
      const r = { Total_ARR__c: 100000 };
      expect(getMappedNumber(r, mappings, 'Total ARR')).toBe(100000);
    });

    it('parses numeric strings', () => {
      const r = { Total_ARR__c: '250000' };
      expect(getMappedNumber(r, mappings, 'Total ARR')).toBe(250000);
    });

    it('returns undefined for non-numeric strings', () => {
      const r = { Total_ARR__c: 'not-a-number' };
      expect(getMappedNumber(r, mappings, 'Total ARR')).toBeUndefined();
    });

    it('returns undefined when the value is null', () => {
      const r = { Total_ARR__c: null };
      expect(getMappedNumber(r, mappings, 'Total ARR')).toBeUndefined();
    });

    it('returns undefined for empty strings (does not coerce to 0)', () => {
      expect(getMappedNumber({ Total_ARR__c: '' }, mappings, 'Total ARR')).toBeUndefined();
    });

    it('returns undefined for whitespace-only strings (does not coerce to 0)', () => {
      expect(getMappedNumber({ Total_ARR__c: '   ' }, mappings, 'Total ARR')).toBeUndefined();
      expect(getMappedNumber({ Total_ARR__c: '\t\n' }, mappings, 'Total ARR')).toBeUndefined();
    });

    it('returns undefined for NaN number value', () => {
      expect(getMappedNumber({ Total_ARR__c: NaN }, mappings, 'Total ARR')).toBeUndefined();
    });

    it('returns undefined for Infinity', () => {
      expect(getMappedNumber({ Total_ARR__c: Infinity }, mappings, 'Total ARR')).toBeUndefined();
    });
  });

  describe('getMappedBoolean', () => {
    it('returns true for truthy values', () => {
      expect(getMappedBoolean({ Industry: 'Tech' }, mappings, 'Industry')).toBe(true);
    });

    it('returns false for falsy values', () => {
      expect(getMappedBoolean({ Industry: '' }, mappings, 'Industry')).toBe(false);
      expect(getMappedBoolean({ Industry: 0 }, mappings, 'Industry')).toBe(false);
    });

    it('returns undefined when value is null', () => {
      expect(getMappedBoolean({ Industry: null }, mappings, 'Industry')).toBeUndefined();
    });
  });

  describe('collectSourceFields', () => {
    it('returns the SF field names for the given concepts', () => {
      const fields = collectSourceFields(mappings, ['Industry', 'Total ARR']);
      expect(fields).toEqual(['Industry', 'Total_ARR__c']);
    });

    it('skips concepts without a mapped field', () => {
      const fields = collectSourceFields(mappings, ['Industry', 'Computed Score', 'Total ARR']);
      expect(fields).toEqual(['Industry', 'Total_ARR__c']);
    });

    it('skips unknown concepts', () => {
      const fields = collectSourceFields(mappings, ['Industry', 'Nope']);
      expect(fields).toEqual(['Industry']);
    });

    it('deduplicates fields', () => {
      const withDup: FieldMapping[] = [
        ...mappings,
        { conceptName: 'Sector', category: 'account', salesforceField: 'Industry', calculateInApp: false },
      ];
      const fields = collectSourceFields(withDup, ['Industry', 'Sector']);
      expect(fields).toEqual(['Industry']);
    });
  });

  describe('getProductMapping', () => {
    const productMappings: ProductFieldMapping[] = [
      { productId: 'learn', accountArrField: 'Learn_ARR__c' },
      { productId: 'comms', accountArrField: 'Comms_ARR__c', accountWhitespaceField: 'Comms_WS__c' },
    ];

    it('finds the mapping for a known product id', () => {
      expect(getProductMapping(productMappings, 'learn')).toEqual({ productId: 'learn', accountArrField: 'Learn_ARR__c' });
    });

    it('returns undefined for an unknown product id', () => {
      expect(getProductMapping(productMappings, 'unknown')).toBeUndefined();
    });
  });
});
