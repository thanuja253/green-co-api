import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { RegistrationMastersService } from './registration-masters.service';
import { CreateIndustryDto } from './dto/create-industry.dto';
import { BulkCreateIndustriesDto } from './dto/bulk-create-industries.dto';
import { CreateStateDto } from './dto/create-state.dto';
import { BulkCreateStatesDto } from './dto/bulk-create-states.dto';
import { CreateAssessorGradeDto } from './dto/create-assessor-grade.dto';
import { BulkCreateAssessorGradesDto } from './dto/bulk-create-assessor-grades.dto';

@Controller('api/admin/masters')
export class AdminMastersController {
  constructor(private readonly registrationMastersService: RegistrationMastersService) {}

  @Get('industries')
  async getAllIndustries() {
    return this.registrationMastersService.getAllIndustries();
  }

  @Post('industries')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createIndustry(@Body() dto: CreateIndustryDto) {
    return this.registrationMastersService.createIndustry(dto);
  }

  @Post('industries/bulk')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createIndustriesBulk(@Body() dto: BulkCreateIndustriesDto) {
    return this.registrationMastersService.createIndustriesBulk(dto.industries);
  }

  @Get('states')
  async getAllStates() {
    return this.registrationMastersService.getAllStatesMaster();
  }

  @Post('states')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createState(@Body() dto: CreateStateDto) {
    return this.registrationMastersService.createState(dto);
  }

  @Post('states/bulk')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createStatesBulk(@Body() dto: BulkCreateStatesDto) {
    return this.registrationMastersService.createStatesBulk(dto.states);
  }

  @Get('assessor-grades')
  async getAllAssessorGrades() {
    return this.registrationMastersService.getAllAssessorGrades();
  }

  @Post('assessor-grades')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createAssessorGrade(@Body() dto: CreateAssessorGradeDto) {
    return this.registrationMastersService.createAssessorGrade(dto);
  }

  @Post('assessor-grades/bulk')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createAssessorGradesBulk(@Body() dto: BulkCreateAssessorGradesDto) {
    return this.registrationMastersService.createAssessorGradesBulk(dto.grades);
  }
}

