import { Controller, Get, Query } from '@nestjs/common';
import { CompanyAuthService } from './company-auth.service';

@Controller(['api/companys/auth', 'companys/auth'])
export class CompanyAuthLegacyCompatController {
  constructor(private readonly companyAuthService: CompanyAuthService) {}

  @Get([
    'companies-list',
    'submitted-companies',
    'submitted_companies',
    'registerd-companies',
    'registerd_companies',
    'registered-companies',
    'registered_companies',
  ])
  async getLegacyRegisteredCompanies(
    @Query() query?: Record<string, any>,
  ) {
    return this.companyAuthService.getCompaniesList(query);
  }

  @Get('companies-filters')
  async getLegacyCompanyFilterOptions() {
    return this.companyAuthService.getCompanyListFilters();
  }
}
