import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LegacyDataController } from './legacy-data.controller';
import { LegacyDataService } from './legacy-data.service';
import { LegacyData, LegacyDataSchema } from '../schemas/legacy-data.schema';
import { Sector, SectorSchema } from '../schemas/sector.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LegacyData.name, schema: LegacyDataSchema },
      { name: Sector.name, schema: SectorSchema },
    ]),
  ],
  controllers: [LegacyDataController],
  providers: [LegacyDataService],
})
export class LegacyDataModule {}

