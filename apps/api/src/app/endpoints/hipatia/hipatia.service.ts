import { EncryptionService } from '@ghostfolio/api/services/encryption/encryption.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import {
  PROPERTY_API_KEY_OPENROUTER,
  PROPERTY_OPENROUTER_MODEL
} from '@ghostfolio/common/config';

import { Injectable } from '@nestjs/common';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { HipatiaMessageRole } from '@prisma/client';
import { type ModelMessage, generateText } from 'ai';

const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT = `You are Hipatia, a neutral and knowledgeable financial assistant integrated into Ghostfolio, a personal portfolio management application.
Your mission is to help users manage, analyze, and improve their investment portfolio with a long-term perspective.
Always maintain a neutral, objective tone. Do not recommend specific securities as definitive buys or sells — frame all suggestions as educational and analytical insights.
When analyzing portfolios, consider diversification, risk exposure, asset allocation, and long-term performance.
Respond in the same language the user writes to you. Be concise and practical.`;

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
  }): Promise<{ conversationId: string; reply: string }> {
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

    // Get or create the conversation (strict userId ownership check)
    let conversation = conversationId
      ? await this.prismaService.hipatiaConversation.findFirst({
          where: { id: conversationId, userId }
        })
      : null;

    if (!conversation) {
      conversation = await this.prismaService.hipatiaConversation.create({
        data: { userId }
      });
    }

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

    // Call OpenRouter
    const openRouterProvider = createOpenRouter({ apiKey: openRouterApiKey });

    const { text } = await generateText({
      messages,
      model: openRouterProvider.chat(openRouterModel),
      system: SYSTEM_PROMPT
    });

    // Save assistant reply
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

    return { conversationId: conversation.id, reply: text };
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
}
