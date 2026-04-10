import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AdminJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    const token = this.extractBearerToken(authHeader);

    if (!token) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Missing admin bearer token.',
      });
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    let payload: any;
    try {
      payload = jwt.verify(token, secret);
    } catch {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Invalid or expired admin token.',
      });
    }

    // Admin compat tokens use sub=admin and role=A.
    const isAdmin = payload?.sub === 'admin' || payload?.role === 'A';
    if (!isAdmin) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Admin token is required for this endpoint.',
      });
    }

    req.admin = payload;
    return true;
  }

  private extractBearerToken(headerValue: unknown): string | null {
    if (typeof headerValue !== 'string') return null;
    const [type, token] = headerValue.split(' ');
    if (!type || !token || type.toLowerCase() !== 'bearer') return null;
    return token.trim();
  }
}
