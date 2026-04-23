import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AssessmentChecklistDocument,
  AssessmentChecklistDocumentSchema,
} from '../schemas/assessment-checklist-document.schema';
import { Sector, SectorSchema } from '../schemas/sector.schema';
import {
  ParameterManagement,
  ParameterManagementSchema,
} from '../schemas/parameter-management.schema';
import { AssessmentChecklistDocumentsController } from './assessment-checklist-documents.controller';
import { AssessmentChecklistDocumentsService } from './assessment-checklist-documents.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssessmentChecklistDocument.name, schema: AssessmentChecklistDocumentSchema },
      { name: Sector.name, schema: SectorSchema },
      { name: ParameterManagement.name, schema: ParameterManagementSchema },
    ]),
  ],
  controllers: [AssessmentChecklistDocumentsController],
  providers: [AssessmentChecklistDocumentsService],
})
export class AssessmentChecklistDocumentsModule {}

