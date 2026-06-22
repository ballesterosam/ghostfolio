import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import {
  CreateRealEstatePropertyDto,
  CreateRealEstatePropertyValuationDto,
  UpdateRealEstatePropertyDto,
  CreateMortgageDto,
  UpdateMortgageDto,
  CreateMortgageAmortizationDto
} from '@ghostfolio/common/dtos';
import { calculateMortgageSummary } from '@ghostfolio/common/mortgage-helper';

import { HttpException, Injectable } from '@nestjs/common';
import {
  RealEstateProperty as RealEstatePropertyModel,
  RealEstatePropertyValuation as RealEstatePropertyValuationModel,
  Mortgage as MortgageModel,
  MortgageAmortization as MortgageAmortizationModel
} from '@prisma/client';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

@Injectable()
export class RealEstatePropertyService {
  public constructor(private readonly prismaService: PrismaService) {}

  private enrichWithMortgageCalculations(property: any): any {
    if (!property?.mortgage) {
      return property;
    }
    const calculations = calculateMortgageSummary(
      {
        startDate: property.mortgage.startDate,
        installments: property.mortgage.installments,
        principal: property.mortgage.principal,
        interestRate: property.mortgage.interestRate,
        amortizations: property.mortgage.amortizations || []
      },
      property.value,
      new Date()
    );
    return {
      ...property,
      mortgage: {
        ...property.mortgage,
        ...calculations
      }
    };
  }

  public async getProperties(userId: string): Promise<any[]> {
    const properties = await this.prismaService.realEstateProperty.findMany({
      include: {
        valuations: { orderBy: { date: 'asc' } },
        mortgage: { include: { amortizations: { orderBy: { date: 'asc' } } } }
      },
      orderBy: { createdAt: 'asc' },
      where: { userId }
    });
    return properties.map((p) => this.enrichWithMortgageCalculations(p));
  }

  public async getPropertyById(userId: string, id: string): Promise<any> {
    const property = await this.prismaService.realEstateProperty.findUnique({
      include: {
        valuations: { orderBy: { date: 'asc' } },
        mortgage: { include: { amortizations: { orderBy: { date: 'asc' } } } }
      },
      where: { id_userId: { id, userId } }
    });

    if (!property) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.NOT_FOUND),
        StatusCodes.NOT_FOUND
      );
    }

    return this.enrichWithMortgageCalculations(property);
  }

  public async createProperty(
    userId: string,
    dto: CreateRealEstatePropertyDto
  ): Promise<RealEstatePropertyModel> {
    const { acquisitionDate, ...rest } = dto;
    return this.prismaService.realEstateProperty.create({
      data: {
        ...rest,
        userId,
        acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null
      }
    });
  }

  public async updateProperty(
    userId: string,
    id: string,
    dto: UpdateRealEstatePropertyDto
  ): Promise<RealEstatePropertyModel> {
    const existing = await this.prismaService.realEstateProperty.findUnique({
      where: { id_userId: { id, userId } }
    });

    if (!existing) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, acquisitionDate, ...data } = dto;

    return this.prismaService.realEstateProperty.update({
      data: {
        ...data,
        acquisitionDate:
          acquisitionDate === undefined
            ? undefined
            : acquisitionDate
              ? new Date(acquisitionDate)
              : null
      },
      where: { id_userId: { id, userId } }
    });
  }

  public async deleteProperty(
    userId: string,
    id: string
  ): Promise<RealEstatePropertyModel> {
    const existing = await this.prismaService.realEstateProperty.findUnique({
      where: { id_userId: { id, userId } }
    });

    if (!existing) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    return this.prismaService.realEstateProperty.delete({
      where: { id_userId: { id, userId } }
    });
  }

  public async createValuation(
    userId: string,
    propertyId: string,
    dto: CreateRealEstatePropertyValuationDto
  ): Promise<RealEstatePropertyValuationModel> {
    const property = await this.prismaService.realEstateProperty.findUnique({
      where: { id_userId: { id: propertyId, userId } }
    });

    if (!property) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    return this.prismaService.realEstatePropertyValuation.create({
      data: { date: new Date(dto.date), propertyId, value: dto.value }
    });
  }

  public async deleteValuation(
    userId: string,
    propertyId: string,
    valuationId: string
  ): Promise<RealEstatePropertyValuationModel> {
    const valuation =
      await this.prismaService.realEstatePropertyValuation.findFirst({
        where: { id: valuationId, propertyId, property: { userId } }
      });

    if (!valuation) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    return this.prismaService.realEstatePropertyValuation.delete({
      where: { id: valuationId }
    });
  }

  public async createMortgage(
    userId: string,
    propertyId: string,
    dto: CreateMortgageDto
  ): Promise<MortgageModel> {
    const property = await this.prismaService.realEstateProperty.findUnique({
      where: { id_userId: { id: propertyId, userId } }
    });

    if (!property) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    return this.prismaService.mortgage.create({
      data: {
        startDate: new Date(dto.startDate),
        installments: dto.installments,
        principal: dto.principal,
        interestRate: dto.interestRate,
        propertyId
      }
    });
  }

  public async updateMortgage(
    userId: string,
    propertyId: string,
    dto: UpdateMortgageDto
  ): Promise<MortgageModel> {
    const mortgage = await this.prismaService.mortgage.findFirst({
      where: { propertyId, property: { userId } }
    });

    if (!mortgage) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    const data: any = {};
    if (dto.startDate) {
      data.startDate = new Date(dto.startDate);
    }
    if (dto.installments !== undefined) {
      data.installments = dto.installments;
    }
    if (dto.principal !== undefined) {
      data.principal = dto.principal;
    }
    if (dto.interestRate !== undefined) {
      data.interestRate = dto.interestRate;
    }

    return this.prismaService.mortgage.update({
      data,
      where: { propertyId }
    });
  }

  public async deleteMortgage(
    userId: string,
    propertyId: string
  ): Promise<MortgageModel> {
    const mortgage = await this.prismaService.mortgage.findFirst({
      where: { propertyId, property: { userId } }
    });

    if (!mortgage) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    return this.prismaService.mortgage.delete({
      where: { propertyId }
    });
  }

  public async createAmortization(
    userId: string,
    propertyId: string,
    dto: CreateMortgageAmortizationDto
  ): Promise<MortgageAmortizationModel> {
    const mortgage = await this.prismaService.mortgage.findFirst({
      where: { propertyId, property: { userId } }
    });

    if (!mortgage) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    return this.prismaService.mortgageAmortization.create({
      data: {
        date: new Date(dto.date),
        amount: dto.amount,
        reduceTerm: dto.reduceTerm,
        mortgageId: mortgage.id
      }
    });
  }

  public async deleteAmortization(
    userId: string,
    propertyId: string,
    amortizationId: string
  ): Promise<MortgageAmortizationModel> {
    const amortization =
      await this.prismaService.mortgageAmortization.findFirst({
        where: {
          id: amortizationId,
          mortgage: { propertyId, property: { userId } }
        }
      });

    if (!amortization) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN
      );
    }

    return this.prismaService.mortgageAmortization.delete({
      where: { id: amortizationId }
    });
  }
}
