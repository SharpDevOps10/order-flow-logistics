import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ProductsService } from '../modules/products/products.service';
import { JwtPayloadWithRt } from '../modules/auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayloadWithRt;
}

@Injectable()
export class ProductOwnershipGuard implements CanActivate {
  constructor(private productsService: ProductsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user.sub;

    const productIdParam = request.params.id;

    if (!productIdParam) return true;

    const productIdString = Array.isArray(productIdParam)
      ? productIdParam[0]
      : productIdParam;

    const productId = parseInt(productIdString, 10);

    if (isNaN(productId)) {
      throw new ForbiddenException('Invalid product ID');
    }

    const isOwner = await this.productsService.isOwnedBySupplier(
      productId,
      userId,
    );

    if (!isOwner) {
      throw new ForbiddenException('You do not own this product');
    }

    return true;
  }
}
