import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AIApiKey, { AIProvider as AIApiKeyProvider } from '../models/AIApiKey';

export interface DealSummary {
  overview: string;
  stakeholders: string[];
  currentStatus: string;
  risks: string[];
  nextActions: string[];
  generatedAt: string;
}

export interface AIProviderConfig {
  provider: 'anthropic' | 'openai' | 'gemini' | 'none';
  apiKey?: string;
  model?: string;
  customEndpoint?: string;
  enabled: boolean;
}

type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'none';

export class AIService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private geminiClient: GoogleGenerativeAI | null = null;
  private provider: AIProvider;
  private model: string;

  constructor(config?: AIProviderConfig) {
    if (config && config.enabled) {
      // Use provided configuration (from database)
      this.initializeFromConfig(config);
    } else {
      // Try to load from database, fallback to environment variables
      this.initializeAsync();
    }
  }

  private async initializeAsync() {
    const dbConfig = await this.loadConfigFromDatabase();
    if (dbConfig) {
      this.initializeFromConfig(dbConfig);
    } else {
      this.initializeFromEnv();
    }
  }

  private async loadConfigFromDatabase(): Promise<AIProviderConfig | null> {
    try {
      const DEMO_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000';

      // Try to find active API keys in priority order: Anthropic > OpenAI > Gemini
      const providers = [AIApiKeyProvider.ANTHROPIC, AIApiKeyProvider.OPENAI, AIApiKeyProvider.GOOGLE];

      for (const provider of providers) {
        const apiKey = await AIApiKey.findOne({
          where: {
            customerId: DEMO_CUSTOMER_ID,
            provider,
            isActive: true,
          },
        });

        if (apiKey) {
          // Map database provider names to service provider names
          let mappedProvider: 'anthropic' | 'openai' | 'gemini';
          if (provider === AIApiKeyProvider.GOOGLE) {
            mappedProvider = 'gemini';
          } else {
            mappedProvider = provider as 'anthropic' | 'openai';
          }

          return {
            provider: mappedProvider,
            apiKey: apiKey.getDecryptedApiKey(),
            enabled: true,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error loading AI config from database:', error);
      return null;
    }
  }

  private initializeFromConfig(config: AIProviderConfig) {
    this.provider = config.provider;

    switch (config.provider) {
      case 'anthropic':
        if (config.apiKey) {
          this.anthropicClient = new Anthropic({ apiKey: config.apiKey });
          this.model = config.model || 'claude-3-5-sonnet-20241022';
          console.log(`AI Service initialized with Anthropic Claude (${this.model})`);
        }
        break;
      case 'openai':
        if (config.apiKey) {
          const openaiConfig: any = { apiKey: config.apiKey };
          if (config.customEndpoint) {
            // Support for Azure OpenAI
            openaiConfig.baseURL = config.customEndpoint;
          }
          this.openaiClient = new OpenAI(openaiConfig);
          this.model = config.model || 'gpt-4-turbo-preview';
          console.log(`AI Service initialized with OpenAI (${this.model})`);
        }
        break;
      case 'gemini':
        if (config.apiKey) {
          this.geminiClient = new GoogleGenerativeAI(config.apiKey);
          this.model = config.model || 'gemini-pro';
          console.log(`AI Service initialized with Google Gemini (${this.model})`);
        }
        break;
      default:
        this.provider = 'none';
        console.warn('AI provider set to "none". AI features disabled.');
    }
  }

  private initializeFromEnv() {
    // Determine which AI provider to use based on available API keys
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GOOGLE_AI_API_KEY;

    // Priority: Anthropic > OpenAI > Gemini (you can change this order)
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
      this.provider = 'anthropic';
      this.model = 'claude-3-5-sonnet-20241022';
      console.log('AI Service initialized with Anthropic Claude (env)');
    } else if (openaiKey) {
      const openaiConfig: any = { apiKey: openaiKey };
      if (process.env.AZURE_OPENAI_ENDPOINT) {
        openaiConfig.baseURL = process.env.AZURE_OPENAI_ENDPOINT;
      }
      this.openaiClient = new OpenAI(openaiConfig);
      this.provider = 'openai';
      this.model = 'gpt-4-turbo-preview';
      console.log('AI Service initialized with OpenAI (env)');
    } else if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
      this.provider = 'gemini';
      this.model = 'gemini-pro';
      console.log('AI Service initialized with Google Gemini (env)');
    } else {
      this.provider = 'none';
      console.warn('No AI API key configured. AI features will be disabled.');
      console.warn('Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY');
      console.warn('Or configure through Admin Settings UI');
    }
  }

  async generateDealSummary(opportunityData: any, activityData: any[]): Promise<DealSummary> {
    if (!this.anthropicClient && !this.openaiClient && !this.geminiClient) {
      return this.getPlaceholderSummary();
    }

    try {
      const prompt = this.buildDealSummaryPrompt(opportunityData, activityData);

      switch (this.provider) {
        case 'anthropic':
          return await this.generateWithAnthropic(prompt);
        case 'openai':
          return await this.generateWithOpenAI(prompt);
        case 'gemini':
          return await this.generateWithGemini(prompt);
        default:
          return this.getPlaceholderSummary();
      }
    } catch (error) {
      console.error('Error generating AI deal summary:', error);
      throw new Error('Failed to generate AI summary');
    }
  }

  private async generateWithAnthropic(prompt: string): Promise<DealSummary> {
    if (!this.anthropicClient) throw new Error('Anthropic client not initialized');

    const message = await this.anthropicClient.messages.create({
      model: this.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    return this.parseDealSummary(responseText);
  }

  private async generateWithOpenAI(prompt: string): Promise<DealSummary> {
    if (!this.openaiClient) throw new Error('OpenAI client not initialized');

    const completion = await this.openaiClient.chat.completions.create({
      model: this.model || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    return this.parseDealSummary(responseText);
  }

  private async generateWithGemini(prompt: string): Promise<DealSummary> {
    if (!this.geminiClient) throw new Error('Gemini client not initialized');

    const model = this.geminiClient.getGenerativeModel({ model: this.model || 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    return this.parseDealSummary(responseText);
  }

  private buildDealSummaryPrompt(opportunity: any, activities: any[]): string {
    const commandScores = {
      whyDoAnything: opportunity.Command_Why_Do_Anything__c || 'Not provided',
      whyNow: opportunity.Command_Why_Now__c || 'Not provided',
      whyUs: opportunity.Command_Why_Us__c || 'Not provided',
    };

    const meddpiccScore = opportunity.MEDDPICC_Overall_Score__c || 0;

    const recentActivities = activities
      .slice(0, 5)
      .map((a) => `- ${a.type}: ${a.subject} (${a.date})`)
      .join('\n');

    return `You are a sales coach analyzing a B2B SaaS deal. Provide a concise executive summary in the following JSON format:

{
  "overview": "2-3 sentence deal overview",
  "stakeholders": ["List key stakeholders mentioned"],
  "currentStatus": "One sentence on deal health and momentum",
  "risks": ["List 2-3 key risks or blockers"],
  "nextActions": ["List 2-3 specific next actions with owners"]
}

Deal Information:
- Opportunity: ${opportunity.Name}
- Account: ${opportunity.Account?.Name || 'Unknown'}
- Stage: ${opportunity.StageName}
- Amount: $${opportunity.Amount?.toLocaleString() || 0}
- Close Date: ${opportunity.CloseDate}
- Days in Stage: ${opportunity.DaysInStage__c || 0}
- Is At Risk: ${opportunity.IsAtRisk__c ? 'Yes' : 'No'}

Command of the Message:
- Why Do Anything: ${commandScores.whyDoAnything}
- Why Now: ${commandScores.whyNow}
- Why Us: ${commandScores.whyUs}

MEDDPICC Score: ${meddpiccScore}%

Recent Activity:
${recentActivities || 'No recent activity'}

Next Step: ${opportunity.NextStep || 'Not defined'}

Provide ONLY the JSON response, no additional text.`;
  }

  private parseDealSummary(responseText: string): DealSummary {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        overview: parsed.overview || 'Unable to generate overview',
        stakeholders: Array.isArray(parsed.stakeholders) ? parsed.stakeholders : [],
        currentStatus: parsed.currentStatus || 'Status unavailable',
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions : [],
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      // Fallback to a simple text-based summary
      return {
        overview: responseText.substring(0, 200),
        stakeholders: [],
        currentStatus: 'Unable to parse AI response',
        risks: [],
        nextActions: [],
        generatedAt: new Date().toISOString(),
      };
    }
  }

  private getPlaceholderSummary(): DealSummary {
    return {
      overview: `AI summary generation is not configured. To enable AI-powered insights, add one of the following to your environment variables:
- ANTHROPIC_API_KEY (for Claude) - Get from https://console.anthropic.com/
- OPENAI_API_KEY (for ChatGPT) - Get from https://platform.openai.com/
- GOOGLE_AI_API_KEY (for Gemini) - Get from https://makersuite.google.com/`,
      stakeholders: [],
      currentStatus: 'Not available - AI service not configured',
      risks: ['No API key configured'],
      nextActions: ['Configure an AI API key to enable smart deal summaries'],
      generatedAt: new Date().toISOString(),
    };
  }

  async askQuestion(question: string, userData: any): Promise<string> {
    if (!this.anthropicClient && !this.openaiClient && !this.geminiClient) {
      return 'AI Assistant is not configured. Please contact your administrator to set up an AI provider.';
    }

    try {
      const prompt = this.buildAssistantPrompt(question, userData);

      switch (this.provider) {
        case 'anthropic':
          return await this.askWithAnthropic(prompt);
        case 'openai':
          return await this.askWithOpenAI(prompt);
        case 'gemini':
          return await this.askWithGemini(prompt);
        default:
          return 'AI Assistant is not configured. Please contact your administrator.';
      }
    } catch (error) {
      console.error('Error asking AI question:', error);
      throw new Error('Failed to get AI response');
    }
  }

  private async askWithAnthropic(prompt: string): Promise<string> {
    if (!this.anthropicClient) throw new Error('Anthropic client not initialized');

    const message = await this.anthropicClient.messages.create({
      model: this.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    return message.content[0].type === 'text' ? message.content[0].text : '';
  }

  private async askWithOpenAI(prompt: string): Promise<string> {
    if (!this.openaiClient) throw new Error('OpenAI client not initialized');

    const completion = await this.openaiClient.chat.completions.create({
      model: this.model || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '';
  }

  private async askWithGemini(prompt: string): Promise<string> {
    if (!this.geminiClient) throw new Error('Gemini client not initialized');

    const model = this.geminiClient.getGenerativeModel({ model: this.model || 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  private buildAssistantPrompt(question: string, userData: any): string {
    const { opportunities, tasks, userName, userRole } = userData;

    let contextInfo = `You are a helpful sales assistant for ${userName || 'the user'}`;

    if (userRole) {
      contextInfo += `, who is a ${userRole}`;
    }

    contextInfo += `. Answer their question based on the following context:\n\n`;

    if (opportunities && opportunities.length > 0) {
      contextInfo += `**Their Opportunities:**\n`;
      opportunities.forEach((opp: any, idx: number) => {
        contextInfo += `${idx + 1}. ${opp.Name} - ${opp.Account?.Name || 'Unknown Account'}\n`;
        contextInfo += `   Stage: ${opp.StageName}, Amount: $${opp.Amount?.toLocaleString() || 0}\n`;
        contextInfo += `   Close Date: ${opp.CloseDate}, Days in Stage: ${opp.DaysInStage__c || 0}\n`;
        if (opp.IsAtRisk__c) {
          contextInfo += `   ⚠️ AT RISK\n`;
        }
        if (opp.MEDDPICC_Overall_Score__c) {
          contextInfo += `   MEDDPICC Score: ${opp.MEDDPICC_Overall_Score__c}%\n`;
        }
        contextInfo += `\n`;
      });
    }

    if (tasks && tasks.length > 0) {
      contextInfo += `**Their Upcoming Tasks:**\n`;
      tasks.forEach((task: any, idx: number) => {
        contextInfo += `${idx + 1}. ${task.subject} - Due: ${task.dueDate || 'No date'}\n`;
        if (task.priority === 'High') {
          contextInfo += `   🔴 High Priority\n`;
        }
      });
      contextInfo += `\n`;
    }

    contextInfo += `**User's Question:** ${question}\n\n`;
    contextInfo += `Provide a helpful, concise answer (2-4 sentences). Be specific and actionable. If suggesting they focus on something, explain why.`;

    return contextInfo;
  }
}

export const aiService = new AIService();
