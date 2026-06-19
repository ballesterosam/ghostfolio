import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { HasPermission } from '@ghostfolio/api/decorators/has-permission.decorator';
import { HasPermissionGuard } from '@ghostfolio/api/guards/has-permission.guard';
import { EncryptionService } from '@ghostfolio/api/services/encryption/encryption.service';
import { IntegrationProviderRegistry } from '@ghostfolio/api/services/platform-integration/integration-provider.registry';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PlatformSyncQueueService } from '@ghostfolio/api/services/queues/platform-sync/platform-sync-queue.service';
import { ConnectIntegrationDto } from '@ghostfolio/common/dtos';
import { SUPPORTED_INTEGRATIONS } from '@ghostfolio/common/integration-registry';
import {
  ConnectIntegrationResponse,
  PlatformIntegrationDetails
} from '@ghostfolio/common/interfaces';
import { permissions } from '@ghostfolio/common/permissions';
import { RequestWithUser } from '@ghostfolio/common/types';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  UseGuards
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

@Controller('platform-integration')
export class PlatformIntegrationController {
  public constructor(
    private readonly accountService: AccountService,
    private readonly encryptionService: EncryptionService,
    private readonly integrationProviderRegistry: IntegrationProviderRegistry,
    private readonly prismaService: PrismaService,
    private readonly platformSyncQueueService: PlatformSyncQueueService,
    @Inject(REQUEST) private readonly request: RequestWithUser
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  public async getIntegrations(): Promise<PlatformIntegrationDetails[]> {
    const integrations = await this.prismaService.platformIntegration.findMany({
      include: {
        account: true
      },
      where: {
        userId: this.request.user.id
      }
    });

    return integrations.map((integration) => ({
      accountId: integration.accountId,
      accountCurrency: integration.account?.currency || 'EUR',
      accountName: integration.account?.name || '',
      externalAccountId: integration.externalAccountId,
      id: integration.id,
      isActive: integration.isActive,
      lastSyncAt: integration.lastSyncAt,
      lastSyncError: integration.lastSyncError,
      lastSyncStatus: integration.lastSyncStatus,
      provider: integration.provider
    }));
  }

  @Post('connect')
  @HasPermission(permissions.createAccount)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async connectIntegration(
    @Body() body: ConnectIntegrationDto
  ): Promise<ConnectIntegrationResponse> {
    const userId = this.request.user.id;
    const { provider, credentials } = body;

    const providerInstance =
      this.integrationProviderRegistry.getProvider(provider);

    // Validate credentials
    const isValid = await providerInstance.validateCredentials(credentials);
    if (!isValid) {
      throw new HttpException('Invalid credentials', StatusCodes.UNAUTHORIZED);
    }

    // Get external accounts
    let externalAccounts;
    try {
      externalAccounts = await providerInstance.getAccounts(credentials);
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve accounts: ${error.message}`,
        StatusCodes.BAD_REQUEST
      );
    }

    const accountsCreated: {
      id: string;
      name: string;
      externalAccountId: string;
    }[] = [];

    const encrypted = this.encryptionService.encrypt(credentials);

    // Find or create platform
    let platformId: string | undefined;
    const providerInfo = SUPPORTED_INTEGRATIONS.find(
      (integration) => integration.provider === provider
    );

    if (providerInfo) {
      let platform = await this.prismaService.platform.findUnique({
        where: { url: providerInfo.url }
      });
      if (!platform) {
        platform = await this.prismaService.platform.create({
          data: {
            name: providerInfo.name,
            url: providerInfo.url
          }
        });
      }
      platformId = platform.id;
    }

    for (const extAcc of externalAccounts) {
      // Check if integration already exists
      const integration =
        await this.prismaService.platformIntegration.findFirst({
          where: {
            userId,
            provider,
            externalAccountId: extAcc.id
          }
        });

      if (integration) {
        // Reactivate / Update credentials if exists
        await this.prismaService.platformIntegration.update({
          data: {
            isActive: true,
            credentialsIv: encrypted.iv,
            credentialsKdfSalt: encrypted.kdfSalt,
            credentialsTag: encrypted.tag,
            encryptedCredentials: encrypted.encrypted,
            lastSyncError: null,
            lastSyncStatus: 'PENDING'
          },
          where: {
            id: integration.id
          }
        });

        // Ensure the account has the platform linked
        if (platformId) {
          await this.prismaService.account.update({
            data: {
              platform: { connect: { id: platformId } }
            },
            where: {
              id_userId: {
                id: integration.accountId,
                userId
              }
            }
          });
        }

        accountsCreated.push({
          id: integration.accountId,
          externalAccountId: extAcc.id,
          name: extAcc.name
        });

        // Trigger initial sync for this integration
        await this.platformSyncQueueService.addSyncIntegrationJob(
          integration.id
        );
      } else {
        // Create new account
        const account = await this.accountService.createAccount(
          {
            balance: 0,
            currency: extAcc.currency,
            name: extAcc.name,
            user: { connect: { id: userId } },
            platform: platformId ? { connect: { id: platformId } } : undefined
          },
          userId
        );

        // Create integration link
        const newIntegration =
          await this.prismaService.platformIntegration.create({
            data: {
              accountId: account.id,
              credentialsIv: encrypted.iv,
              credentialsKdfSalt: encrypted.kdfSalt,
              credentialsTag: encrypted.tag,
              encryptedCredentials: encrypted.encrypted,
              externalAccountId: extAcc.id,
              provider,
              userId
            }
          });

        accountsCreated.push({
          id: account.id,
          externalAccountId: extAcc.id,
          name: extAcc.name
        });

        // Trigger initial sync for this integration
        await this.platformSyncQueueService.addSyncIntegrationJob(
          newIntegration.id
        );
      }
    }

    return { accountsCreated };
  }

  @Post(':id/sync')
  @UseGuards(AuthGuard('jwt'))
  public async syncIntegration(@Param('id') id: string) {
    const integration = await this.prismaService.platformIntegration.findUnique(
      {
        where: { id }
      }
    );

    if (!integration || integration.userId !== this.request.user.id) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.NOT_FOUND),
        StatusCodes.NOT_FOUND
      );
    }

    await this.platformSyncQueueService.addSyncIntegrationJob(id);
    return { success: true };
  }

  @Delete(':id')
  @HasPermission(permissions.deleteAccount)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async disconnectIntegration(@Param('id') id: string) {
    const integration = await this.prismaService.platformIntegration.findUnique(
      {
        where: { id }
      }
    );

    if (!integration || integration.userId !== this.request.user.id) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.NOT_FOUND),
        StatusCodes.NOT_FOUND
      );
    }

    await this.prismaService.platformIntegration.delete({
      where: {
        id
      }
    });

    return { success: true };
  }
}
