import { HasPermission } from '@ghostfolio/api/decorators/has-permission.decorator';
import { HasPermissionGuard } from '@ghostfolio/api/guards/has-permission.guard';
import { permissions } from '@ghostfolio/common/permissions';
import type { RequestWithUser } from '@ghostfolio/common/types';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { CreateHipatiaMessageDto } from './dto/create-hipatia-message.dto';
import { HipatiaService } from './hipatia.service';

@Controller('hipatia')
export class HipatiaController {
  public constructor(
    private readonly hipatiaService: HipatiaService,
    @Inject(REQUEST) private readonly request: RequestWithUser
  ) {}

  @Post('chat')
  @HasPermission(permissions.updateUserSettings)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async chat(
    @Body() { conversationId, message }: CreateHipatiaMessageDto
  ) {
    return this.hipatiaService.chat({
      conversationId,
      message,
      userId: this.request.user.id
    });
  }

  @Get('conversations')
  @HasPermission(permissions.readAiPrompt)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getConversations() {
    return this.hipatiaService.getConversations(this.request.user.id);
  }

  @Get('conversations/:id/messages')
  @HasPermission(permissions.readAiPrompt)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getMessages(@Param('id') conversationId: string) {
    const messages = await this.hipatiaService.getMessages(
      conversationId,
      this.request.user.id
    );

    if (!messages) {
      throw new NotFoundException('Conversation not found');
    }

    return messages;
  }

  @Delete('conversations/:id')
  @HasPermission(permissions.updateUserSettings)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteConversation(@Param('id') conversationId: string) {
    const deleted = await this.hipatiaService.deleteConversation(
      conversationId,
      this.request.user.id
    );

    if (!deleted) {
      throw new NotFoundException('Conversation not found');
    }
  }

  @Get('memories')
  @HasPermission(permissions.readAiPrompt)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getMemories() {
    return this.hipatiaService.getMemories(this.request.user.id);
  }

  @Delete('memories/:id')
  @HasPermission(permissions.updateUserSettings)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteMemory(@Param('id') memoryId: string) {
    const deleted = await this.hipatiaService.deleteMemory(
      memoryId,
      this.request.user.id
    );

    if (!deleted) {
      throw new NotFoundException('Memory not found');
    }
  }
}
