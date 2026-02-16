import { QueryBuilder } from '../queryBuilder';
import { FilterCriteria, ListQueryParams } from '../../types/filters';

describe('QueryBuilder', () => {
  describe('basic query construction', () => {
    it('builds a simple SELECT query', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name', 'Industry'])
        .build();
      expect(query).toBe('SELECT Id, Name, Industry FROM Account');
    });

    it('throws if no fields selected', () => {
      expect(() => new QueryBuilder('Account').build()).toThrow('No fields selected');
    });

    it('throws if no object type', () => {
      expect(() => new QueryBuilder('').select(['Id']).build()).toThrow('No object type specified');
    });
  });

  describe('withScope', () => {
    it('adds OwnerId filter for single user', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'Name'])
        .withScope(['005000000000001'])
        .build();
      expect(query).toContain("OwnerId = '005000000000001'");
    });

    it('adds OwnerId IN clause for multiple users', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'Name'])
        .withScope(['005000000000001', '005000000000002'])
        .build();
      expect(query).toContain("OwnerId IN ('005000000000001', '005000000000002')");
    });

    it('adds no filter for null (all scope)', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'Name'])
        .withScope(null)
        .build();
      expect(query).not.toContain('OwnerId');
    });

    it('adds no filter for empty array', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'Name'])
        .withScope([])
        .build();
      expect(query).not.toContain('OwnerId');
    });
  });

  describe('withFilters', () => {
    it('handles eq operator', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withFilters([{ field: 'Industry', operator: 'eq', value: 'Technology' }])
        .build();
      expect(query).toContain("Industry = 'Technology'");
    });

    it('handles neq operator', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withFilters([{ field: 'Industry', operator: 'neq', value: 'Finance' }])
        .build();
      expect(query).toContain("Industry != 'Finance'");
    });

    it('handles numeric values', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'Amount'])
        .withFilters([{ field: 'Amount', operator: 'gte', value: 50000 }])
        .build();
      expect(query).toContain('Amount >= 50000');
    });

    it('handles contains operator with LIKE', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withFilters([{ field: 'Name', operator: 'contains', value: 'Acme' }])
        .build();
      expect(query).toContain("Name LIKE '%Acme%'");
    });

    it('handles in operator with array', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'StageName'])
        .withFilters([{ field: 'StageName', operator: 'in', value: ['Prospecting', 'Qualification'] }])
        .build();
      expect(query).toContain("StageName IN ('Prospecting', 'Qualification')");
    });

    it('handles not_in operator', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'StageName'])
        .withFilters([{ field: 'StageName', operator: 'not_in', value: ['Closed Won', 'Closed Lost'] }])
        .build();
      expect(query).toContain("StageName NOT IN ('Closed Won', 'Closed Lost')");
    });

    it('handles between operator', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'Amount'])
        .withFilters([{ field: 'Amount', operator: 'between', value: ['10000', '50000'] }])
        .build();
      expect(query).toContain("Amount >= '10000' AND Amount <= '50000'");
    });

    it('combines multiple filters with AND', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'Name', 'Amount'])
        .withFilters([
          { field: 'Amount', operator: 'gt', value: 10000 },
          { field: 'StageName', operator: 'eq', value: 'Prospecting' },
        ])
        .build();
      expect(query).toContain('WHERE Amount > 10000 AND StageName');
    });

    it('throws on invalid field name', () => {
      expect(() =>
        new QueryBuilder('Account')
          .select(['Id'])
          .withFilters([{ field: "Name'; DROP TABLE--", operator: 'eq', value: 'x' }])
      ).toThrow('Invalid field name');
    });
  });

  describe('withSearch', () => {
    it('adds LIKE clauses for search term', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withSearch('acme', ['Name', 'Industry'])
        .build();
      expect(query).toContain("Name LIKE '%acme%'");
      expect(query).toContain("Industry LIKE '%acme%'");
      expect(query).toContain(' OR ');
    });

    it('escapes special characters in search', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withSearch("test%drop'", ['Name'])
        .build();
      expect(query).toContain("\\%");
      expect(query).toContain("\\'");
    });

    it('skips empty search term', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withSearch('', ['Name'])
        .build();
      expect(query).not.toContain('LIKE');
    });
  });

  describe('withWhere', () => {
    it('adds raw WHERE clause', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'Name'])
        .withWhere('IsClosed = false')
        .build();
      expect(query).toContain('WHERE IsClosed = false');
    });

    it('skips empty clause', () => {
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'Name'])
        .withWhere('')
        .build();
      expect(query).not.toContain('WHERE');
    });
  });

  describe('withSort', () => {
    it('adds ORDER BY clause', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withSort('Name', 'ASC')
        .build();
      expect(query).toContain('ORDER BY Name ASC');
    });

    it('defaults to ASC', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withSort('Name')
        .build();
      expect(query).toContain('ORDER BY Name ASC');
    });

    it('supports DESC', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withSort('CreatedDate', 'DESC')
        .build();
      expect(query).toContain('ORDER BY CreatedDate DESC');
    });
  });

  describe('withPagination', () => {
    it('adds LIMIT and OFFSET', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withPagination(50, 100)
        .build();
      expect(query).toContain('LIMIT 50');
      expect(query).toContain('OFFSET 100');
    });

    it('caps LIMIT at 2000', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withPagination(5000)
        .build();
      expect(query).toContain('LIMIT 2000');
    });

    it('skips zero or negative values', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withPagination(0, 0)
        .build();
      expect(query).not.toContain('LIMIT');
      expect(query).not.toContain('OFFSET');
    });
  });

  describe('withAccessibleFieldsOnly', () => {
    it('removes inaccessible fields', () => {
      const accessible = new Set(['Id', 'Name']);
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name', 'AnnualRevenue', 'Industry'])
        .withAccessibleFieldsOnly(accessible)
        .build();
      expect(query).toContain('Id, Name');
      expect(query).not.toContain('AnnualRevenue');
      expect(query).not.toContain('Industry');
    });

    it('keeps relationship fields', () => {
      const accessible = new Set(['Id', 'Name']);
      const query = new QueryBuilder('Opportunity')
        .select(['Id', 'Name', 'Account.Name', 'Owner.Name'])
        .withAccessibleFieldsOnly(accessible)
        .build();
      expect(query).toContain('Account.Name');
      expect(query).toContain('Owner.Name');
    });

    it('always keeps Id', () => {
      const accessible = new Set(['Name']);
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name', 'Industry'])
        .withAccessibleFieldsOnly(accessible)
        .build();
      expect(query).toContain('Id');
    });
  });

  describe('fromParams static method', () => {
    it('builds a query from ListQueryParams', () => {
      const params: ListQueryParams = {
        filters: [{ field: 'Industry', operator: 'eq', value: 'Technology' }],
        search: 'acme',
        sortField: 'Name',
        sortDir: 'ASC',
        limit: 25,
        offset: 0,
      };
      const query = QueryBuilder.fromParams(
        'Account',
        ['Id', 'Name', 'Industry'],
        params,
        ['Name'],
        ['005000000000001']
      );
      expect(query).toContain('SELECT Id, Name, Industry FROM Account');
      expect(query).toContain("OwnerId = '005000000000001'");
      expect(query).toContain("Industry = 'Technology'");
      expect(query).toContain("Name LIKE '%acme%'");
      expect(query).toContain('ORDER BY Name ASC');
      expect(query).toContain('LIMIT 25');
    });

    it('handles empty params gracefully', () => {
      const params: ListQueryParams = {};
      const query = QueryBuilder.fromParams(
        'Account',
        ['Id', 'Name'],
        params,
        ['Name'],
        null
      );
      expect(query).toBe('SELECT Id, Name FROM Account');
    });
  });

  describe('SOQL injection prevention', () => {
    it('escapes single quotes in filter values', () => {
      const query = new QueryBuilder('Account')
        .select(['Id', 'Name'])
        .withFilters([{ field: 'Name', operator: 'eq', value: "O'Reilly" }])
        .build();
      expect(query).toContain("O\\'Reilly");
      expect(query).not.toContain("O'Reilly'");
    });

    it('escapes values in scope IDs', () => {
      const query = new QueryBuilder('Account')
        .select(['Id'])
        .withScope(["005'; DELETE FROM Account--"])
        .build();
      expect(query).toContain("\\'");
    });
  });
});
