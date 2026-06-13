import { PlatformIntegrationModule } from '@ghostfolio/api/services/platform-integration/platform-integration.module';
import { PLATFORM_SYNC_QUEUE } from '@ghostfolio/common/config';

import { BullAdapter } from '@bull-board/api/bullAdapter';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';

import { PlatformSyncQueueProcessor } from './platform-sync-queue.processor';
import { PlatformSyncQueueService } from './platform-sync-queue.service';

@Module({
  exports: [BullModule, PlatformSyncQueueService],
  imports: [
    BullBoardModule.forFeature({
      adapter: BullAdapter,
      name: PLATFORM_SYNC_QUEUE,
      options: {
        displayName: 'Platform Synchronization',
        readOnlyMode: process.env.BULL_BOARD_IS_READ_ONLY !== 'false'
      }
    }),
    BullModule.registerQueue({
      name: PLATFORM_SYNC_QUEUE
    }),
    forwardRef(() => PlatformIntegrationModule)
  ],
  providers: [PlatformSyncQueueProcessor, PlatformSyncQueueService]
})
export class PlatformSyncQueueModule {}
