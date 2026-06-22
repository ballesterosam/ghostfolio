import { IsDateString, IsNumber, Min } from 'class-validator';

export class CreateRealEstatePropertyValuationDto {
  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0)
  value: number;
}
