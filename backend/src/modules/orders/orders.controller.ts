import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GetCurrentUser } from '../../decorators/get-current-user.decorator';
import { CreateOrderDto } from './dtos/create-order.dto';
import { UpdateOrderStatusDto } from './dtos/update-order-status.dto';
import { AssignCourierDto } from './dtos/assign-courier.dto';

@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles(Role.CLIENT)
  @Post()
  create(@Body() dto: CreateOrderDto, @GetCurrentUser('sub') clientId: number) {
    return this.ordersService.create(dto, clientId);
  }

  @Roles(Role.CLIENT)
  @Get('my')
  findMy(@GetCurrentUser('sub') clientId: number) {
    return this.ordersService.findMyOrders(clientId);
  }

  @Roles(Role.SUPPLIER)
  @Get('supplier')
  findSupplier(@GetCurrentUser('sub') supplierId: number) {
    return this.ordersService.findSupplierOrders(supplierId);
  }

  @Roles(Role.SUPPLIER)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @GetCurrentUser('sub') supplierId: number,
  ) {
    return this.ordersService.updateStatus(id, supplierId, dto);
  }

  @Roles(Role.SUPPLIER)
  @Patch(':id/assign-courier')
  assignCourier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignCourierDto,
    @GetCurrentUser('sub') supplierId: number,
  ) {
    return this.ordersService.assignCourier(id, supplierId, dto);
  }

  @Roles(Role.COURIER)
  @Get('courier')
  findCourierOrders(@GetCurrentUser('sub') courierId: number) {
    return this.ordersService.findCourierOrders(courierId);
  }
}
