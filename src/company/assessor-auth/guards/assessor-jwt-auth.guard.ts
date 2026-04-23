import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AssessorJwtAuthGuard extends AuthGuard('assessor-jwt') {}
