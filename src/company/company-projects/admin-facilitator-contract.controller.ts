import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CompanyProjectsService } from './company-projects.service';
import { AdminJwtAuthGuard } from '../company-auth/guards/admin-jwt-auth.guard';
import { ApproveWorkOrderDto } from './dto/approve-workorder.dto';
import { WorkOrderAcceptanceDetailsDto } from './dto/work-order-acceptance.dto';

/**
 * Admin/CII facilitator contract review (separate from legacy facilitator-contract-document aliases on company routes).
 */
@Controller()
@UseGuards(AdminJwtAuthGuard)
export class AdminFacilitatorContractController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  @Get('api/admin/projects/:projectId/facilitator-signed-contract')
  @Get('admin/projects/:projectId/facilitator-signed-contract')
  async getFacilitatorSignedContract(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getFacilitatorSignedContractDocumentForAdmin(projectId);
  }

  @Patch('api/admin/projects/:projectId/facilitator-signed-contract/review')
  @Patch('admin/projects/:projectId/facilitator-signed-contract/review')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async reviewFacilitatorSignedContract(
    @Param('projectId') projectId: string,
    @Body() dto: ApproveWorkOrderDto,
  ): Promise<any> {
    if (dto.wo_status === 2 && !dto.wo_remarks) {
      throw new BadRequestException({
        status: 'error',
        message: 'Remarks are required when rejecting the contract document',
      });
    }
    return this.companyProjectsService.reviewFacilitatorSignedContractByAdmin(projectId, dto);
  }

  @Get('api/admin/projects/:projectId/facilitator-signed-contract/acceptance')
  @Get('admin/projects/:projectId/facilitator-signed-contract/acceptance')
  async getFacilitatorSignedContractAcceptance(
    @Param('projectId') projectId: string,
  ): Promise<any> {
    return this.companyProjectsService.getFacilitatorSignedContractAcceptanceForAdmin(projectId);
  }

  @Patch('api/admin/projects/:projectId/facilitator-signed-contract/acceptance')
  @Patch('admin/projects/:projectId/facilitator-signed-contract/acceptance')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async setFacilitatorSignedContractAcceptance(
    @Param('projectId') projectId: string,
    @Body() dto: WorkOrderAcceptanceDetailsDto,
  ): Promise<any> {
    return this.companyProjectsService.setFacilitatorSignedContractAcceptanceByAdmin(
      projectId,
      dto,
    );
  }
}
