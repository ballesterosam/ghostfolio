import { EncryptionService } from '@ghostfolio/api/services/encryption/encryption.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import {
  PROPERTY_API_KEY_OPENROUTER,
  PROPERTY_OPENROUTER_MODEL
} from '@ghostfolio/common/config';
import { UserSettings } from '@ghostfolio/common/interfaces';

import { Injectable } from '@nestjs/common';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { HipatiaMessageRole } from '@prisma/client';
import { type ModelMessage, generateText, stepCountIs } from 'ai';

import { buildReadTools } from './hipatia-read-tools';
import { buildWriteTools } from './hipatia-write-tools';

const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_STEPS = 10;

const WRITE_TOOL_NAMES = new Set([
  'create_account',
  'create_activity',
  'create_amortization',
  'create_mortgage',
  'create_real_estate_property',
  'delete_activity',
  'delete_goal',
  'set_goal',
  'update_activity'
]);

const PHILOSOPHY_DESCRIPTIONS: Record<string, string> = {
  DIVIDEND:
    'Dividend investing — focus on companies with consistent, growing dividend payments and capital preservation.',
  GROWTH:
    'Growth investing — focus on companies with strong revenue and earnings growth, accepting higher valuations for future potential.',
  VALUE:
    'Value investing — focus on fundamentally undervalued companies with strong balance sheets and margin of safety.'
};

