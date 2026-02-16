import { AIService, DealSummary } from '../aiService';

// Mock external AI SDKs
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"overview":"Test overview","stakeholders":["John"],"currentStatus":"On track","risks":["Budget"],"nextActions":["Follow up"]}' }],
      }),
    },
  }));
});

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{"overview":"OpenAI overview","stakeholders":[],"currentStatus":"Active","risks":[],"nextActions":[]}' } }],
        }),
      },
    },
  }));
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => '{"overview":"Gemini overview","stakeholders":[],"currentStatus":"Active","risks":[],"nextActions":[]}',
        },
      }),
    }),
  })),
}));

// Mock AIApiKey model
jest.mock('../../models/AIApiKey', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue(null),
  },
  AIProvider: {
    ANTHROPIC: 'anthropic',
    OPENAI: 'openai',
    GOOGLE: 'google',
    AGENTFORCE: 'agentforce',
    GONG: 'gong',
  },
}));

// Mock database config (Sequelize)
jest.mock('../../config/database', () => ({}));

// Mock gongService dynamic import
jest.mock('../gongService', () => ({
  createGongServiceFromDB: jest.fn().mockResolvedValue(null),
}));

// ============================================================
// Pure function tests (private methods accessed via cast)
// ============================================================

describe('AIService - buildDealSummaryPrompt', () => {
  let service: AIService;

  beforeEach(() => {
    service = new AIService({ provider: 'none', enabled: false });
  });

  it('formats opportunity data into a prompt', () => {
    const opp = {
      Name: 'Big Deal',
      Account: { Name: 'TestCo' },
      StageName: 'Negotiation',
      Amount: 500000,
      CloseDate: '2026-06-15',
      DaysInStage__c: 10,
      IsAtRisk__c: false,
      Command_Why_Do_Anything__c: 'Pain point exists',
      Command_Why_Now__c: 'Budget cycle',
      Command_Why_Us__c: 'Best fit',
      MEDDPICC_Overall_Score__c: 75,
      NextStep: 'Send proposal',
    };
    const activities = [
      { type: 'Call', subject: 'Discovery call', date: '2026-06-01' },
      { type: 'Email', subject: 'Follow up', date: '2026-06-02' },
    ];

    const prompt = (service as any).buildDealSummaryPrompt(opp, activities);

    expect(prompt).toContain('Big Deal');
    expect(prompt).toContain('TestCo');
    expect(prompt).toContain('Negotiation');
    expect(prompt).toContain('500,000');
    expect(prompt).toContain('Pain point exists');
    expect(prompt).toContain('Budget cycle');
    expect(prompt).toContain('Best fit');
    expect(prompt).toContain('75%');
    expect(prompt).toContain('Discovery call');
    expect(prompt).toContain('Send proposal');
  });

  it('handles null Account gracefully', () => {
    const opp = {
      Name: 'Orphan Deal',
      Account: null,
      StageName: 'Discovery',
      Amount: null,
      CloseDate: '2026-12-01',
    };

    const prompt = (service as any).buildDealSummaryPrompt(opp, []);

    expect(prompt).toContain('Orphan Deal');
    expect(prompt).toContain('Unknown');
  });

  it('handles null Amount', () => {
    const opp = {
      Name: 'No Amount Deal',
      Account: { Name: 'Co' },
      StageName: 'Proposal',
      Amount: null,
      CloseDate: '2026-12-01',
    };

    const prompt = (service as any).buildDealSummaryPrompt(opp, []);

    expect(prompt).toContain('$0');
  });

  it('handles empty activities', () => {
    const opp = {
      Name: 'Quiet Deal',
      Account: { Name: 'Co' },
      StageName: 'Proposal',
      Amount: 100000,
      CloseDate: '2026-12-01',
    };

    const prompt = (service as any).buildDealSummaryPrompt(opp, []);

    expect(prompt).toContain('No recent activity');
  });
});

