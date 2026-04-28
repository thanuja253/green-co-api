import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Facilitator, FacilitatorDocument } from '../../schemas/facilitator.schema';

@Injectable()
export class FacilitatorAccountStatusGuard implements CanActivate {
  constructor(
    @InjectModel(Facilitator.name) private facilitatorModel: Model<FacilitatorDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const facilitatorId = request.user?.facilitatorId;

    if (!facilitatorId) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    const facilitator = await this.facilitatorModel.findById(facilitatorId);
    if (!facilitator) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    if (String(facilitator.status || '') !== '1') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account In-Active! Please Contact Greenco Team.',
      });
    }

    return true;
  }
}