function buildSystemPrompt(context?: {
  memories?: { category?: string | null; content: string }[];
  philosophy?: string;
  preferences?: string;
}): string {
  const today = new Date().toISOString().slice(0, 10);

  let userProfile = '';

  if (context?.philosophy) {
    const desc =
      PHILOSOPHY_DESCRIPTIONS[context.philosophy] ?? context.philosophy;
    userProfile += `\n### Investment philosophy: ${context.philosophy}\n${desc}\n`;
  }

  if (context?.preferences?.trim()) {
    userProfile += `\n### Personal preferences\n${context.preferences.trim()}\n`;
  }

  if (context?.memories?.length) {
    userProfile += `\n### Things I remember about you\n`;

    for (const m of context.memories) {
      userProfile += m.category
        ? `- [${m.category}] ${m.content}\n`
        : `- ${m.content}\n`;
    }
  }

  return `You are Hipatia, a neutral and knowledgeable financial assistant integrated into Ghostfolio, a personal portfolio management application.
Your mission is to help users manage, analyze, and improve their investment portfolio with a long-term perspective.
Always maintain a neutral, objective tone. Do not recommend specific securities as definitive buys or sells — frame all suggestions as educational and analytical insights.
When analyzing portfolios, consider diversification, risk exposure, asset allocation, and long-term performance.

Today's date is ${today}.
${userProfile ? `\n## Your user's profile\n${userProfile}` : ''}
## Read tools (use proactively to answer questions)
- get_accounts: List investment accounts
- get_activities: List transactions with optional filters by type and date
- get_goals: Retrieve annual savings goals
- get_portfolio_summary: Compute current open positions
- get_real_estate_properties: List real estate properties with full mortgage details

## Write tools (modify portfolio data)
- create_account: Create a new investment account
- create_activity: Record a transaction (BUY/SELL/DIVIDEND need symbol; FEE/INTEREST/LIABILITY need name)
- update_activity: Update date, quantity, price, fee, or comment of an existing activity (by ID)
- delete_activity: Delete an activity by ID
- create_real_estate_property: Add a real estate property
- create_mortgage: Add a mortgage to a property
- create_amortization: Record an early mortgage repayment
- set_goal: Create or update an annual savings goal
- delete_goal: Delete an annual goal by year

## Memory tool
- store_memory: Save a relevant insight about the user for future conversations (preferences, risk tolerance, excluded assets, life events). Call this proactively when the user reveals something meaningful about their financial situation or investment approach.

IMPORTANT — write tool rules:
1. Before calling any write tool, ensure you have ALL required fields. If anything is missing, ask the user.
2. Never use placeholder or guessed values. Ask rather than assume.
3. IDs for update/delete operations must come from a prior read tool call, not from user memory.

Respond in the same language the user writes to you. Be concise and practical.`;
}

@Injectable()
export class HipatiaService {
  public constructor(
    private readonly encryptionService: EncryptionService,
    private readonly prismaService: PrismaService,
    private readonly propertyService: PropertyService
  ) {}

  public async chat({
    conversationId,
    message,
    userId
  }: {
    conversationId?: string;
    message: string;
    userId: string;
  }): Promise<{
    conversationId: string;
    hasDataChanges: boolean;
    reply: string;
  }> {
    const [encryptedKey, openRouterModel] = await Promise.all([
      this.propertyService.getByKey<{
        encrypted: string;
        iv: string;
        kdfSalt: string;
        tag: string;
      }>(PROPERTY_API_KEY_OPENROUTER),
      this.propertyService.getByKey<string>(PROPERTY_OPENROUTER_MODEL)
    ]);

    if (!encryptedKey || !openRouterModel) {
      throw new Error(
        'OpenRouter API key and model must be configured in admin settings'
      );
    }

    let openRouterApiKey: string;

    try {
      openRouterApiKey = this.encryptionService.decrypt(
        encryptedKey.encrypted,
        encryptedKey.iv,
        encryptedKey.tag,
        encryptedKey.kdfSalt
      );
    } catch {
      throw new Error('Failed to decrypt OpenRouter API key');
    }

    // Fetch conversation, user settings, and memories in parallel
    const [existingConversation, settingsRecord, memories] = await Promise.all([
      conversationId
        ? this.prismaService.hipatiaConversation.findFirst({
            where: { id: conversationId, userId }
          })
        : Promise.resolve(null),
      this.prismaService.settings.findUnique({
        select: { settings: true },
        where: { userId }
      }),
      this.prismaService.hipatiaMemory.findMany({
        orderBy: { createdAt: 'asc' },
        select: { category: true, content: true },
        take: 20,
        where: { userId }
      })
    ]);

    const conversation =
      existingConversation ??
      (await this.prismaService.hipatiaConversation.create({
        data: { userId }
      }));

    const userSettings = settingsRecord?.settings as UserSettings | null;

    // Save user message before calling LLM
    await this.prismaService.hipatiaMessage.create({
      data: {
        content: message,
        conversationId: conversation.id,
        role: HipatiaMessageRole.USER
      }
    });

    // Build history for the LLM (last N messages including the one just saved)
    const historyRecords = await this.prismaService.hipatiaMessage.findMany({
      orderBy: { createdAt: 'asc' },
      take: MAX_HISTORY_MESSAGES,
      where: { conversationId: conversation.id }
    });

    const messages: ModelMessage[] = historyRecords.map((m) =>
      m.role === HipatiaMessageRole.USER
        ? { role: 'user' as const, content: m.content }
        : { role: 'assistant' as const, content: m.content }
    );

    const openRouterProvider = createOpenRouter({ apiKey: openRouterApiKey });

    const { steps, text } = await generateText({
      messages,
      model: openRouterProvider.chat(openRouterModel),
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
      system: buildSystemPrompt({
        memories,
        philosophy: userSettings?.hipatiaInvestmentPhilosophy,
        preferences: userSettings?.hipatiaInvestmentPreferences
      }),
      tools: {
        ...buildReadTools(this.prismaService, userId),
        ...buildWriteTools(this.prismaService, userId)
      }
    });

    const hasDataChanges = steps.some((step) =>
      step.toolCalls?.some((tc) => WRITE_TOOL_NAMES.has(tc.toolName))
    );

    // Save assistant reply (final text after all tool rounds)
    await this.prismaService.hipatiaMessage.create({
      data: {
        content: text,
        conversationId: conversation.id,
        role: HipatiaMessageRole.ASSISTANT
      }
    });

    // Auto-title from first user message
    if (!conversation.title) {
      await this.prismaService.hipatiaConversation.update({
        data: { title: message.slice(0, 60) },
        where: { id: conversation.id }
      });
    }

    return { conversationId: conversation.id, hasDataChanges, reply: text };
  }

  public async getConversations(userId: string) {
    return this.prismaService.hipatiaConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        createdAt: true,
        id: true,
        title: true,
        updatedAt: true
      },
      where: { userId }
    });
  }

  public async getMessages(conversationId: string, userId: string) {
    const conversation = await this.prismaService.hipatiaConversation.findFirst(
      {
        where: { id: conversationId, userId }
      }
    );

    if (!conversation) {
      return null;
    }

    return this.prismaService.hipatiaMessage.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        content: true,
        createdAt: true,
        id: true,
        role: true
      },
      where: { conversationId }
    });
  }

  public async deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    const conversation = await this.prismaService.hipatiaConversation.findFirst(
      {
        where: { id: conversationId, userId }
      }
    );

    if (!conversation) {
      return false;
    }

    await this.prismaService.hipatiaConversation.delete({
      where: { id: conversationId }
    });

    return true;
  }

  public async getMemories(userId: string) {
    return this.prismaService.hipatiaMemory.findMany({
      orderBy: { createdAt: 'desc' },
      select: { category: true, content: true, createdAt: true, id: true },
      where: { userId }
    });
  }

  public async deleteMemory(
    memoryId: string,
    userId: string
  ): Promise<boolean> {
    const existing = await this.prismaService.hipatiaMemory.findFirst({
      where: { id: memoryId, userId }
    });

    if (!existing) {
      return false;
    }

    await this.prismaService.hipatiaMemory.delete({ where: { id: memoryId } });

    return true;
  }
}
