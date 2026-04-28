import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class FacilitatorJwtAuthGuard extends AuthGuard('facilitator-jwt') {}
