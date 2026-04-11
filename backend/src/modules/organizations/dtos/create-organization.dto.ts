import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty({ message: 'Organization name cannot be empty' })
  name: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  lat?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  lng?: number;
}
