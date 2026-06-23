import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min
} from 'class-validator';

export class UpdateMortgageDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  principal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestRate?: number;
}
