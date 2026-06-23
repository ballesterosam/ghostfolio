import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateHipatiaMessageDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @MinLength(1)
  message: string;
}
