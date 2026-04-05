import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { GetCurrentUser } from '../../decorators/get-current-user.decorator';
import { OrganizationOwnershipGuard } from '../../guards/organization-ownership.guard';
import { UpdateOrganizationDto } from './dtos/update-organization.dto';

@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Roles(Role.SUPPLIER)
  @Post()
  create(
    @Body() dto: CreateOrganizationDto,
    @GetCurrentUser('sub') userId: number,
  ) {
    return this.orgService.create(dto, userId);
  }

  @Roles(Role.SUPPLIER)
  @Get('my')
  getMyOrgs(@GetCurrentUser('sub') userId: number) {
    return this.orgService.getMyOrganizations(userId);
  }

  @Roles(Role.ADMIN)
  @Get('pending')
  getPending() {
    return this.orgService.getPending();
  }

  @Roles(Role.ADMIN)
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.orgService.approve(id);
  }

  @Get()
  getAllApproved() {
    return this.orgService.getApproved();
  }

  @Roles(Role.SUPPLIER)
  @UseGuards(OrganizationOwnershipGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgService.update(id, dto);
  }
}
