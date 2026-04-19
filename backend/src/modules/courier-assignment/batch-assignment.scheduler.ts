import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BatchAssignmentService } from './batch-assignment.service';

@Injectable()
export class BatchAssignmentScheduler {
  private readonly logger = new Logger(BatchAssignmentScheduler.name);

  constructor(
    private readonly batchAssignmentService: BatchAssignmentService,
  ) {}

  // @Cron(CronExpression.EVERY_5_MINUTES)
  async onTick(): Promise<void> {
    try {
      await this.batchAssignmentService.rebalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Scheduled rebalance failed: ${msg}`);
    }
  }
}
