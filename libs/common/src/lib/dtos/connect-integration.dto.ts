import { IntegrationProvider } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class ConnectIntegrationDto {
  @IsEnum(IntegrationProvider)
  provider: IntegrationProvider;

  @IsString()
  credentials: string;
}
