import { Request, Response } from 'express';

/**
 * Create a mock PostgreSQL Pool with a query function
 */
export function createMockPool() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
}

/**
 * Create a mock Express Request
 */
export function createMockRequest(overrides: Partial<Request> & Record<string, any> = {}): Partial<Request> {
  return {
    session: { userInfo: { name: 'Test User' }, isAdmin: false, userRole: 'ae' } as any,
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

/**
 * Create a mock Express Response with chainable methods
 */
export function createMockResponse(): Partial<Response> & { _status: number; _json: any; _sent: any } {
  const res: any = {
    _status: 200,
    _json: null,
    _sent: null,
  };
  res.status = jest.fn((code: number) => {
    res._status = code;
    return res;
  });
  res.json = jest.fn((data: any) => {
    res._json = data;
    return res;
  });
  res.send = jest.fn((data: any) => {
    res._sent = data;
    return res;
  });
  return res;
}

/**
 * Create a mock jsforce Connection
 */
export function createMockSfConnection() {
  const mockSobject = {
    find: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([]),
    describe: jest.fn().mockResolvedValue({ fields: [] }),
  };

  return {
    query: jest.fn().mockResolvedValue({ records: [], totalSize: 0 }),
    sobject: jest.fn().mockReturnValue(mockSobject),
    _mockSobject: mockSobject,
  };
}
