import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Product name cannot be empty' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'SKU can contain letters, digits, dot, underscore, dash',
  })
  sku?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  category?: string;

  @IsBoolean()
  @IsOptional()
  inStock?: boolean;
}
