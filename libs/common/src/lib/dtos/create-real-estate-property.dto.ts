import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export enum PropertyType {
  OWNERSHIP = 'OWNERSHIP',
  BARE_OWNERSHIP = 'BARE_OWNERSHIP',
  OTHER = 'OTHER'
}

export class CreateRealEstatePropertyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  addressStreet?: string;

  @IsOptional()
  @IsString()
  addressZipCode?: string;

  @IsOptional()
  @IsString()
  addressCity?: string;

  @IsOptional()
  @IsString()
  addressProvince?: string;

  @IsOptional()
  @IsString()
  addressCountry?: string;

  @IsString()
  currency: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercentage: number;

  @IsEnum(PropertyType)
  propertyType: PropertyType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  usufructuaryAge?: number;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;
}
