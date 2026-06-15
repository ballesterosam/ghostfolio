import { ActivitiesService } from '@ghostfolio/api/app/activities/activities.service';
import { DataProviderService } from '@ghostfolio/api/services/data-provider/data-provider.service';
import { EncryptionService } from '@ghostfolio/api/services/encryption/encryption.service';
import { MarketDataService } from '@ghostfolio/api/services/market-data/market-data.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';

import { Injectable, Logger } from '@nestjs/common';
import { AssetClass, AssetSubClass, DataSource } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { IntegrationProviderRegistry } from './integration-provider.registry';

@Injectable()
export class PlatformSyncService {
  private readonly logger = new Logger(PlatformSyncService.name);

  public constructor(
    private readonly prismaService: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly integrationProviderRegistry: IntegrationProviderRegistry,
    private readonly activitiesService: ActivitiesService,
    private readonly dataProviderService: DataProviderService,
    private readonly marketDataService: MarketDataService
  ) {}

  public async syncUser(userId: string): Promise<void> {
    const integrations = await this.prismaService.platformIntegration.findMany({
      where: { userId, isActive: true }
    });

    for (const integration of integrations) {
      await this.syncIntegration(integration.id);
    }
  }

  public async syncAll(): Promise<void> {
    const integrations = await this.prismaService.platformIntegration.findMany({
      where: { isActive: true }
    });

    for (const integration of integrations) {
      await this.syncIntegration(integration.id);
    }
  }

