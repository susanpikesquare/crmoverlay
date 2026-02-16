import express from 'express';
import request from 'supertest';

// Mock dependencies before importing the router
jest.mock('../../config/salesforce', () => ({
  createConnection: jest.fn().mockReturnValue({
    identity: jest.fn().mockResolvedValue({}),
    query: jest.fn().mockResolvedValue({ records: [] }),
  }),
}));

jest.mock('../../middleware/auth', () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../config/database', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  return {
    pool: { query: mockQuery },
    __mockQuery: mockQuery,
  };
});

jest.mock('../../services/aiService', () => ({
  aiService: { generateDealSummary: jest.fn(), askWithContext: jest.fn() },
}));

jest.mock('../../services/salesforceData', () => ({
  getAccountById: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/hubData', () => ({}));

jest.mock('../../services/configService', () => ({
  getConfig: jest.fn().mockReturnValue({ riskRules: [], priorityScoring: { components: [] }, fieldMappings: [] }),
}));

import apiRouter from '../api';
import { AdminSettingsService } from '../../services/adminSettings';

const { __mockQuery: mockQuery } = require('../../config/database') as any;
const { pool } = require('../../config/database');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { userInfo: { name: 'Test User' }, isAdmin: true, userId: 'user1', accessToken: 'tok', instanceUrl: 'https://sf.test' };
    req.sfConnection = { query: jest.fn().mockResolvedValue({ records: [] }) };
    next();
  });
  app.use('/api', apiRouter);
  return app;
}

describe('AdminSettingsService tier overrides (unit)', () => {
  // The GET /accounts/tier-overrides route is shadowed by /accounts/:id in Express
  // routing order, so we test the underlying service directly here.

  beforeEach(() => {
    mockQuery.mockReset().mockResolvedValue({ rows: [] });
  });

  it('returns stored overrides', async () => {
    const overrides = { '001A': { accountId: '001A', tier: 'hot', overriddenBy: 'admin', overriddenAt: '2025-01-01' } };
    mockQuery.mockResolvedValueOnce({ rows: [{ setting_value: overrides }] });

    const service = new AdminSettingsService(pool);
    const result = await service.getAccountTierOverrides();
    expect(result['001A'].tier).toBe('hot');
  });

  it('returns empty object when no overrides', async () => {
    const service = new AdminSettingsService(pool);
    const result = await service.getAccountTierOverrides();
    expect(result).toEqual({});
  });

  it('throws on pool failure', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB down'));
    const service = new AdminSettingsService(pool);
    await expect(service.getAccountTierOverrides()).rejects.toThrow('DB down');
  });
});

describe('PUT /api/accounts/:id/tier-override', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp();
    mockQuery.mockReset().mockResolvedValue({ rows: [] });
  });

  it('sets a tier override', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/accounts/001X/tier-override')
      .send({ tier: 'warm', reason: 'Strategic' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data['001X'].tier).toBe('warm');
  });

  it('removes a tier override when tier is null', async () => {
    const existing = { '001X': { accountId: '001X', tier: 'hot', overriddenBy: 'admin', overriddenAt: '2025-01-01' } };
    mockQuery.mockResolvedValueOnce({ rows: [{ setting_value: existing }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/accounts/001X/tier-override')
      .send({ tier: null });

    expect(res.status).toBe(200);
    expect(res.body.data['001X']).toBeUndefined();
  });

  it('returns 500 on pool failure', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app)
      .put('/api/accounts/001X/tier-override')
      .send({ tier: 'hot' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
