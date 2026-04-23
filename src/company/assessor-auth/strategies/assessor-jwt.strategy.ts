import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Assessor, AssessorDocument } from '../../schemas/assessor.schema';

@Injectable()
export class AssessorJwtStrategy extends PassportStrategy(Strategy, 'assessor-jwt') {
  constructor(
    @InjectModel(Assessor.name) private assessorModel: Model<AssessorDocument>,
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
    if (payload?.role !== 'ASSESSOR') {
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

    const assessor = await this.assessorModel.findById(sub).select('-password');
    if (!assessor) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }

    return {
      assessorId: sub,
      email: typeof payload.email === 'string' ? payload.email : assessor.email,
    };
  }
}
