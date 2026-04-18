import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { DlqService, DlqStats, ReplayResult } from './dlq.service';

/**
 * Admin-only operations for the order-events dead-letter queue.
 * Lets ops see how many messages failed and replay them after a fix.
 */
@Controller('admin/dlq')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}

  @Get('stats')
  getStats(): Promise<DlqStats> {
    return this.dlqService.getStats();
  }

  @Post('replay')
  replay(): Promise<ReplayResult> {
    return this.dlqService.replayAll();
  }
}
