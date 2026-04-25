import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  orderId: number;

  @IsInt()
  @Min(1)
  @Max(5)
  courierRating: number;

  @IsInt()
  @Min(1)
  @Max(5)
  speedRating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
