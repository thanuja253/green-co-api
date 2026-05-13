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
    const path = String(req?.path || req?.url || '');
    // Keep legacy primary_data compatibility endpoints public.
    if (/^\/?company\/primary_data\/[^/]+$/i.test(path)) {
      return true;
    }
    // Keep coordinators listing public for CII flow compatibility.
    if (/^\/?api\/company\/projects\/coordinators$/i.test(path)) {
      return true;
    }
    // Keep admin launch-training read endpoint public for CII flow compatibility.
    if (/^\/?api\/admin\/projects\/[^/]+\/launch-training$/i.test(path)) {
      return true;
    }
    if (/^\/?admin\/projects\/[^/]+\/launch-training$/i.test(path)) {
      return true;
    }
    // Keep assessment scoring read endpoint public for CII flow compatibility.
    if (/^\/?api\/admin\/assesment_scoring\/[^/]+$/i.test(path)) {
      return true;
    }
    if (/^\/?admin\/assesment_scoring\/[^/]+$/i.test(path)) {
      return true;
    }
    // Keep admin certificate upload/read endpoints public for CII flow compatibility.
    if (/^\/?api\/admin\/upload_certificate\/[^/]+(\/document)?$/i.test(path)) {
      return true;
    }
    if (/^\/?admin\/upload_certificate\/[^/]+(\/document)?$/i.test(path)) {
      return true;
    }
    if (/^\/?api\/admin\/projects\/[^/]+\/certificate(-document)?$/i.test(path)) {
      return true;
    }
    if (/^\/?admin\/projects\/[^/]+\/certificate(-document)?$/i.test(path)) {
      return true;
    }
    // Keep facilitators list endpoint public for CII flow compatibility.
    if (/^\/?api\/admin\/facilitators$/i.test(path)) {
      return true;
    }
    if (/^\/?admin\/facilitators$/i.test(path)) {
      return true;
    }
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
