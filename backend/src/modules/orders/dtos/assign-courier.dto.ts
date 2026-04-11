import { IsInt, IsPositive } from 'class-validator';

export class AssignCourierDto {
  @IsInt()
  @IsPositive()
  courierId: number;
}
