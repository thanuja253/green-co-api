import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../../schemas/company.schema';
import { isProposalDocumentPublicApiPath } from './proposal-document-public-path.util';
import { isWorkOrderDocumentPublicApiPath } from './work-order-document-public-path.util';

@Injectable()
export class AccountStatusGuard implements CanActivate {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = String(request?.path || request?.url || '');

    if (isProposalDocumentPublicApiPath(path) || isWorkOrderDocumentPublicApiPath(path)) {
      return true;
    }

    const user = request.user;

    if (!user || !user.userId) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    const company = await this.companyModel.findById(user.userId);

    if (!company) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    if (company.account_status !== '1') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account In-Active! Please Contact Greenco Team.',
      });
    }

    return true;
  }
}
