import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Connection } from 'jsforce';
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
  provider: 'anthropic' | 'openai' | 'gemini' | 'agentforce' | 'none';
  apiKey?: string;
  model?: string;
  customEndpoint?: string;
  enabled: boolean;
}

type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'agentforce' | 'none';

// Agentforce configuration
interface AgentforceConfig {
  enabled: boolean;
  promptTemplateId?: string;
  agentId?: string;
}

// Multi-provider configuration - use different AI for different purposes
export interface MultiProviderConfig {
  // Primary provider for AI Assistant chat
  chatProvider: AIProvider;
  // Provider for deal summaries and recommendations (can use Agentforce for SF-native insights)
  recommendationProvider: AIProvider;
}

export class AIService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private geminiClient: GoogleGenerativeAI | null = null;
  private agentforceConfig: AgentforceConfig | null = null;
  private provider: AIProvider;
  private model: string;
  private initPromise: Promise<void> | null = null;
  private isInitialized: boolean = false;

  // Salesforce connection for Agentforce (set per-request)
  private sfConnection: Connection | null = null;

  // Multi-provider support: when both Agentforce AND another provider are configured,
  // use Agentforce for SF-native recommendations and the other for general chat
  private secondaryProvider: AIProvider = 'none';

  constructor(config?: AIProviderConfig) {
    if (config && config.enabled) {
      // Use provided configuration (from database)
      this.initializeFromConfig(config);
      this.isInitialized = true;
    } else {
      // Try to load from database, fallback to environment variables
      this.initPromise = this.initializeAsync();
    }
  }

  private async initializeAsync(): Promise<void> {
    try {
      const dbConfig = await this.loadConfigFromDatabase();
      if (dbConfig) {
        this.initializeFromConfig(dbConfig);
      } else {
        this.initializeFromEnv();
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('Error during AI service initialization:', error);
      this.initializeFromEnv();
      this.isInitialized = true;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private async loadConfigFromDatabase(): Promise<AIProviderConfig | null> {
    try {
      const DEMO_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000';

      // Prefer external API providers first (they have real API keys and work for chat).
      // Agentforce is checked last — it's only useful if SF Einstein is configured.
      const externalProviders = [AIApiKeyProvider.ANTHROPIC, AIApiKeyProvider.OPENAI, AIApiKeyProvider.GOOGLE];

      for (const provider of externalProviders) {
        const apiKey = await AIApiKey.findOne({
          where: {
            customerId: DEMO_CUSTOMER_ID,
            provider,
            isActive: true,
          },
        });

        if (apiKey) {
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

      // Only fall back to Agentforce if no external provider is configured
      const agentforceKey = await AIApiKey.findOne({
        where: {
          customerId: DEMO_CUSTOMER_ID,
          provider: AIApiKeyProvider.AGENTFORCE,
          isActive: true,
        },
      });

      if (agentforceKey) {
        return {
          provider: 'agentforce',
          apiKey: undefined,
          enabled: true,
        };
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
          this.model = config.model || 'claude-3-7-sonnet-20250219';
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
      case 'agentforce':
        // Agentforce uses Salesforce connection, not API key
        this.agentforceConfig = {
          enabled: true,
          promptTemplateId: process.env.AGENTFORCE_PROMPT_TEMPLATE_ID,
          agentId: process.env.AGENTFORCE_AGENT_ID,
        };
        this.model = 'agentforce';
        console.log('AI Service initialized with Salesforce Agentforce');
        break;
      default:
        this.provider = 'none';
        console.warn('AI provider set to "none". AI features disabled.');
    }
  }

  // Set the Salesforce connection for Agentforce requests
  public setSalesforceConnection(connection: Connection): void {
    this.sfConnection = connection;
  }

  private initializeFromEnv() {
    // Determine which AI provider to use based on available API keys
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GOOGLE_AI_API_KEY;
    const agentforceEnabled = process.env.AGENTFORCE_ENABLED === 'true';

    // MULTI-PROVIDER SUPPORT:
    // If both Agentforce AND an external AI (Claude/OpenAI/Gemini) are configured,
    // use Agentforce for Salesforce-native recommendations and the external AI for chat

    // First, initialize Agentforce if enabled
    if (agentforceEnabled) {
      this.agentforceConfig = {
        enabled: true,
        promptTemplateId: process.env.AGENTFORCE_PROMPT_TEMPLATE_ID,
        agentId: process.env.AGENTFORCE_AGENT_ID,
      };
      console.log('AI Service: Agentforce enabled for Salesforce-native AI');
    }

    // Then, initialize external AI provider for chat/general AI
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
      if (agentforceEnabled) {
        // Both configured: Agentforce is primary for recommendations, Anthropic for chat
        this.provider = 'agentforce';
        this.secondaryProvider = 'anthropic';
        this.model = 'claude-3-7-sonnet-20250219';
        console.log('AI Service: Multi-provider mode - Agentforce + Anthropic Claude');
      } else {
        this.provider = 'anthropic';
        this.model = 'claude-3-7-sonnet-20250219';
        console.log('AI Service initialized with Anthropic Claude (env)');
      }
    } else if (openaiKey) {
      const openaiConfig: any = { apiKey: openaiKey };
      if (process.env.AZURE_OPENAI_ENDPOINT) {
        openaiConfig.baseURL = process.env.AZURE_OPENAI_ENDPOINT;
      }
      this.openaiClient = new OpenAI(openaiConfig);
      if (agentforceEnabled) {
        this.provider = 'agentforce';
        this.secondaryProvider = 'openai';
        this.model = 'gpt-4-turbo-preview';
        console.log('AI Service: Multi-provider mode - Agentforce + OpenAI');
      } else {
        this.provider = 'openai';
        this.model = 'gpt-4-turbo-preview';
        console.log('AI Service initialized with OpenAI (env)');
      }
    } else if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
      if (agentforceEnabled) {
        this.provider = 'agentforce';
        this.secondaryProvider = 'gemini';
        this.model = 'gemini-pro';
        console.log('AI Service: Multi-provider mode - Agentforce + Google Gemini');
      } else {
        this.provider = 'gemini';
        this.model = 'gemini-pro';
        console.log('AI Service initialized with Google Gemini (env)');
      }
    } else if (agentforceEnabled) {
      // Only Agentforce, no external AI
      this.provider = 'agentforce';
      this.model = 'agentforce';
      console.log('AI Service initialized with Salesforce Agentforce only (env)');
    } else {
      this.provider = 'none';
      console.warn('No AI API key configured. AI features will be disabled.');
      console.warn('Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_AI_API_KEY');
      console.warn('Or set AGENTFORCE_ENABLED=true to use Salesforce Agentforce');
      console.warn('Or configure through Admin Settings UI');
    }
  }

  /**
   * Fetch Gong call context for an opportunity to enrich AI prompts
   */
  private async getGongContext(opportunityId?: string, accountId?: string): Promise<string> {
    try {
      const { createGongServiceFromDB } = await import('./gongService');
      const gongService = await createGongServiceFromDB();
      if (!gongService) return '';

      let calls: any[] = [];
      if (opportunityId) {
        calls = await gongService.getCallsForOpportunity(opportunityId);
      } else if (accountId) {
        calls = await gongService.getCallsForAccount(accountId);
      }

      if (calls.length === 0) return '';

      let context = '\n\n**Gong Call Insights:**\n';
      calls.slice(0, 5).forEach((call, idx) => {
        context += `${idx + 1}. "${call.title}" - ${call.started ? new Date(call.started).toLocaleDateString() : 'Unknown date'}`;
        context += ` (${Math.round(call.duration / 60)} min)`;
        if (call.topics && call.topics.length > 0) {
          context += ` - Topics: ${call.topics.join(', ')}`;
        }
        if (call.sentiment) {
          context += ` - Sentiment: ${call.sentiment}`;
        }
        context += '\n';
      });

      return context;
    } catch (error) {
      console.error('Error fetching Gong context for AI:', error);
      return '';
    }
  }

  async generateDealSummary(opportunityData: any, activityData: any[]): Promise<DealSummary> {
    await this.ensureInitialized();

    if (!this.anthropicClient && !this.openaiClient && !this.geminiClient && !this.agentforceConfig?.enabled) {
      return this.getPlaceholderSummary();
    }

    try {
      // Enrich with Gong data if available
      const gongContext = await this.getGongContext(opportunityData?.Id, opportunityData?.AccountId);
      const prompt = this.buildDealSummaryPrompt(opportunityData, activityData) + gongContext;

      switch (this.provider) {
        case 'anthropic':
          return await this.generateWithAnthropic(prompt);
        case 'openai':
          return await this.generateWithOpenAI(prompt);
        case 'gemini':
          return await this.generateWithGemini(prompt);
        case 'agentforce':
          return await this.generateWithAgentforce(prompt, opportunityData);
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
      model: this.model || 'claude-3-7-sonnet-20250219',
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

  private async generateWithAgentforce(prompt: string, opportunityData: any): Promise<DealSummary> {
    if (!this.agentforceConfig?.enabled) {
      throw new Error('Agentforce not enabled');
    }
    if (!this.sfConnection) {
      throw new Error('Salesforce connection not available for Agentforce');
    }

    try {
      // Call Salesforce Einstein/Agentforce API
      // This uses the Prompt Builder/Einstein Generative API
      const templateId = this.agentforceConfig.promptTemplateId;

      if (templateId) {
        // Use configured prompt template
        const response: any = await this.sfConnection.request({
          method: 'POST',
          url: `/services/data/v60.0/einstein/prompt-templates/${templateId}/generations`,
          body: JSON.stringify({
            isPreview: false,
            inputParams: {
              opportunityId: opportunityData.Id,
              opportunityName: opportunityData.Name,
              accountName: opportunityData.Account?.Name || 'Unknown',
              stage: opportunityData.StageName,
              amount: opportunityData.Amount,
              closeDate: opportunityData.CloseDate,
            },
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.generations && response.generations.length > 0) {
          return this.parseDealSummary(response.generations[0].text);
        }
      }

      // Fallback: Use Einstein Chat Completions API (Einstein GPT)
      const chatResponse: any = await this.sfConnection.request({
        method: 'POST',
        url: '/services/data/v60.0/einstein/ai-chat/completions',
        body: JSON.stringify({
          model: 'sfdc_ai__DefaultGPT4Omni',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          maxTokens: 1500,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (chatResponse.choices && chatResponse.choices.length > 0) {
        return this.parseDealSummary(chatResponse.choices[0].message.content);
      }

      throw new Error('No response from Agentforce');
    } catch (error: any) {
      console.error('Agentforce API error:', error);
      // If Agentforce API fails, return a placeholder with error info
      return {
        overview: `Agentforce is configured but encountered an error. The opportunity "${opportunityData.Name}" may need manual review.`,
        stakeholders: [],
        currentStatus: `Stage: ${opportunityData.StageName}, Amount: $${opportunityData.Amount?.toLocaleString() || 0}`,
        risks: ['Unable to generate AI insights via Agentforce'],
        nextActions: ['Verify Agentforce configuration in Salesforce', 'Check Einstein API permissions'],
        generatedAt: new Date().toISOString(),
      };
    }
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
- GOOGLE_AI_API_KEY (for Gemini) - Get from https://makersuite.google.com/
- AGENTFORCE_ENABLED=true (for Salesforce Agentforce) - Uses your Salesforce org's Einstein AI`,
      stakeholders: [],
      currentStatus: 'Not available - AI service not configured',
      risks: ['No API key configured'],
      nextActions: ['Configure an AI API key to enable smart deal summaries'],
      generatedAt: new Date().toISOString(),
    };
  }

  async askQuestion(question: string, userData: any): Promise<string> {
    await this.ensureInitialized();

    if (!this.anthropicClient && !this.openaiClient && !this.geminiClient && !this.agentforceConfig?.enabled) {
      return 'AI Assistant is not configured. Please contact your administrator to set up an AI provider.';
    }

    try {
      // Gong data is now passed in userData from the API route (across all opps)
      const prompt = this.buildAssistantPrompt(question, userData);

      // In multi-provider mode, prefer external AI (Claude/OpenAI/Gemini) for chat
      // because it's better for general conversation and complex reasoning
      const chatProvider = this.secondaryProvider !== 'none' ? this.secondaryProvider : this.provider;

      switch (chatProvider) {
        case 'anthropic':
          return await this.askWithAnthropic(prompt);
        case 'openai':
          return await this.askWithOpenAI(prompt);
        case 'gemini':
          return await this.askWithGemini(prompt);
        case 'agentforce':
          return await this.askWithAgentforce(prompt);
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
      model: this.model || 'claude-3-7-sonnet-20250219',
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

  private async askWithAgentforce(prompt: string): Promise<string> {
    if (!this.agentforceConfig?.enabled) {
      throw new Error('Agentforce not enabled');
    }
    if (!this.sfConnection) {
      throw new Error('Salesforce connection not available for Agentforce');
    }

    try {
      // Use Einstein Chat Completions API for general questions
      const chatResponse: any = await this.sfConnection.request({
        method: 'POST',
        url: '/services/data/v60.0/einstein/ai-chat/completions',
        body: JSON.stringify({
          model: 'sfdc_ai__DefaultGPT4Omni',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          maxTokens: 1000,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (chatResponse.choices && chatResponse.choices.length > 0) {
        return chatResponse.choices[0].message.content;
      }

      throw new Error('No response from Agentforce');
    } catch (error: any) {
      console.error('Agentforce Chat API error:', error);
      return `I'm sorry, I couldn't process your question through Agentforce. Error: ${error.message || 'Unknown error'}. Please try again or contact your administrator to verify Agentforce configuration.`;
    }
  }

  private buildAssistantPrompt(question: string, userData: any): string {
    const { opportunities, accounts, tasks, userName, userRole, gongCalls, gongEmails } = userData;

    let contextInfo = `You are a helpful sales assistant for ${userName || 'the user'}`;

    if (userRole) {
      contextInfo += `, who is a ${userRole}`;
    }

    contextInfo += `. Answer their question based ONLY on the data provided below. Do NOT fabricate or guess account names, deal names, metrics, or any other data that is not explicitly listed.\n\n`;

    // --- Opportunities section ---
    if (opportunities && opportunities.length > 0) {
      contextInfo += `**Opportunities:**\n`;
      opportunities.forEach((opp: any, idx: number) => {
        contextInfo += `${idx + 1}. ${opp.Name} — ${opp.Account?.Name || 'Unknown Account'}`;
        if (opp.Owner?.Name) contextInfo += ` (Owner: ${opp.Owner.Name})`;
        contextInfo += `\n`;
        contextInfo += `   Stage: ${opp.StageName} | Amount: $${opp.Amount?.toLocaleString() || 0}`;
        if (opp.ARR__c) contextInfo += ` | ARR: $${Number(opp.ARR__c).toLocaleString()}`;
        if (opp.Total_Contract_Value__c) contextInfo += ` | TCV: $${Number(opp.Total_Contract_Value__c).toLocaleString()}`;
        contextInfo += `\n`;
        contextInfo += `   Close Date: ${opp.CloseDate || 'N/A'}`;
        if (opp.DaysInStage__c) contextInfo += ` | Days in Stage: ${opp.DaysInStage__c}`;
        if (opp.Type) contextInfo += ` | Type: ${opp.Type}`;
        contextInfo += `\n`;
        if (opp.IsAtRisk__c) contextInfo += `   ⚠️ AT RISK\n`;
        if (opp.Risk__c) contextInfo += `   Risk: ${opp.Risk__c}\n`;
        if (opp.Unresolved_Risks__c) contextInfo += `   Unresolved Risks: ${opp.Unresolved_Risks__c}\n`;
        // MEDDPICC
        if (opp.MEDDPICC_Overall_Score__c) contextInfo += `   MEDDPICC Score: ${opp.MEDDPICC_Overall_Score__c}%\n`;
        const meddpiccFields: [string, string][] = [
          ['COM_Metrics__c', 'Metrics'], ['MEDDPICCR_Economic_Buyer__c', 'Econ Buyer'],
          ['MEDDPICCR_Decision_Criteria__c', 'Decision Criteria'], ['MEDDPICCR_Decision_Process__c', 'Decision Process'],
          ['MEDDPICCR_Paper_Process__c', 'Paper Process'], ['MEDDPICCR_Implicate_Pain__c', 'Implicate Pain'],
          ['MEDDPICCR_Champion__c', 'Champion'], ['MEDDPICCR_Competition__c', 'Competition'],
          ['MEDDPICCR_Risks__c', 'Risks'],
        ];
        const meddpiccParts = meddpiccFields
          .filter(([field]) => opp[field])
          .map(([field, label]) => `${label}: ${opp[field]}`);
        if (meddpiccParts.length > 0) contextInfo += `   MEDDPICC Detail: ${meddpiccParts.join(' | ')}\n`;
        if (opp.Economic_Buyer_Name__c) {
          contextInfo += `   Economic Buyer: ${opp.Economic_Buyer_Name__c}`;
          if (opp.Economic_Buyer_Title__c) contextInfo += ` (${opp.Economic_Buyer_Title__c})`;
          contextInfo += `\n`;
        }
        // Command of Message
        const comParts: string[] = [];
        if (opp.Command_Why_Do_Anything__c) comParts.push(`Why Do Anything: ${opp.Command_Why_Do_Anything__c}`);
        if (opp.Command_Why_Now__c) comParts.push(`Why Now: ${opp.Command_Why_Now__c}`);
        if (opp.Command_Why_Us__c) comParts.push(`Why Us: ${opp.Command_Why_Us__c}`);
        if (opp.Command_Overall_Score__c) comParts.push(`Overall: ${opp.Command_Overall_Score__c}`);
        if (comParts.length > 0) contextInfo += `   Command of Message: ${comParts.join(' | ')}\n`;
        // Deal details
        if (opp.NextStep) contextInfo += `   Next Step: ${opp.NextStep}\n`;
        if (opp.Milestone__c) contextInfo += `   Milestone: ${opp.Milestone__c}\n`;
        if (opp.License_Seats__c) contextInfo += `   License Seats: ${opp.License_Seats__c}\n`;
        // Gong SF fields
        const gongParts: string[] = [];
        if (opp.Gong_Call_Count__c) gongParts.push(`Calls: ${opp.Gong_Call_Count__c}`);
        if (opp.Gong_Last_Call_Date__c) gongParts.push(`Last Call: ${opp.Gong_Last_Call_Date__c}`);
        if (opp.Gong_Sentiment__c) gongParts.push(`Sentiment: ${opp.Gong_Sentiment__c}`);
        if (opp.Gong_Competitor_Mentions__c) gongParts.push(`Competitors: ${opp.Gong_Competitor_Mentions__c}`);
        if (gongParts.length > 0) contextInfo += `   Gong: ${gongParts.join(' | ')}\n`;
        contextInfo += `\n`;
      });
    }

    // --- Accounts section ---
    if (accounts && accounts.length > 0) {
      contextInfo += `**Accounts:**\n`;
      accounts.forEach((acct: any, idx: number) => {
        contextInfo += `${idx + 1}. ${acct.Name}\n`;
        // 6sense
        const sixParts: string[] = [];
        if (acct.accountBuyingStage6sense__c) sixParts.push(`Buying Stage: ${acct.accountBuyingStage6sense__c}`);
        if (acct.accountIntentScore6sense__c) sixParts.push(`Intent: ${acct.accountIntentScore6sense__c}`);
        if (acct.accountProfileFit6sense__c) sixParts.push(`Fit: ${acct.accountProfileFit6sense__c}`);
        if (sixParts.length > 0) contextInfo += `   6sense: ${sixParts.join(' | ')}\n`;
        // Clay
        const clayParts: string[] = [];
        if (acct.Clay_Industry__c) clayParts.push(`Industry: ${acct.Clay_Industry__c}`);
        if (acct.Clay_Employee_Count__c) clayParts.push(`Employees: ${acct.Clay_Employee_Count__c}`);
        if (acct.Clay_Revenue__c) clayParts.push(`Revenue: $${Number(acct.Clay_Revenue__c).toLocaleString()}`);
        if (clayParts.length > 0) contextInfo += `   Firmographic: ${clayParts.join(' | ')}\n`;
        // Health
        if (acct.Customer_Stage__c) contextInfo += `   Customer Stage: ${acct.Customer_Stage__c}\n`;
        if (acct.Risk__c) contextInfo += `   Account Risk: ${acct.Risk__c}\n`;
        if (acct.Total_ARR__c) contextInfo += `   Total ARR: $${Number(acct.Total_ARR__c).toLocaleString()}\n`;
        if (acct.Current_Gainsight_Score__c) contextInfo += `   Gainsight Score: ${acct.Current_Gainsight_Score__c}\n`;
        if (acct.Agreement_Expiry_Date__c) contextInfo += `   Agreement Expiry: ${acct.Agreement_Expiry_Date__c}\n`;
        if (acct.Last_QBR__c) contextInfo += `   Last QBR: ${acct.Last_QBR__c}\n`;
        if (acct.Last_Exec_Check_In__c) contextInfo += `   Last Exec Check-In: ${acct.Last_Exec_Check_In__c}\n`;
        // Usage
        const usageParts: string[] = [];
        if (acct.Contract_Total_License_Seats__c) usageParts.push(`Seats: ${acct.Contract_Total_License_Seats__c}`);
        if (acct.Total_Active_Users__c) usageParts.push(`Active: ${acct.Total_Active_Users__c}`);
        if (acct.License_Utilization_Max__c) usageParts.push(`Util(Max): ${acct.License_Utilization_Max__c}%`);
        if (acct.License_Utilization_Learn__c) usageParts.push(`Util(Learn): ${acct.License_Utilization_Learn__c}%`);
        if (acct.License_Utilization_Comms__c) usageParts.push(`Util(Comms): ${acct.License_Utilization_Comms__c}%`);
        if (acct.License_Utilization_Tasks__c) usageParts.push(`Util(Tasks): ${acct.License_Utilization_Tasks__c}%`);
        if (usageParts.length > 0) contextInfo += `   Usage: ${usageParts.join(' | ')}\n`;
        if (acct.Max_Usage_Trend__c) contextInfo += `   Usage Trend: ${acct.Max_Usage_Trend__c}\n`;
        contextInfo += `\n`;
      });
    }

    // --- Tasks section ---
    if (tasks && tasks.length > 0) {
      contextInfo += `**Upcoming Tasks:**\n`;
      tasks.forEach((task: any, idx: number) => {
        contextInfo += `${idx + 1}. ${task.subject} — Due: ${task.dueDate || 'No date'}`;
        if (task.priority === 'High') contextInfo += ` [HIGH]`;
        contextInfo += `\n`;
      });
      contextInfo += `\n`;
    }

    // --- Gong Insights section ---
    if (gongCalls && gongCalls.length > 0) {
      contextInfo += `**Gong Call Insights (recent across all deals):**\n`;
      gongCalls.forEach((call: any, idx: number) => {
        contextInfo += `${idx + 1}. "${call.title}"`;
        if (call.opportunityName) contextInfo += ` (${call.opportunityName})`;
        contextInfo += ` — ${call.started ? new Date(call.started).toLocaleDateString() : 'Unknown date'}`;
        if (call.duration) contextInfo += ` (${Math.round(call.duration / 60)} min)`;
        if (call.topics && call.topics.length > 0) contextInfo += ` | Topics: ${call.topics.join(', ')}`;
        if (call.sentiment) contextInfo += ` | Sentiment: ${call.sentiment}`;
        contextInfo += `\n`;
      });
      contextInfo += `\n`;
    }

    if (gongEmails && gongEmails.length > 0) {
      contextInfo += `**Gong Email Activity (last 30 days):**\n`;
      contextInfo += `Total tracked emails: ${gongEmails.length}\n`;
      const replied = gongEmails.filter((e: any) => e.replied).length;
      const bounced = gongEmails.filter((e: any) => e.bounced).length;
      contextInfo += `Replied: ${replied} | Bounced: ${bounced}\n\n`;
    }

    contextInfo += `**User's Question:** ${question}\n\n`;
    contextInfo += `Provide a helpful, concise answer (2-4 sentences). Be specific and actionable. If suggesting they focus on something, explain why. IMPORTANT: Only reference opportunities, accounts, and data that appear above — do not invent or guess names or metrics.`;

    return contextInfo;
  }

  /**
   * Ask the AI with a pre-built prompt and configurable max_tokens.
   * Used by GongAISearchService for scope-specific prompts.
   */
  async askWithContext(prompt: string, maxTokens: number = 2000): Promise<string> {
    await this.ensureInitialized();

    if (!this.anthropicClient && !this.openaiClient && !this.geminiClient && !this.agentforceConfig?.enabled) {
      return 'AI is not configured. Please contact your administrator to set up an AI provider.';
    }

    const chatProvider = this.secondaryProvider !== 'none' ? this.secondaryProvider : this.provider;

    switch (chatProvider) {
      case 'anthropic': {
        if (!this.anthropicClient) throw new Error('Anthropic client not initialized');
        const message = await this.anthropicClient.messages.create({
          model: this.model || 'claude-3-7-sonnet-20250219',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        });
        return message.content[0].type === 'text' ? message.content[0].text : '';
      }
      case 'openai': {
        if (!this.openaiClient) throw new Error('OpenAI client not initialized');
        const completion = await this.openaiClient.chat.completions.create({
          model: this.model || 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.7,
        });
        return completion.choices[0]?.message?.content || '';
      }
      case 'gemini': {
        if (!this.geminiClient) throw new Error('Gemini client not initialized');
        const model = this.geminiClient.getGenerativeModel({ model: this.model || 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      }
      case 'agentforce':
        return await this.askWithAgentforce(prompt);
      default:
        return 'AI is not configured.';
    }
  }

  /**
   * Ask with web search — Anthropic-only.
   * Uses Claude's built-in web search tool to find real-time information.
   * Always uses claude-sonnet-4-5-20250929 (web search requires a compatible model).
   */
  async askWithWebSearch(prompt: string, maxTokens: number = 2000): Promise<{
    text: string;
    citations: Array<{ url: string; title: string }>;
  }> {
    await this.ensureInitialized();

    if (!this.anthropicClient) {
      return { text: 'Web search requires Anthropic Claude to be configured.', citations: [] };
    }

    // Web search requires a compatible model — always use Sonnet 4.5
    const webSearchModel = 'claude-sonnet-4-5-20250929';
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const message = await this.anthropicClient.messages.create({
          model: webSearchModel,
          max_tokens: maxTokens,
          tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
          messages: [{ role: 'user', content: prompt }],
        });

        // Parse response — extract text and citations from content blocks
        let text = '';
        const citations: Array<{ url: string; title: string }> = [];

        for (const block of message.content) {
          if (block.type === 'text') {
            text = block.text;
          } else if ((block as any).type === 'web_search_tool_result') {
            const searchBlock = block as any;
            if (searchBlock.content && Array.isArray(searchBlock.content)) {
              for (const result of searchBlock.content) {
                if (result.type === 'web_search_result' && result.url) {
                  citations.push({
                    url: result.url,
                    title: result.title || result.url,
                  });
                }
              }
            }
          }
        }

        return { text, citations };
      } catch (error: any) {
        const status = error?.status || error?.statusCode;
        // Retry on 503 (overloaded) or 529 (overloaded)
        if ((status === 503 || status === 529) && attempt < maxRetries) {
          console.warn(`[AIService] Web search returned ${status}, retrying (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
          continue;
        }
        console.error('[AIService] Web search error:', error);
        return { text: `Web search failed: ${error.message}`, citations: [] };
      }
    }

    return { text: 'Web search failed after retries.', citations: [] };
  }

  /**
   * Reinitialize the AI service from database config.
   * Called when admin saves/deletes an API key so the running
   * singleton picks up the new configuration without a restart.
   */
  public async reinitialize(): Promise<void> {
    // Reset all clients
    this.anthropicClient = null;
    this.openaiClient = null;
    this.geminiClient = null;
    this.agentforceConfig = null;
    this.provider = 'none' as AIProvider;
    this.secondaryProvider = 'none';
    this.model = '';
    this.isInitialized = false;

    this.initPromise = this.initializeAsync();
    await this.initPromise;
    console.log(`AI Service reinitialized. Provider: ${this.provider}`);
  }

  // Get current provider configuration status
  public async getProviderStatus(): Promise<{
    primaryProvider: AIProvider;
    secondaryProvider: AIProvider;
    agentforceEnabled: boolean;
    chatProvider: AIProvider;
    recommendationProvider: AIProvider;
  }> {
    await this.ensureInitialized();

    const chatProvider = this.secondaryProvider !== 'none' ? this.secondaryProvider : this.provider;
    const recommendationProvider = this.provider;

    return {
      primaryProvider: this.provider,
      secondaryProvider: this.secondaryProvider,
      agentforceEnabled: this.agentforceConfig?.enabled || false,
      chatProvider,
      recommendationProvider,
    };
  }
}

export const aiService = new AIService();
