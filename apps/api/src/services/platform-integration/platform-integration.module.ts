import { AccountModule } from '@ghostfolio/api/app/account/account.module';
import { ActivitiesModule } from '@ghostfolio/api/app/activities/activities.module';
import { PlatformIntegrationController } from '@ghostfolio/api/app/platform-integration/platform-integration.controller';
import { DataProviderModule } from '@ghostfolio/api/services/data-provider/data-provider.module';
import { EncryptionModule } from '@ghostfolio/api/services/encryption/encryption.module';
import { FetchModule } from '@ghostfolio/api/services/fetch/fetch.module';
import { MarketDataModule } from '@ghostfolio/api/services/market-data/market-data.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';
import { PlatformSyncQueueModule } from '@ghostfolio/api/services/queues/platform-sync/platform-sync-queue.module';

import { Module, forwardRef } from '@nestjs/common';

import { IntegrationProviderRegistry } from './integration-provider.registry';
import { PlatformSyncService } from './platform-sync.service';
import { EtoroProvider } from './providers/etoro/etoro.provider';
import { IndexaCapitalProvider } from './providers/indexa-capital/indexa-capital.provider';

@Module({
  controllers: [PlatformIntegrationController],
  exports: [
    IndexaCapitalProvider,
    EtoroProvider,
    IntegrationProviderRegistry,
    PlatformSyncService
  ],
  imports: [
    AccountModule,
    ActivitiesModule,
    DataProviderModule,
    EncryptionModule,
    FetchModule,
    MarketDataModule,
    forwardRef(() => PlatformSyncQueueModule),
    PrismaModule
  ],
  providers: [
    IndexaCapitalProvider,
    EtoroProvider,
    IntegrationProviderRegistry,
    PlatformSyncService
  ]
})
export class PlatformIntegrationModule {}
