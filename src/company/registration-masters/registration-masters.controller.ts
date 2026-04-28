import { Controller, Get, Param } from '@nestjs/common';
import { RegistrationMastersService } from './registration-masters.service';

@Controller('api/company')
export class RegistrationMastersController {
  constructor(
    private readonly registrationMastersService: RegistrationMastersService,
  ) {}

  // GET /api/company/register-info
  // Public endpoint - no auth required for master data
  @Get('register-info')
  async getRegisterInfo() {
    console.log('[RegistrationMastersController] GET /api/company/register-info called');
    const result = await this.registrationMastersService.getRegistrationMasters();
    console.log('[RegistrationMastersController] Returning data:', {
      industries: result.data.industries.length,
      entities: result.data.entities.length,
      sectors: result.data.sectors.length,
      states: result.data.states.length,
      facilitators: result.data.facilitators.length,
    });
    return result;
  }

  /**
   * GET /api/company/states
   * Returns all states (id, name, code) for dropdowns and filters.
   */
  @Get('states')
  async getAllStates() {
    return this.registrationMastersService.getAllStates();
  }

  /**
   * GET /api/company/all-states
   * Returns complete states master list (including inactive).
   */
  @Get('all-states')
  @Get('states-all')
  @Get('states_all')
  async getAllStatesUnfiltered() {
    return this.registrationMastersService.getAllStatesMaster();
  }

  /**
   * GET /api/company/groups-sectors
   * Returns distinct groups and all sectors (with group_name) for GROUP / SECTOR UI (e.g. Primary Data checklist page).
   */
  @Get('groups-sectors')
  async getGroupsAndSectors() {
    return this.registrationMastersService.getGroupsAndSectors();
  }

  /**
   * GET /api/company/sectors
   * Returns active sectors only (status = 1) for Registration form dropdown.
   */
  @Get('sectors')
  async getActiveSectors() {
    return this.registrationMastersService.getActiveSectors();
  }

  /**
   * GET /api/company/assessment-categories
   * Returns category tabs for Assessment Submittals (GSC, IE, PSL, MS, EM, CBM, WTM, MRM, GBE).
   */
  @Get('assessment-categories')
  async getAssessmentCategories() {
    return this.registrationMastersService.getAssessmentCategories();
  }

  /**
   * GET /api/company/assessor-grades
   * Returns active assessor grades for frontend dropdown.
   */
  @Get('assessor-grades')
  async getAssessorGrades() {
    return this.registrationMastersService.getActiveAssessorGrades();
  }

  /**
   * GET /api/company/ifsc/:ifsc
   * Returns bank and branch details for a valid IFSC.
   */
  @Get('ifsc/:ifsc')
  async getBankDetailsByIfsc(@Param('ifsc') ifsc: string) {
    return this.registrationMastersService.getBankDetailsByIfsc(ifsc);
  }

}


