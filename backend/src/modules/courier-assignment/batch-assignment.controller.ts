import { Controller, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import {
  BatchAssignmentService,
  RebalanceResult,
} from './batch-assignment.service';

/**
 * Admin endpoint to trigger a courier-assignment rebalance on demand,
 * on top of the scheduled 5-minute cron job.
 */
@Controller('admin/assignments')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BatchAssignmentController {
  constructor(
    private readonly batchAssignmentService: BatchAssignmentService,
  ) {}

  @Post('rebalance')
  rebalance(): Promise<RebalanceResult> {
    return this.batchAssignmentService.rebalance();
  }
}
