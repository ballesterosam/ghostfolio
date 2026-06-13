import { AccountService } from '@ghostfolio/api/app/account/account.service';
import { EncryptionService } from '@ghostfolio/api/services/encryption/encryption.service';
import { IntegrationProviderRegistry } from '@ghostfolio/api/services/platform-integration/integration-provider.registry';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PlatformSyncQueueService } from '@ghostfolio/api/services/queues/platform-sync/platform-sync-queue.service';

import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { PlatformIntegrationController } from './platform-integration.controller';

describe('PlatformIntegrationController', () => {
  let controller: PlatformIntegrationController;
  let prismaService: PrismaService;

  const mockUser = { id: 'user-1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformIntegrationController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            account: {
              update: jest.fn()
            },
            platform: {
              findUnique: jest.fn(),
              create: jest.fn()
            },
            platformIntegration: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn()
            }
          }
        },
        {
          provide: AccountService,
          useValue: {
            createAccount: jest.fn()
          }
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest
              .fn()
              .mockReturnValue({ encrypted: 'enc', iv: 'iv', tag: 'tag' }),
            decrypt: jest.fn()
          }
        },
        {
          provide: IntegrationProviderRegistry,
          useValue: {
            getProvider: jest.fn()
          }
        },
        {
          provide: PlatformSyncQueueService,
          useValue: {
            addSyncIntegrationJob: jest.fn(),
            addSyncUserJob: jest.fn()
          }
        },
        {
          provide: REQUEST,
          useValue: { user: mockUser }
        }
      ]
    }).compile();

    controller = module.get<PlatformIntegrationController>(
      PlatformIntegrationController
    );
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getIntegrations', () => {
    it('should return integration details', async () => {
      const mockIntegration = {
        id: 'int-1',
        provider: 'INDEXA_CAPITAL',
        externalAccountId: 'ext-1',
        lastSyncAt: new Date(),
        lastSyncStatus: 'SUCCESS',
        lastSyncError: null,
        isActive: true,
        accountId: 'acc-1',
        account: {
          currency: 'EUR',
          name: 'Fondos'
        }
      };

      jest
        .spyOn(prismaService.platformIntegration, 'findMany')
        .mockResolvedValue([mockIntegration] as any);

      const result = await controller.getIntegrations();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        accountId: 'acc-1',
        accountCurrency: 'EUR',
        accountName: 'Fondos',
        externalAccountId: 'ext-1',
        id: 'int-1',
        isActive: true,
        lastSyncAt: mockIntegration.lastSyncAt,
        lastSyncError: null,
        lastSyncStatus: 'SUCCESS',
        provider: 'INDEXA_CAPITAL'
      });
    });
  });

  describe('disconnectIntegration', () => {
    it('should delete connection', async () => {
      const mockIntegration = {
        id: 'int-1',
        userId: 'user-1'
      };

      jest
        .spyOn(prismaService.platformIntegration, 'findUnique')
        .mockResolvedValue(mockIntegration as any);
      jest
        .spyOn(prismaService.platformIntegration, 'delete')
        .mockResolvedValue(mockIntegration as any);

      const result = await controller.disconnectIntegration('int-1');

      expect(result).toEqual({ success: true });
      expect(prismaService.platformIntegration.delete).toHaveBeenCalledWith({
        where: { id: 'int-1' }
      });
    });

    it('should throw NOT_FOUND if integration does not exist or belongs to other user', async () => {
      jest
        .spyOn(prismaService.platformIntegration, 'findUnique')
        .mockResolvedValue(null);

      await expect(controller.disconnectIntegration('int-1')).rejects.toThrow();
    });
  });
});
