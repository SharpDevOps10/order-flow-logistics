import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { ORDER_EVENTS } from '../../common/events/order.events';
import { OrderReadyEvent } from '../courier-assignment/courier-assignment.service';
import { ORDER_EVENTS_CLIENT } from './messaging.tokens';

/**
 * Typed wrapper around the RabbitMQ client for order-related events.
 * Keeps business services free of messaging-layer details.
 */
@Injectable()
export class OrderEventsPublisher {
  private readonly logger = new Logger(OrderEventsPublisher.name);

  constructor(
    @Inject(ORDER_EVENTS_CLIENT) private readonly client: ClientProxy,
  ) {}

  publishReadyForDelivery(event: OrderReadyEvent): void {
    // Attach a unique message id so the consumer can short-circuit duplicates
    // caused by at-least-once redelivery from RabbitMQ.
    const payload: OrderReadyEvent = {
      ...event,
      messageId: event.messageId ?? randomUUID(),
    };
    this.logger.log(
      `Publishing READY_FOR_DELIVERY for order #${payload.orderId} (msg=${payload.messageId})`,
    );
    this.client.emit(ORDER_EVENTS.READY_FOR_DELIVERY, payload);
  }
}
