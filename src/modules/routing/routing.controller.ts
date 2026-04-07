import { Controller, Get, UseGuards } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GetCurrentUser } from '../../decorators/get-current-user.decorator';

@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('courier')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Roles(Role.COURIER)
  @Get('route')
  getOptimizedRoute(@GetCurrentUser('sub') courierId: number) {
    return this.routingService.getOptimizedRoute(courierId);
  }
}
