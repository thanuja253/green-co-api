import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import { CompanyAuthService } from './company-auth.service';

@Controller(['api/companys/auth', 'companys/auth'])
export class CompanyAuthLegacyCompatController {
  constructor(private readonly companyAuthService: CompanyAuthService) {}

  @Get([
    'companies-list',
    'submitted-companies',
    'submitted_companies',
    'submitted-company',
    'submitted_company',
    'registerd-companies',
    'registerd_companies',
    'registerd-company',
    'registerd_company',
    'registered-companies',
    'registered_companies',
    'registered-company',
    'registered_company',
  ])
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getLegacyRegisteredCompanies(
    @Query() query?: Record<string, any>,
  ) {
    return this.companyAuthService.getCompaniesList(query);
  }

  @Post([
    'companies-list',
    'submitted-companies',
    'submitted_companies',
    'submitted-company',
    'submitted_company',
    'registerd-companies',
    'registerd_companies',
    'registerd-company',
    'registerd_company',
    'registered-companies',
    'registered_companies',
    'registered-company',
    'registered_company',
  ])
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async postLegacyRegisteredCompanies(
    @Body() body?: Record<string, any>,
  ) {
    return this.companyAuthService.getCompaniesList(body || {});
  }

  @Get('companies-filters')
  async getLegacyCompanyFilterOptions() {
    return this.companyAuthService.getCompanyListFilters();
  }

  @Post('companies-filters')
  async postLegacyCompanyFilterOptions() {
    return this.companyAuthService.getCompanyListFilters();
  }

  @Get(['status_change', 'company-status', 'update-status', 'account-status'])
  async getLegacyStatusChange(@Query() query?: Record<string, any>) {
    return this.companyAuthService.updateCompanyStatus(query || {});
  }

  @Post(['status_change', 'company-status', 'update-status', 'account-status'])
  async postLegacyStatusChange(@Body() body?: Record<string, any>) {
    return this.companyAuthService.updateCompanyStatus(body || {});
  }
}
