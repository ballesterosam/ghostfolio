import { IsBoolean, IsDateString, IsNumber, Min } from 'class-validator';

export class CreateMortgageAmortizationDto {
  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsBoolean()
  reduceTerm: boolean; // true = reduce term (keep payment), false = keep term (reduce payment)
}
