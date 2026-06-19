import { IntegrationProvider } from '@prisma/client';

import { PlatformSyncService } from './platform-sync.service';

describe('PlatformSyncService', () => {
  let syncService: PlatformSyncService;
  let mockPrismaService: any;
  let mockEncryptionService: any;
  let mockProviderRegistry: any;
  let mockActivitiesService: any;
  let mockDataProviderService: any;
  let mockMarketDataService: any;
  let mockProvider: any;

  beforeEach(() => {
    mockPrismaService = {
      account: {
        update: jest.fn().mockResolvedValue({})
      },
      order: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      platformIntegration: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({})
      },
      symbolProfile: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1' })
      }
    };

    mockEncryptionService = {
      decrypt: jest.fn().mockReturnValue('decrypted-token')
    };

    mockProvider = {
      getCashBalance: jest.fn().mockResolvedValue(100.5),
      getPositions: jest.fn().mockResolvedValue([]),
      getTransactions: jest.fn().mockResolvedValue([
        {
          currency: 'EUR',
          date: new Date('2026-02-25'),
          isin: 'IE00BFPM9V94',
          name: 'Vanguard US 500',
          quantity: 10,
          reference: 'REF1',
          type: 'BUY',
          unitPrice: 50.0
        }
      ])
    };

    mockProviderRegistry = {
      getProvider: jest.fn().mockReturnValue(mockProvider)
    };

    mockActivitiesService = {
      createActivity: jest.fn().mockResolvedValue({})
    };

    mockDataProviderService = {
      search: jest.fn().mockResolvedValue({ items: [] })
    };

    mockMarketDataService = {
      updateMany: jest.fn().mockResolvedValue([])
    };

    syncService = new PlatformSyncService(
      mockPrismaService,
      mockEncryptionService,
      mockProviderRegistry,
      mockActivitiesService,
      mockDataProviderService,
      mockMarketDataService
    );
  });

  it('should successfully sync an integration', async () => {
    const mockIntegration = {
      id: 'integration-1',
      accountId: 'account-1',
      credentialsIv: 'iv',
      credentialsTag: 'tag',
      encryptedCredentials: 'encrypted',
      isActive: true,
      provider: IntegrationProvider.INDEXA_CAPITAL,
      userId: 'user-1'
    };

    mockPrismaService.platformIntegration.findUnique.mockResolvedValueOnce(
      mockIntegration
    );

    await syncService.syncIntegration('integration-1');

    // Verify SYNCING state was set
    expect(mockPrismaService.platformIntegration.update).toHaveBeenCalledWith({
      data: { lastSyncError: null, lastSyncStatus: 'SYNCING' },
      where: { id: 'integration-1' }
    });

    // Verify cash balance sync
    expect(mockProvider.getCashBalance).toHaveBeenCalledWith(
      'decrypted-token',
      undefined
    );
    expect(mockPrismaService.account.update).toHaveBeenCalledWith({
      data: { balance: 100.5 },
      where: { id_userId: { id: 'account-1', userId: 'user-1' } }
    });

    // Verify order was created
    expect(mockActivitiesService.createActivity).toHaveBeenCalled();

    // Verify SUCCESS state was set
    expect(mockPrismaService.platformIntegration.update).toHaveBeenCalledWith({
      data: {
        lastSyncAt: expect.any(Date),
        lastSyncError: null,
        lastSyncStatus: 'SUCCESS'
      },
      where: { id: 'integration-1' }
    });
  });

  it('should handle sync failures and log error to integration record', async () => {
    const mockIntegration = {
      id: 'integration-1',
      accountId: 'account-1',
      credentialsIv: 'iv',
      credentialsTag: 'tag',
      encryptedCredentials: 'encrypted',
      isActive: true,
      provider: IntegrationProvider.INDEXA_CAPITAL,
      userId: 'user-1'
    };

    mockPrismaService.platformIntegration.findUnique.mockResolvedValueOnce(
      mockIntegration
    );
    mockProvider.getTransactions.mockRejectedValueOnce(
      new Error('API error connection timed out')
    );

    await syncService.syncIntegration('integration-1');

    // Verify ERROR state was set with error message
    expect(mockPrismaService.platformIntegration.update).toHaveBeenCalledWith({
      data: {
        lastSyncError: 'API error connection timed out',
        lastSyncStatus: 'ERROR'
      },
      where: { id: 'integration-1' }
    });
  });

  it('should map eToro assets directly to isolated MANUAL symbol profiles without calling search API', async () => {
    const mockIntegration = {
      id: 'integration-1',
      accountId: 'account-1',
      credentialsIv: 'iv',
      credentialsTag: 'tag',
      encryptedCredentials: 'encrypted',
      isActive: true,
      provider: IntegrationProvider.ETORO,
      userId: 'user-1'
    };

    mockPrismaService.platformIntegration.findUnique.mockResolvedValueOnce(
      mockIntegration
    );

    mockProvider.getTransactions.mockResolvedValueOnce([
      {
        currency: 'USD',
        date: new Date('2026-02-25'),
        isin: 'ADA',
        name: 'Cardano',
        quantity: 100,
        reference: 'etoro-pos-open-12345',
        type: 'BUY',
        unitPrice: 0.5,
        assetClass: 'ALTERNATIVE_INVESTMENT',
        assetSubClass: 'CRYPTOCURRENCY'
      }
    ]);

    await syncService.syncIntegration('integration-1');

    // Verify search API was NOT called
    expect(mockDataProviderService.search).not.toHaveBeenCalled();

    // Verify activity was created with the isolated MANUAL symbol profile format
    expect(mockActivitiesService.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        assetClass: 'ALTERNATIVE_INVESTMENT',
        assetSubClass: 'CRYPTOCURRENCY',
        SymbolProfile: expect.objectContaining({
          connectOrCreate: expect.objectContaining({
            create: expect.objectContaining({
              dataSource: 'MANUAL',
              symbol: 'ETORO_ADA_USER-1',
              name: 'Cardano',
              isin: 'ADA',
              userId: 'user-1'
            })
          })
        })
      })
    );
  });
});
