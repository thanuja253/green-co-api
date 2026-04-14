import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const method = String(request?.method || '').toUpperCase();
    const path = String(request?.path || request?.url || '');
    const isProposalWrite =
      ['POST', 'PUT', 'PATCH'].includes(method) &&
      /\/api\/company\/projects\/[^/]+\/proposal-document(?:\/reupload)?$/.test(path);

    if (isProposalWrite) {
      return true;
    }

    return super.canActivate(context);
  }
}



