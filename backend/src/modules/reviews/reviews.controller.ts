import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dtos/create-review.dto';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GetCurrentUser } from '../../decorators/get-current-user.decorator';

@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Roles(Role.CLIENT)
  @Post()
  create(@Body() dto: CreateReviewDto, @GetCurrentUser('sub') clientId: number) {
    return this.reviewsService.create(dto, clientId);
  }

  @Get('order/:id')
  findByOrder(@Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.findByOrder(id);
  }

  @Get('courier/:id/stats')
  getCourierStats(@Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.getCourierStats(id);
  }
}
