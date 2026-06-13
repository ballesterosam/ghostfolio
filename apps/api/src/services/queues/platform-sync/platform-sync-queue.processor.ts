import { PLATFORM_SYNC_QUEUE } from '@ghostfolio/common/config';

import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';

import { PlatformSyncService } from '../../platform-integration/platform-sync.service';

@Injectable()
@Processor(PLATFORM_SYNC_QUEUE)
export class PlatformSyncQueueProcessor {
  private readonly logger = new Logger(PlatformSyncQueueProcessor.name);

  public constructor(
    private readonly platformSyncService: PlatformSyncService
  ) {}

  @Process('sync-user')
  public async processSyncUser(job: Job<{ userId: string }>) {
    try {
      this.logger.log(`Processing sync-user job for user: ${job.data.userId}`);
      await this.platformSyncService.syncUser(job.data.userId);
    } catch (error) {
      this.logger.error(`Failed to process sync-user job: ${error.message}`);
      throw error;
    }
  }

  @Process('sync-all')
  public async processSyncAll(job: Job<any>) {
    try {
      this.logger.log(`Processing sync-all job (ID: ${job.id})`);
      await this.platformSyncService.syncAll();
    } catch (error) {
      this.logger.error(`Failed to process sync-all job: ${error.message}`);
      throw error;
    }
  }

  @Process('sync-integration')
  public async processSyncIntegration(job: Job<{ integrationId: string }>) {
    try {
      this.logger.log(
        `Processing sync-integration job for: ${job.data.integrationId}`
      );
      await this.platformSyncService.syncIntegration(job.data.integrationId);
    } catch (error) {
      this.logger.error(
        `Failed to process sync-integration job: ${error.message}`
      );
      throw error;
    }
  }
}
