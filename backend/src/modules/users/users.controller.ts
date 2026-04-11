import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.SUPPLIER)
  @Get('couriers')
  getCouriers() {
    return this.usersService.getCouriers();
  }
}
