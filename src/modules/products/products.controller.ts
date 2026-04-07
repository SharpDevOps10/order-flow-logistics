import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { OrganizationOwnershipGuard } from '../../guards/organization-ownership.guard';
import { ProductOwnershipGuard } from '../../guards/product-ownership.guard';

@UseGuards(AccessTokenGuard, RolesGuard)
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Roles(Role.SUPPLIER)
  @UseGuards(OrganizationOwnershipGuard)
  @Post('organizations/:orgId/products')
  create(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(dto, orgId);
  }

  @Get('organizations/:orgId/products')
  findAll(@Param('orgId', ParseIntPipe) orgId: number) {
    return this.productsService.findByOrganization(orgId);
  }

  @Roles(Role.SUPPLIER)
  @UseGuards(ProductOwnershipGuard)
  @Patch('products/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Roles(Role.SUPPLIER)
  @UseGuards(ProductOwnershipGuard)
  @Delete('products/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