describe('AIService - parseDealSummary', () => {
  let service: AIService;

  beforeEach(() => {
    service = new AIService({ provider: 'none', enabled: false });
  });

  it('extracts valid JSON from response', () => {
    const json = '{"overview":"Great deal","stakeholders":["Alice","Bob"],"currentStatus":"Moving forward","risks":["Timeline"],"nextActions":["Call Alice"]}';

    const result = (service as any).parseDealSummary(json);

    expect(result.overview).toBe('Great deal');
    expect(result.stakeholders).toEqual(['Alice', 'Bob']);
    expect(result.currentStatus).toBe('Moving forward');
    expect(result.risks).toEqual(['Timeline']);
    expect(result.nextActions).toEqual(['Call Alice']);
    expect(result.generatedAt).toBeDefined();
  });

  it('extracts JSON from surrounding text', () => {
    const response = 'Here is the summary:\n{"overview":"Found it","stakeholders":[],"currentStatus":"OK","risks":[],"nextActions":[]}\nEnd of response.';

    const result = (service as any).parseDealSummary(response);

    expect(result.overview).toBe('Found it');
  });

  it('handles missing fields with defaults', () => {
    const json = '{"overview":"Partial"}';

    const result = (service as any).parseDealSummary(json);

    expect(result.overview).toBe('Partial');
    expect(result.stakeholders).toEqual([]);
    expect(result.currentStatus).toBe('Status unavailable');
    expect(result.risks).toEqual([]);
    expect(result.nextActions).toEqual([]);
  });

  it('falls back to substring on invalid JSON', () => {
    const garbage = 'This is not JSON at all, just plain text response from AI';

    const result = (service as any).parseDealSummary(garbage);

    expect(result.overview).toContain('This is not JSON');
    expect(result.currentStatus).toBe('Unable to parse AI response');
    expect(result.stakeholders).toEqual([]);
  });

  it('handles empty response', () => {
    const result = (service as any).parseDealSummary('');

    expect(result.overview).toBe('');
    expect(result.currentStatus).toBe('Unable to parse AI response');
  });
});

describe('AIService - getPlaceholderSummary', () => {
  it('returns correct structure with setup instructions', () => {
    const service = new AIService({ provider: 'none', enabled: false });

    const result = (service as any).getPlaceholderSummary();

    expect(result.overview).toContain('not configured');
    expect(result.overview).toContain('ANTHROPIC_API_KEY');
    expect(result.stakeholders).toEqual([]);
    expect(result.currentStatus).toContain('Not available');
    expect(result.risks).toContain('No API key configured');
    expect(result.nextActions.length).toBeGreaterThan(0);
    expect(result.generatedAt).toBeDefined();
  });
});

