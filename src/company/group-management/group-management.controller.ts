import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { GroupManagementService } from './group-management.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { ListGroupsQueryDto } from './dto/list-groups-query.dto';

const normalizeName = (name: string) => String(name || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
const ALLOWED_CHECKLIST_EXT = new Set(['.xls', '.xlsx', '.csv', '.pdf']);
const ALLOWED_CHECKLIST_MIME = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'application/pdf',
]);

const validateChecklistFile = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  const ext = extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  const isAllowed =
    ALLOWED_CHECKLIST_EXT.has(ext) || ALLOWED_CHECKLIST_MIME.has(mime);
  if (!isAllowed) {
    cb(
      new Error(
        'checklist document must be .xls, .xlsx, .csv, or .pdf',
      ),
      false,
    );
    return;
  }
  cb(null, true);
};

@Controller()
export class GroupManagementController {
  constructor(private readonly groupService: GroupManagementService) {}

  @Post('api/admin/group')
  @Post('admin/group')
  @Post('api/admin/groups')
  @Post('admin/groups')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'sample_document', maxCount: 1 },
        { name: 'checklist_document', maxCount: 1 },
        { name: 'checklist_add_doc', maxCount: 1 },
        { name: 'checklist_doc', maxCount: 1 },
        { name: 'document', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: 'uploads/groups',
          filename: (_req, file, cb) => {
            const ext = extname(file.originalname || '') || '.bin';
            cb(null, `${Date.now()}-${normalizeName(file.fieldname)}${ext}`);
          },
        }),
        fileFilter: validateChecklistFile,
      },
    ),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createGroup(
    @Body() payload: CreateGroupDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    const file =
      files?.sample_document?.[0] ||
      files?.checklist_document?.[0] ||
      files?.checklist_add_doc?.[0] ||
      files?.checklist_doc?.[0] ||
      files?.document?.[0] ||
      undefined;
    if (!file) {
      throw new BadRequestException('checklist_add_doc is required');
    }
    const sampleDocumentPath = file ? `uploads/groups/${file.filename}` : undefined;
    return this.groupService.createGroup(payload, sampleDocumentPath);
  }

  @Get('api/admin/group')
  @Get('admin/group')
  @Get('api/admin/groups')
  @Get('admin/groups')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listGroups(@Query() query: ListGroupsQueryDto) {
    return this.groupService.listGroups(query);
  }

  // Legacy datatable path compatibility
  @Get('api/admin/group_data')
  @Get('admin/group_data')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async listGroupsData(@Query() query: ListGroupsQueryDto) {
    return this.groupService.listGroups(query);
  }

  @Put('api/admin/group_bulk_update')
  @Put('admin/group_bulk_update')
  @Post('api/admin/group_bulk_update')
  @Post('admin/group_bulk_update')
  async bulkUpdateStatus(@Body() body: { group_id?: string[] | string; status?: string }) {
    return this.groupService.bulkUpdateStatus(body?.group_id, body?.status);
  }

  @Get('api/admin/group_bulk_export')
  @Get('admin/group_bulk_export')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async exportGroups(@Query() query: ListGroupsQueryDto, @Res() res: Response): Promise<void> {
    const exported = await this.groupService.exportGroups(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  }

  @Get('api/admin/group/:id')
  @Get('admin/group/:id')
  @Get('api/admin/groups/:id')
  @Get('admin/groups/:id')
  async getGroup(@Param('id') id: string) {
    return this.groupService.getGroup(id);
  }

  @Put('api/admin/group/:id')
  @Put('admin/group/:id')
  @Put('api/admin/groups/:id')
  @Put('admin/groups/:id')
  @Patch('api/admin/group/:id')
  @Patch('admin/group/:id')
  @Patch('api/admin/groups/:id')
  @Patch('admin/groups/:id')
  @Post('api/admin/group/:id')
  @Post('admin/group/:id')
  @Post('api/admin/groups/:id')
  @Post('admin/groups/:id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'sample_document', maxCount: 1 },
        { name: 'checklist_document', maxCount: 1 },
        { name: 'checklist_add_doc', maxCount: 1 },
        { name: 'checklist_doc', maxCount: 1 },
        { name: 'document', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: 'uploads/groups',
          filename: (_req, file, cb) => {
            const ext = extname(file.originalname || '') || '.bin';
            cb(null, `${Date.now()}-${normalizeName(file.fieldname)}${ext}`);
          },
        }),
        fileFilter: validateChecklistFile,
      },
    ),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async updateGroup(
    @Param('id') id: string,
    @Body() payload: CreateGroupDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    const file =
      files?.sample_document?.[0] ||
      files?.checklist_document?.[0] ||
      files?.checklist_add_doc?.[0] ||
      files?.checklist_doc?.[0] ||
      files?.document?.[0] ||
      undefined;
    const sampleDocumentPath = file ? `uploads/groups/${file.filename}` : undefined;
    return this.groupService.updateGroup(id, payload, sampleDocumentPath);
  }
}

