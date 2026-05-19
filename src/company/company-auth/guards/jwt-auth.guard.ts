import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { isProposalDocumentPublicApiPath } from './proposal-document-public-path.util';
import { isWorkOrderDocumentPublicApiPath } from './work-order-document-public-path.util';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const method = String(request?.method || '').toUpperCase();
    const path = String(request?.path || request?.url || '');

    if (isProposalDocumentPublicApiPath(path) || isWorkOrderDocumentPublicApiPath(path)) {
      return true;
    }

    const isFeedbackDocumentRead =
      method === 'GET' &&
      /\/api\/company\/projects\/[^/]+\/feedback-document$/.test(path);

    if (isFeedbackDocumentRead) {
      return true;
    }

    return super.canActivate(context);
  }
}
