import { IsDateString, IsInt, IsNumber, Min } from 'class-validator';

export class CreateMortgageDto {
  @IsDateString()
  startDate: string;

  @IsInt()
  @Min(1)
  installments: number;

  @IsNumber()
  @Min(0)
  principal: number;

  @IsNumber()
  @Min(0)
  interestRate: number; // Anual interest rate in percentage, e.g. 2.5
}
