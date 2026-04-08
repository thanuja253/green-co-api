import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RegistrationMastersController } from './registration-masters.controller';
import { AdminMastersController } from './admin-masters.controller';
import { RegistrationMastersService } from './registration-masters.service';
import { Industry, IndustrySchema } from '../schemas/industry.schema';
import { Entity, EntitySchema } from '../schemas/entity.schema';
import { Sector, SectorSchema } from '../schemas/sector.schema';
import { State, StateSchema } from '../schemas/state.schema';
import { Facilitator, FacilitatorSchema } from '../schemas/facilitator.schema';
import { AssessorGrade, AssessorGradeSchema } from '../schemas/assessor-grade.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Industry.name, schema: IndustrySchema },
      { name: Entity.name, schema: EntitySchema },
      { name: Sector.name, schema: SectorSchema },
      { name: State.name, schema: StateSchema },
      { name: Facilitator.name, schema: FacilitatorSchema },
      { name: AssessorGrade.name, schema: AssessorGradeSchema },
    ]),
  ],
  controllers: [RegistrationMastersController, AdminMastersController],
  providers: [RegistrationMastersService],
  exports: [RegistrationMastersService],
})
export class RegistrationMastersModule {}