describe('AIService - buildAssistantPrompt', () => {
  let service: AIService;

  beforeEach(() => {
    service = new AIService({ provider: 'none', enabled: false });
  });

  it('includes opportunities context', () => {
    const userData = {
      userName: 'Jane Smith',
      userRole: 'Account Executive',
      opportunities: [{
        Name: 'Big Opp',
        Account: { Name: 'CorpA' },
        StageName: 'Proposal',
        Amount: 200000,
        CloseDate: '2026-06-15',
      }],
      accounts: [],
      tasks: [],
    };

    const prompt = (service as any).buildAssistantPrompt('What should I focus on?', userData);

    expect(prompt).toContain('Jane Smith');
    expect(prompt).toContain('Account Executive');
    expect(prompt).toContain('Big Opp');
    expect(prompt).toContain('CorpA');
    expect(prompt).toContain('Proposal');
    expect(prompt).toContain('What should I focus on?');
  });

  it('includes accounts context', () => {
    const userData = {
      userName: 'Bob',
      opportunities: [],
      accounts: [{
        Name: 'Acme Corp',
        accountBuyingStage6sense__c: 'Decision',
        accountIntentScore6sense__c: 85,
        Total_ARR__c: 500000,
      }],
      tasks: [],
    };

    const prompt = (service as any).buildAssistantPrompt('Tell me about Acme', userData);

    expect(prompt).toContain('Acme Corp');
    expect(prompt).toContain('Decision');
    expect(prompt).toContain('500,000');
  });

  it('includes tasks context', () => {
    const userData = {
      userName: 'Bob',
      opportunities: [],
      accounts: [],
      tasks: [
        { subject: 'Call CEO', dueDate: '2026-06-15', priority: 'High' },
      ],
    };

    const prompt = (service as any).buildAssistantPrompt('What tasks do I have?', userData);

    expect(prompt).toContain('Call CEO');
    expect(prompt).toContain('[HIGH]');
  });

  it('includes Gong call insights', () => {
    const userData = {
      userName: 'Bob',
      opportunities: [],
      accounts: [],
      tasks: [],
      gongCalls: [{
        title: 'Discovery Call',
        opportunityName: 'Big Deal',
        started: '2026-06-01T10:00:00Z',
        duration: 1800,
        topics: ['pricing', 'timeline'],
        sentiment: 'positive',
      }],
    };

    const prompt = (service as any).buildAssistantPrompt('How are calls going?', userData);

    expect(prompt).toContain('Discovery Call');
    expect(prompt).toContain('Big Deal');
    expect(prompt).toContain('pricing');
    expect(prompt).toContain('positive');
  });

  it('includes Gong email activity', () => {
    const userData = {
      userName: 'Bob',
      opportunities: [],
      accounts: [],
      tasks: [],
      gongEmails: [
        { replied: true, bounced: false },
        { replied: false, bounced: true },
        { replied: false, bounced: false },
      ],
    };

    const prompt = (service as any).buildAssistantPrompt('How is email?', userData);

    expect(prompt).toContain('Total tracked emails: 3');
    expect(prompt).toContain('Replied: 1');
    expect(prompt).toContain('Bounced: 1');
  });

  it('handles empty arrays', () => {
    const userData = {
      userName: 'Bob',
      opportunities: [],
      accounts: [],
      tasks: [],
    };

    const prompt = (service as any).buildAssistantPrompt('Hello', userData);

    expect(prompt).toContain('Bob');
    expect(prompt).toContain('Hello');
    expect(prompt).not.toContain('**Opportunities:**');
    expect(prompt).not.toContain('**Accounts:**');
  });
});

// ============================================================
// Integration tests (with mocked providers)
// ============================================================

describe('AIService - generateDealSummary', () => {
  it('returns parsed summary with Anthropic provider', async () => {
    const service = new AIService({
      provider: 'anthropic',
      apiKey: 'test-key',
      enabled: true,
    });

    const result = await service.generateDealSummary(
      { Id: 'o1', Name: 'TestDeal', StageName: 'Proposal', Amount: 100000, CloseDate: '2026-12-01' },
      []
    );

    expect(result.overview).toBe('Test overview');
    expect(result.stakeholders).toEqual(['John']);
    expect(result.generatedAt).toBeDefined();
  });

  it('returns placeholder when no provider configured', async () => {
    const service = new AIService({ provider: 'none', enabled: false });

    const result = await service.generateDealSummary(
      { Id: 'o1', Name: 'TestDeal', StageName: 'Proposal' },
      []
    );

    expect(result.overview).toContain('not configured');
    expect(result.currentStatus).toContain('Not available');
  });
});

describe('AIService - askQuestion', () => {
  it('returns answer from Anthropic provider', async () => {
    const service = new AIService({
      provider: 'anthropic',
      apiKey: 'test-key',
      enabled: true,
    });

    const Anthropic = require('@anthropic-ai/sdk');
    const mockInstance = new Anthropic();
    mockInstance.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Focus on the $500K deal closing next week.' }],
    });

    const result = await service.askQuestion('What should I focus on?', {
      userName: 'Test User',
      opportunities: [],
      accounts: [],
      tasks: [],
    });

    expect(typeof result).toBe('string');
  });

  it('returns config message when no provider configured', async () => {
    const service = new AIService({ provider: 'none', enabled: false });

    const result = await service.askQuestion('Hello', {
      userName: 'Test',
      opportunities: [],
      accounts: [],
      tasks: [],
    });

    expect(result).toContain('not configured');
  });
});

