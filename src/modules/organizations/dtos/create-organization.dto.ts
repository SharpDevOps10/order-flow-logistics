import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty({ message: 'Organization name cannot be empty' })
  name: string;

  @IsString()
  @IsOptional()
  region?: string;
}