  public async syncIntegration(integrationId: string): Promise<void> {
    const integration = await this.prismaService.platformIntegration.findUnique(
      {
        include: { account: true },
        where: { id: integrationId }
      }
    );

    if (!integration || !integration.isActive) {
      return;
    }

    this.logger.log(
      `Starting synchronization for integration ${integration.id} (account: ${integration.accountId})`
    );

    try {
      await this.prismaService.platformIntegration.update({
        data: { lastSyncStatus: 'SYNCING', lastSyncError: null },
        where: { id: integration.id }
      });

      const credentials = this.encryptionService.decrypt(
        integration.encryptedCredentials,
        integration.credentialsIv,
        integration.credentialsTag
      );

      const provider = this.integrationProviderRegistry.getProvider(
        integration.provider
      );

      // 1. Sync cash balance
      const cashBalance = await provider.getCashBalance(
        credentials,
        integration.externalAccountId
      );
      await this.prismaService.account.update({
        data: { balance: cashBalance },
        where: {
          id_userId: {
            id: integration.accountId,
            userId: integration.userId
          }
        }
      });

      // 2. Fetch transactions
      const transactions = await provider.getTransactions(
        credentials,
        integration.externalAccountId
      );

      const resolvedProfiles = new Map<
        string,
        { dataSource: DataSource; symbol: string; id?: string; name: string }
      >();

      for (const tx of transactions) {
        // Check if transaction is already imported
        const existingOrder = await this.prismaService.order.findFirst({
          where: {
            accountId: integration.accountId,
            comment: tx.reference,
            userId: integration.userId
          }
        });

        if (existingOrder) {
          continue; // Skip already imported transaction
        }

        // Resolve SymbolProfile
        let profile = resolvedProfiles.get(tx.isin);
        if (!profile) {
          if (integration.provider === 'ETORO') {
            const manualSymbol =
              `ETORO_${tx.isin}_${integration.userId}`.toUpperCase();
            const dbProfile = await this.prismaService.symbolProfile.findFirst({
              where: {
                dataSource: DataSource.MANUAL,
                symbol: manualSymbol
              }
            });

            if (dbProfile) {
              profile = {
                dataSource: dbProfile.dataSource,
                id: dbProfile.id,
                name: dbProfile.name,
                symbol: dbProfile.symbol
              };
            } else {
              profile = {
                dataSource: DataSource.MANUAL,
                name: tx.name,
                symbol: manualSymbol
              };
            }
          } else {
            // Check DB first
            const dbProfile = await this.prismaService.symbolProfile.findFirst({
              where: {
                isin: tx.isin,
                ...(tx.assetSubClass ? { assetSubClass: tx.assetSubClass } : {})
              }
            });

            if (dbProfile) {
              profile = {
                dataSource: dbProfile.dataSource,
                id: dbProfile.id,
                name: dbProfile.name,
                symbol: dbProfile.symbol
              };
            } else {
              // Check via search API
              try {
                const searchResult = await this.dataProviderService.search({
                  query: tx.isin,
                  user: {
                    id: integration.userId,
                    subscription: { type: 'Premium' }
                  } as any
                });

                let filteredItems = searchResult?.items || [];
                if (tx.assetSubClass) {
                  filteredItems = filteredItems.filter(
                    (item) => item.assetSubClass === tx.assetSubClass
                  );
                }

                const firstMatch = filteredItems?.[0];
                if (firstMatch?.symbol && firstMatch?.dataSource) {
                  profile = {
                    dataSource: firstMatch.dataSource,
                    name: firstMatch.name,
                    symbol: firstMatch.symbol
                  };
                }
              } catch (err) {
                this.logger.error(
                  `Error searching symbol for ISIN ${tx.isin}: ${err.message}`
                );
              }

              // Fallback: create manual profile
              if (!profile) {
                const uuid = randomUUID();
                profile = {
                  dataSource: DataSource.MANUAL,
                  name: tx.name,
                  symbol: uuid
                };
              }
            }
          }
          resolvedProfiles.set(tx.isin, profile);
        }

        // Map asset class
        const assetClass =
          tx.assetClass ?? this.mapAssetClass(tx.isin, tx.name).assetClass;
        const assetSubClass =
          tx.assetSubClass ??
          this.mapAssetClass(tx.isin, tx.name).assetSubClass;

        // Create the activity in Ghostfolio
        await this.activitiesService.createActivity({
          assetClass,
          assetSubClass,
          accountId: integration.accountId,
          comment: tx.reference,
          currency: tx.currency,
          date: tx.date,
          fee: 0,
          quantity: tx.quantity,
          type: tx.type,
          unitPrice: tx.unitPrice,
          SymbolProfile: {
            connectOrCreate: {
              create: {
                assetClass,
                assetSubClass,
                currency: tx.currency,
                dataSource: profile.dataSource,
                isin: tx.isin,
                name: profile.name,
                symbol: profile.symbol,
                userId:
                  profile.dataSource === DataSource.MANUAL
                    ? integration.userId
                    : undefined
              },
              where: {
                dataSource_symbol: {
                  dataSource: profile.dataSource,
                  symbol: profile.symbol
                }
              }
            }
          },
          updateAccountBalance: false,
          user: { connect: { id: integration.userId } },
          userId: integration.userId
        });
      }

      // 3. Update spot prices for manual symbol profiles
      const currentPositions = await provider.getPositions(
        credentials,
        integration.externalAccountId
      );
      const manualMarketDataToUpdate = [];

      for (const pos of currentPositions) {
        let profile = resolvedProfiles.get(pos.isin);
        if (!profile) {
          const dbProfile = await this.prismaService.symbolProfile.findFirst({
            where: { isin: pos.isin }
          });
          if (dbProfile) {
            profile = {
              dataSource: dbProfile.dataSource,
              id: dbProfile.id,
              name: dbProfile.name,
              symbol: dbProfile.symbol
            };
            resolvedProfiles.set(pos.isin, profile);
          }
        }

        if (profile && profile.dataSource === DataSource.MANUAL) {
          // Normalize date to UTC midnight (standard in Ghostfolio)
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);

          manualMarketDataToUpdate.push({
            dataSource: DataSource.MANUAL,
            date: today,
            marketPrice: pos.unitPrice,
            state: 'INTRADAY',
            symbol: profile.symbol
          });
        }
      }

      if (manualMarketDataToUpdate.length > 0) {
        await this.marketDataService.updateMany({
          data: manualMarketDataToUpdate
        });
      }

      // 4. Update sync status
      await this.prismaService.platformIntegration.update({
        data: {
          lastSyncAt: new Date(),
          lastSyncError: null,
          lastSyncStatus: 'SUCCESS'
        },
        where: { id: integration.id }
      });

      this.logger.log(
        `Successfully completed synchronization for integration ${integration.id}`
      );
    } catch (error) {
      this.logger.error(
        `Synchronization failed for integration ${integrationId}: ${error.message}`
      );
      await this.prismaService.platformIntegration
        .update({
          data: {
            lastSyncError: error.message,
            lastSyncStatus: 'ERROR'
          },
          where: { id: integrationId }
        })
        .catch((e) =>
          this.logger.error(`Failed to update error status: ${e.message}`)
        );
    }
  }

  private mapAssetClass(
    isin: string,
    name?: string
  ): { assetClass: AssetClass; assetSubClass: AssetSubClass } {
    const fixedIncomeIsins = [
      'IE00BFPM9W02',
      'IE00BFPM9X19',
      'IE00BF6T7R10',
      'IE00BZ04LQ92',
      'IE00BGCZ0719',
      'IE0007472990',
      'IE00B04FFJ44',
      'IE00B04GQR24',
      'IE00B18GC888'
    ];

    const isinUpper = (isin || '').toUpperCase();
    const nameUpper = (name || '').toUpperCase();

    if (
      fixedIncomeIsins.includes(isinUpper) ||
      nameUpper.includes('BND') ||
      nameUpper.includes('BOND') ||
      nameUpper.includes('GOV') ||
      nameUpper.includes('GV') ||
      nameUpper.includes('FIXED INCOME') ||
      nameUpper.includes('RENTA FIJA')
    ) {
      return {
        assetClass: AssetClass.FIXED_INCOME,
        assetSubClass: AssetSubClass.MUTUALFUND
      };
    }

    return {
      assetClass: AssetClass.EQUITY,
      assetSubClass: AssetSubClass.MUTUALFUND
    };
  }
}
