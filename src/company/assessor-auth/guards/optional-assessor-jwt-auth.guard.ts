import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { extractAssessorJwtToken } from '../assessor-jwt-token.extractor';

/**
 * Runs assessor-jwt validation when a token is present; otherwise allows the request (e.g. legacy ?assessor_id=).
 */
@Injectable()
export class OptionalAssessorJwtAuthGuard extends AuthGuard('assessor-jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (!extractAssessorJwtToken(req)) {
      return true;
    }
    return (await super.canActivate(context)) as boolean;
  }
}
