import { Controller, Get, UseGuards } from '@nestjs/common';
import { CourierStatsService } from './courier-stats.service';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GetCurrentUser } from '../../decorators/get-current-user.decorator';

@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('courier/stats')
export class CourierStatsController {
  constructor(private readonly courierStatsService: CourierStatsService) {}

  @Roles(Role.COURIER)
  @Get('speed')
  getMySpeed(@GetCurrentUser('sub') courierId: number) {
    return this.courierStatsService.getAverageSpeed(courierId);
  }
}
