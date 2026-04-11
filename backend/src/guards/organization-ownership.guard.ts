import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { OrganizationsService } from '../modules/organizations/organizations.service';
import { JwtPayloadWithRt } from '../modules/auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayloadWithRt;
}

@Injectable()
export class OrganizationOwnershipGuard implements CanActivate {
  constructor(private orgService: OrganizationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user.sub;

    const orgIdParam = request.params.id ?? request.params.orgId;

    if (!orgIdParam) return true;

    const orgIdString = Array.isArray(orgIdParam) ? orgIdParam[0] : orgIdParam;

    const orgId = parseInt(orgIdString, 10);

    if (isNaN(orgId)) {
      throw new ForbiddenException('Invalid organization ID');
    }

    const isOwner = await this.orgService.isOwner(userId, orgId);

    if (!isOwner) {
      throw new ForbiddenException(
        'You are not the owner of this organization',
      );
    }

    return true;
  }
}
