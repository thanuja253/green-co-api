import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RegistrationMastersController } from './registration-masters.controller';
import { RegistrationMastersService } from './registration-masters.service';
import { Industry, IndustrySchema } from '../schemas/industry.schema';
import { Entity, EntitySchema } from '../schemas/entity.schema';
import { Sector, SectorSchema } from '../schemas/sector.schema';
import { State, StateSchema } from '../schemas/state.schema';
import { Facilitator, FacilitatorSchema } from '../schemas/facilitator.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Industry.name, schema: IndustrySchema },
      { name: Entity.name, schema: EntitySchema },
      { name: Sector.name, schema: SectorSchema },
      { name: State.name, schema: StateSchema },
      { name: Facilitator.name, schema: FacilitatorSchema },
    ]),
  ],
  controllers: [RegistrationMastersController],
  providers: [RegistrationMastersService],
  exports: [RegistrationMastersService],
})
export class RegistrationMastersModule {}




