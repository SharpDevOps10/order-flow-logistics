import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { unlink } from 'fs/promises';
import { ProductsService } from './products.service';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { OrganizationOwnershipGuard } from '../../guards/organization-ownership.guard';
import { ProductOwnershipGuard } from '../../guards/product-ownership.guard';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const UPLOADS_DIR = join(process.cwd(), 'uploads');

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

  @Get('organizations/:orgId/products/categories')
  findCategories(@Param('orgId', ParseIntPipe) orgId: number) {
    return this.productsService.findCategoriesByOrganization(orgId);
  }

  @Roles(Role.SUPPLIER)
  @UseGuards(ProductOwnershipGuard)
  @Patch('products/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Roles(Role.SUPPLIER)
  @UseGuards(ProductOwnershipGuard)
  @Post('products/:id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.bin';
          const name = `${randomBytes(16).toString('hex')}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPEG, PNG and WebP images are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const previous = await this.productsService.findById(id);
    const url = `/uploads/${file.filename}`;
    const updated = await this.productsService.setImageUrl(id, url);

    if (previous.imageUrl) {
      await this.deleteUploadedFile(previous.imageUrl);
    }
    return updated;
  }

  @Roles(Role.SUPPLIER)
  @UseGuards(ProductOwnershipGuard)
  @Delete('products/:id/image')
  async deleteImage(@Param('id', ParseIntPipe) id: number) {
    const product = await this.productsService.findById(id);
    if (!product.imageUrl) return product;
    const updated = await this.productsService.setImageUrl(id, null);
    await this.deleteUploadedFile(product.imageUrl);
    return updated;
  }

  @Roles(Role.SUPPLIER)
  @UseGuards(ProductOwnershipGuard)
  @Delete('products/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const product = await this.productsService.findById(id);
    const deleted = await this.productsService.remove(id);
    if (product.imageUrl) {
      await this.deleteUploadedFile(product.imageUrl);
    }
    return deleted;
  }

  private async deleteUploadedFile(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return;
    const filename = url.replace(/^\/uploads\//, '');
    if (!filename || filename.includes('..') || filename.includes('/')) return;
    try {
      await unlink(join(UPLOADS_DIR, filename));
    } catch {
      // ignore — file may already be gone
    }
  }
}
