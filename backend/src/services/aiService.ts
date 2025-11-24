import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface DealSummary {
  overview: string;
  stakeholders: string[];
  currentStatus: string;
  risks: string[];
  nextActions: string[];
  generatedAt: string;
}

type AIProvider = 'anthropic' | 'openai' | 'gemini';

export class AIService {
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private geminiClient: GoogleGenerativeAI | null = null;
  private provider: AIProvider;

  constructor() {
    // Determine which AI provider to use based on available API keys
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GOOGLE_AI_API_KEY;

    // Priority: Anthropic > OpenAI > Gemini (you can change this order)
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
      this.provider = 'anthropic';
      console.log('AI Service initialized with Anthropic Claude');
    } else if (openaiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiKey });
      this.provider = 'openai';
      console.log('AI Service initialized with OpenAI');
    } else if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
      this.provider = 'gemini';
      console.log('AI Service initialized with Google Gemini');
    } else {
      this.provider = 'anthropic'; // Default, but will show error message
      console.warn('No AI API key configured. AI features will be disabled.');
      console.warn('Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY');
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
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    return this.parseDealSummary(responseText);
  }

  private async generateWithOpenAI(prompt: string): Promise<DealSummary> {
    if (!this.openaiClient) throw new Error('OpenAI client not initialized');

    const completion = await this.openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    return this.parseDealSummary(responseText);
  }

  private async generateWithGemini(prompt: string): Promise<DealSummary> {
    if (!this.geminiClient) throw new Error('Gemini client not initialized');

    const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
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
}

export const aiService = new AIService();
