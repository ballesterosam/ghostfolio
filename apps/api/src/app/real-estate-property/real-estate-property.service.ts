import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import {
  CreateRealEstatePropertyDto,
  CreateRealEstatePropertyValuationDto,
  UpdateRealEstatePropertyDto
} from '@ghostfolio/common/dtos';

import { HttpException, Injectable } from '@nestjs/common';
import {
  RealEstateProperty as RealEstatePropertyModel,
  RealEstatePropertyValuation as RealEstatePropertyValuationModel
} from '@prisma/client';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

@Injectable()
export class RealEstatePropertyService {
  public constructor(private readonly prismaService: PrismaService) {}

  public async getProperties(userId: string): Promise<
    (RealEstatePropertyModel & {
      valuations: RealEstatePropertyValuationModel[];
    })[]
  > {
    return this.prismaService.realEstateProperty.findMany({
      include: { valuations: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
      where: { userId }
    });
  }

  public async getPropertyById(
    userId: string,
    id: string
  ): Promise<
    RealEstatePropertyModel & { valuations: RealEstatePropertyValuationModel[] }
  > {
    const property = await this.prismaService.realEstateProperty.findUnique({
      include: { valuations: { orderBy: { date: 'asc' } } },
      where: { id_userId: { id, userId } }
    });

    if (!property) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.NOT_FOUND),
        StatusCodes.NOT_FOUND
      );
    }

    return property;
  }

  public async createProperty(
    userId: string,
    dto: CreateRealEstatePropertyDto
  ): Promise<RealEstatePropertyModel> {
    return this.prismaService.realEstateProperty.create({
      data: { ...dto, userId }
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
    const { id: _, ...data } = dto;

    return this.prismaService.realEstateProperty.update({
      data,
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
}
