import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Facilitator, FacilitatorDocument } from '../../schemas/facilitator.schema';

@Injectable()
export class FacilitatorJwtStrategy extends PassportStrategy(Strategy, 'facilitator-jwt') {
  constructor(
    @InjectModel(Facilitator.name) private facilitatorModel: Model<FacilitatorDocument>,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => (req?.query?.token as string) || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: Record<string, unknown>) {
    if (payload?.role !== 'FACILITATOR') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!Types.ObjectId.isValid(sub)) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    const facilitator = await this.facilitatorModel.findById(sub).select('-password');
    if (!facilitator) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    return {
      facilitatorId: sub,
      email: typeof payload.email === 'string' ? payload.email : facilitator.email,
    };
  }
}
