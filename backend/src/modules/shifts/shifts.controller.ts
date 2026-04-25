import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { SetShiftsDto } from './dtos/set-shifts.dto';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GetCurrentUser } from '../../decorators/get-current-user.decorator';

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.COURIER)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('me')
  getMine(@GetCurrentUser('sub') courierId: number) {
    return this.shiftsService.getMyShifts(courierId);
  }

  @Put('me')
  setMine(
    @Body() dto: SetShiftsDto,
    @GetCurrentUser('sub') courierId: number,
  ) {
    return this.shiftsService.setMyShifts(courierId, dto);
  }
}
