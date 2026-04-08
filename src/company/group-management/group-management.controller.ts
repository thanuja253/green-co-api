import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { GroupManagementService } from './group-management.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { ListGroupsQueryDto } from './dto/list-groups-query.dto';

const normalizeName = (name: string) => String(name || '').replace(/[^a-zA-Z0-9_.-]/g, '_');

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
      },
    ),
  )
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  async createGroup(
    @Body() payload: CreateGroupDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    const file =
      files?.sample_document?.[0] || files?.checklist_document?.[0] || files?.document?.[0] || undefined;
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

  @Get('api/admin/group/:id')
  @Get('admin/group/:id')
  @Get('api/admin/groups/:id')
  @Get('admin/groups/:id')
  async getGroup(@Param('id') id: string) {
    return this.groupService.getGroup(id);
  }
}

