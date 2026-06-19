import { ConfigurationModule } from '@ghostfolio/api/services/configuration/configuration.module';

import { Module } from '@nestjs/common';

import { EncryptionService } from './encryption.service';

@Module({
  exports: [EncryptionService],
  imports: [ConfigurationModule],
  providers: [EncryptionService]
})
export class EncryptionModule {}