describe('AIService - askWithContext', () => {
  it('delegates to active provider', async () => {
    const service = new AIService({
      provider: 'anthropic',
      apiKey: 'test-key',
      enabled: true,
    });

    const result = await service.askWithContext('Analyze these calls', 1000);

    expect(typeof result).toBe('string');
  });

  it('returns not-configured message when no provider', async () => {
    const service = new AIService({ provider: 'none', enabled: false });

    const result = await service.askWithContext('Hello');

    expect(result).toContain('not configured');
  });
});

describe('AIService - getProviderStatus', () => {
  it('returns correct status for Anthropic provider', async () => {
    const service = new AIService({
      provider: 'anthropic',
      apiKey: 'test-key',
      enabled: true,
    });

    const status = await service.getProviderStatus();

    expect(status.primaryProvider).toBe('anthropic');
    expect(status.chatProvider).toBe('anthropic');
    expect(status.agentforceEnabled).toBe(false);
  });

  it('returns none when no provider configured', async () => {
    const service = new AIService({ provider: 'none', enabled: false });

    const status = await service.getProviderStatus();

    expect(status.primaryProvider).toBe('none');
    expect(status.chatProvider).toBe('none');
  });
});

describe('AIService - initializeFromConfig', () => {
  it('sets up Anthropic client', () => {
    const service = new AIService({
      provider: 'anthropic',
      apiKey: 'sk-test',
      enabled: true,
    });

    expect((service as any).provider).toBe('anthropic');
    expect((service as any).anthropicClient).toBeTruthy();
  });

  it('sets up OpenAI client', () => {
    const service = new AIService({
      provider: 'openai',
      apiKey: 'sk-test',
      enabled: true,
    });

    expect((service as any).provider).toBe('openai');
    expect((service as any).openaiClient).toBeTruthy();
  });

  it('sets up Gemini client', () => {
    const service = new AIService({
      provider: 'gemini',
      apiKey: 'test-key',
      enabled: true,
    });

    expect((service as any).provider).toBe('gemini');
    expect((service as any).geminiClient).toBeTruthy();
  });

  it('sets up Agentforce config', () => {
    const service = new AIService({
      provider: 'agentforce',
      enabled: true,
    });

    expect((service as any).provider).toBe('agentforce');
    expect((service as any).agentforceConfig).toBeTruthy();
    expect((service as any).agentforceConfig.enabled).toBe(true);
  });

  it('defaults to none for unknown provider', () => {
    const service = new AIService({
      provider: 'none',
      enabled: true,
    });

    expect((service as any).provider).toBe('none');
  });
});

describe('AIService - initializeFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reads ANTHROPIC_API_KEY from env', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const service = new AIService({ provider: 'none', enabled: false });
    (service as any).initializeFromEnv();

    expect((service as any).provider).toBe('anthropic');
    expect((service as any).anthropicClient).toBeTruthy();
  });

  it('reads OPENAI_API_KEY from env', () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    const service = new AIService({ provider: 'none', enabled: false });
    (service as any).initializeFromEnv();

    expect((service as any).provider).toBe('openai');
    expect((service as any).openaiClient).toBeTruthy();
  });

  it('reads GOOGLE_AI_API_KEY from env', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.GOOGLE_AI_API_KEY = 'gemini-test';
    const service = new AIService({ provider: 'none', enabled: false });
    (service as any).initializeFromEnv();

    expect((service as any).provider).toBe('gemini');
    expect((service as any).geminiClient).toBeTruthy();
  });

  it('sets provider to none when no keys configured', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.AGENTFORCE_ENABLED;
    const service = new AIService({ provider: 'none', enabled: false });
    (service as any).initializeFromEnv();

    expect((service as any).provider).toBe('none');
  });
});
