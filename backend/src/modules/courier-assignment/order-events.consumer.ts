import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import { ORDER_EVENTS } from '../../common/events/order.events';
import { CourierAssignmentService } from './courier-assignment.service';
import type { OrderReadyEvent } from './courier-assignment.service';

@Controller()
export class OrderEventsConsumer {
  private readonly logger = new Logger(OrderEventsConsumer.name);

  constructor(
    private readonly courierAssignmentService: CourierAssignmentService,
  ) {}

  @EventPattern(ORDER_EVENTS.READY_FOR_DELIVERY)
  async onOrderReadyForDelivery(
    @Payload() event: OrderReadyEvent,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as unknown as Channel;
    const originalMsg = context.getMessage() as unknown as ConsumeMessage;

    try {
      await this.courierAssignmentService.assignCourierForOrder(event);
      channel.ack(originalMsg);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to process READY_FOR_DELIVERY for order #${event.orderId}: ${message}`,
      );
      channel.nack(originalMsg, false, false);
    }
  }
}
