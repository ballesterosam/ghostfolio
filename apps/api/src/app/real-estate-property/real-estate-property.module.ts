import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';

import { Module } from '@nestjs/common';

import { RealEstatePropertyController } from './real-estate-property.controller';
import { RealEstatePropertyService } from './real-estate-property.service';

@Module({
  controllers: [RealEstatePropertyController],
  exports: [RealEstatePropertyService],
  imports: [PrismaModule],
  providers: [RealEstatePropertyService]
})
export class RealEstatePropertyModule {}
