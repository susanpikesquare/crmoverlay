import express from 'express';
import request from 'supertest';

// Mock all dependencies before importing the router
jest.mock('../../middleware/auth', () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/adminAuth', () => ({
  isAdmin: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
}));

const mockAskWithContext = jest.fn();
jest.mock('../../services/aiService', () => ({
  aiService: { askWithContext: mockAskWithContext },
}));

jest.mock('../../models/AIApiKey', () => {
  const mock: any = {};
  mock.default = mock;
  mock.AIProvider = { ANTHROPIC: 'anthropic', OPENAI: 'openai', GEMINI: 'gemini' };
  return mock;
});

jest.mock('../../services/configService', () => ({
  getConfig: jest.fn().mockReturnValue({
    riskRules: [],
    priorityScoring: { components: [], thresholds: { hot: { min: 85, max: 100 }, warm: { min: 65, max: 84 }, cool: { min: 40, max: 64 }, cold: { min: 0, max: 39 } } },
    fieldMappings: [],
    roleMapping: [],
    userRoleOverrides: [],
    displaySettings: {},
  }),
  updateConfig: jest.fn(),
  updateRiskRules: jest.fn(),
  updatePriorityScoring: jest.fn(),
  updateFieldMappings: jest.fn(),
  updateOpportunityStages: jest.fn(),
  resetToDefaults: jest.fn(),
  exportConfig: jest.fn(),
  importConfig: jest.fn(),
}));

jest.mock('../../config/salesforce', () => ({
  createConnection: jest.fn(),
}));

import adminRouter from '../admin';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = {
      userInfo: { name: 'Admin User' },
      isAdmin: true,
      userRole: 'admin',
      accessToken: 'tok',
      instanceUrl: 'https://sf.test',
    };
    next();
  });
  app.use('/api/admin', adminRouter);
  return app;
}

describe('POST /api/admin/config/risk-rules/parse', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp();
    mockAskWithContext.mockReset();
  });

  it('returns 400 when description is missing', async () => {
    const res = await request(app)
      .post('/api/admin/config/risk-rules/parse')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('description');
  });

  it('parses AI response and adds id/active fields', async () => {
    const aiRule = {
      name: 'Low Score',
      objectType: 'Account',
      conditions: [{ field: 'Score__c', operator: '<', value: 50 }],
      logic: 'AND',
      flag: 'at-risk',
    };
    mockAskWithContext.mockResolvedValueOnce(JSON.stringify(aiRule));

    const res = await request(app)
      .post('/api/admin/config/risk-rules/parse')
      .send({ description: 'Flag accounts with score below 50' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toMatch(/^rule_/);
    expect(res.body.data.active).toBe(true);
    expect(res.body.data.name).toBe('Low Score');
  });

  it('strips markdown code blocks from AI response', async () => {
    const aiRule = {
      name: 'Stuck Deal',
      objectType: 'Opportunity',
      conditions: [{ field: 'DaysInStage', operator: '>', value: 30 }],
      logic: 'AND',
      flag: 'warning',
    };
    const wrappedResponse = '```json\n' + JSON.stringify(aiRule) + '\n```';
    mockAskWithContext.mockResolvedValueOnce(wrappedResponse);

    const res = await request(app)
      .post('/api/admin/config/risk-rules/parse')
      .send({ description: 'Deals stuck over 30 days' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Stuck Deal');
  });

  it('returns 400 when AI returns invalid JSON', async () => {
    mockAskWithContext.mockResolvedValueOnce('I cannot generate a rule for that.');

    const res = await request(app)
      .post('/api/admin/config/risk-rules/parse')
      .send({ description: 'Do something weird' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
