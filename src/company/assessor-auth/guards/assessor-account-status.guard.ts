import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Assessor, AssessorDocument } from '../../schemas/assessor.schema';

@Injectable()
export class AssessorAccountStatusGuard implements CanActivate {
  constructor(
    @InjectModel(Assessor.name) private assessorModel: Model<AssessorDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const assessorId = request.user?.assessorId;

    if (!assessorId) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    const assessor = await this.assessorModel.findById(assessorId);
    if (!assessor) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    if (String(assessor.status || '') !== '1') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account In-Active! Please Contact Greenco Team.',
      });
    }

    return true;
  }
}
