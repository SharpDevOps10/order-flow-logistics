import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductOwnershipGuard } from '../../guards/product-ownership.guard';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OrganizationOwnershipGuard } from '../../guards/organization-ownership.guard';

@Module({
  imports: [OrganizationsModule],
  providers: [
    ProductsService,
    ProductOwnershipGuard,
    OrganizationOwnershipGuard,
  ],
  controllers: [ProductsController],
})
export class ProductsModule {}
