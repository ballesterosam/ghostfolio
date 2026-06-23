import { EncryptionModule } from '@ghostfolio/api/services/encryption/encryption.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';
import { PropertyModule } from '@ghostfolio/api/services/property/property.module';

import { Module } from '@nestjs/common';

import { HipatiaController } from './hipatia.controller';
import { HipatiaService } from './hipatia.service';

@Module({
  controllers: [HipatiaController],
  imports: [EncryptionModule, PrismaModule, PropertyModule],
  providers: [HipatiaService]
})
export class HipatiaModule {}
