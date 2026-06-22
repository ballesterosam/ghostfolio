import { HasPermission } from '@ghostfolio/api/decorators/has-permission.decorator';
import { HasPermissionGuard } from '@ghostfolio/api/guards/has-permission.guard';
import {
  CreateRealEstatePropertyDto,
  CreateRealEstatePropertyValuationDto,
  UpdateRealEstatePropertyDto,
  CreateMortgageDto,
  UpdateMortgageDto,
  CreateMortgageAmortizationDto
} from '@ghostfolio/common/dtos';
import { permissions } from '@ghostfolio/common/permissions';
import type { RequestWithUser } from '@ghostfolio/common/types';

import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseGuards
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import {
  RealEstateProperty as RealEstatePropertyModel,
  RealEstatePropertyValuation as RealEstatePropertyValuationModel,
  Mortgage as MortgageModel,
  MortgageAmortization as MortgageAmortizationModel
} from '@prisma/client';

import { RealEstatePropertyService } from './real-estate-property.service';

@Controller('real-estate-property')
export class RealEstatePropertyController {
  public constructor(
    private readonly realEstatePropertyService: RealEstatePropertyService,
    @Inject(REQUEST) private readonly request: RequestWithUser
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getProperties(): Promise<RealEstatePropertyModel[]> {
    return this.realEstatePropertyService.getProperties(this.request.user.id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getPropertyById(
    @Param('id') id: string
  ): Promise<RealEstatePropertyModel> {
    return this.realEstatePropertyService.getPropertyById(
      this.request.user.id,
      id
    );
  }

  @HasPermission(permissions.createRealEstateProperty)
  @Post()
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async createProperty(
    @Body() dto: CreateRealEstatePropertyDto
  ): Promise<RealEstatePropertyModel> {
    return this.realEstatePropertyService.createProperty(
      this.request.user.id,
      dto
    );
  }

  @HasPermission(permissions.updateRealEstateProperty)
  @Put(':id')
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async updateProperty(
    @Param('id') id: string,
    @Body() dto: UpdateRealEstatePropertyDto
  ): Promise<RealEstatePropertyModel> {
    return this.realEstatePropertyService.updateProperty(
      this.request.user.id,
      id,
      dto
    );
  }

  @Delete(':id')
  @HasPermission(permissions.deleteRealEstateProperty)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async deleteProperty(
    @Param('id') id: string
  ): Promise<RealEstatePropertyModel> {
    return this.realEstatePropertyService.deleteProperty(
      this.request.user.id,
      id
    );
  }

  @HasPermission(permissions.createRealEstatePropertyValuation)
  @Post(':id/valuation')
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async createValuation(
    @Param('id') propertyId: string,
    @Body() dto: CreateRealEstatePropertyValuationDto
  ): Promise<RealEstatePropertyValuationModel> {
    return this.realEstatePropertyService.createValuation(
      this.request.user.id,
      propertyId,
      dto
    );
  }

  @Delete(':id/valuation/:valuationId')
  @HasPermission(permissions.deleteRealEstatePropertyValuation)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async deleteValuation(
    @Param('id') propertyId: string,
    @Param('valuationId') valuationId: string
  ): Promise<RealEstatePropertyValuationModel> {
    return this.realEstatePropertyService.deleteValuation(
      this.request.user.id,
      propertyId,
      valuationId
    );
  }

  @HasPermission(permissions.createMortgage)
  @Post(':id/mortgage')
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async createMortgage(
    @Param('id') propertyId: string,
    @Body() dto: CreateMortgageDto
  ): Promise<MortgageModel> {
    return this.realEstatePropertyService.createMortgage(
      this.request.user.id,
      propertyId,
      dto
    );
  }

  @HasPermission(permissions.updateMortgage)
  @Put(':id/mortgage')
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async updateMortgage(
    @Param('id') propertyId: string,
    @Body() dto: UpdateMortgageDto
  ): Promise<MortgageModel> {
    return this.realEstatePropertyService.updateMortgage(
      this.request.user.id,
      propertyId,
      dto
    );
  }

  @HasPermission(permissions.deleteMortgage)
  @Delete(':id/mortgage')
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async deleteMortgage(
    @Param('id') propertyId: string
  ): Promise<MortgageModel> {
    return this.realEstatePropertyService.deleteMortgage(
      this.request.user.id,
      propertyId
    );
  }

  @HasPermission(permissions.createMortgageAmortization)
  @Post(':id/mortgage/amortization')
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async createAmortization(
    @Param('id') propertyId: string,
    @Body() dto: CreateMortgageAmortizationDto
  ): Promise<MortgageAmortizationModel> {
    return this.realEstatePropertyService.createAmortization(
      this.request.user.id,
      propertyId,
      dto
    );
  }

  @HasPermission(permissions.deleteMortgageAmortization)
  @Delete(':id/mortgage/amortization/:amortId')
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async deleteAmortization(
    @Param('id') propertyId: string,
    @Param('amortId') amortizationId: string
  ): Promise<MortgageAmortizationModel> {
    return this.realEstatePropertyService.deleteAmortization(
      this.request.user.id,
      propertyId,
      amortizationId
    );
  }
}
