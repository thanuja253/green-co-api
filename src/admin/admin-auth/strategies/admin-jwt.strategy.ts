import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Admin, AdminDocument } from '../../schemas/admin.schema';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => (req?.query?.token as string) || null,
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('ADMIN_JWT_SECRET') ||
        configService.get<string>('JWT_SECRET') ||
        'your-secret-key',
    });
  }

  async validate(payload: any) {
    if (payload?.sub === undefined || payload?.sub === null || String(payload.sub).trim() === '') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Invalid admin session. Please log in again.',
      });
    }

    const subStr =
      typeof payload.sub === 'string' ? payload.sub.trim() : String(payload.sub).trim();

    // Prefer ObjectId (current login shape); support legacy tokens that put admin email in sub.
    let admin = Types.ObjectId.isValid(subStr)
      ? await this.adminModel.findById(subStr)
      : null;
    if (!admin && subStr.includes('@')) {
      admin = await this.adminModel.findOne({ email: subStr.toLowerCase() });
    }

    if (!admin) {
      throw new UnauthorizedException({
        status: 'error',
        message:
          'Unauthorized for this route. Send the admin JWT from POST /api/admin/login or POST /api/admin/auth/login as Authorization: Bearer <token>. Company (portal) tokens cannot access admin registration-data.',
      });
    }

    if (admin.status !== '1') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account In-Active! Please Contact Greenco Team.',
      });
    }

    return { userId: admin._id.toString(), email: admin.email, role: 'admin' };
  }
}
