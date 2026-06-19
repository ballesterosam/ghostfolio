import { PLATFORM_SYNC_QUEUE } from '@ghostfolio/common/config';

import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { JobOptions, Queue } from 'bull';

@Injectable()
export class PlatformSyncQueueService {
  public constructor(
    @InjectQueue(PLATFORM_SYNC_QUEUE)
    private readonly platformSyncQueue: Queue
  ) {}

  public async addSyncUserJob(userId: string, opts?: JobOptions) {
    return this.platformSyncQueue.add('sync-user', { userId }, opts);
  }

  public async addSyncAllJob(opts?: JobOptions) {
    return this.platformSyncQueue.add('sync-all', {}, opts);
  }

  public async addSyncIntegrationJob(integrationId: string, opts?: JobOptions) {
    return this.platformSyncQueue.add(
      'sync-integration',
      { integrationId },
      opts
    );
  }

  public async getJob(jobId: string) {
    return this.platformSyncQueue.getJob(jobId);
  }
}
