import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface DlqStats {
  queue: string;
  messageCount: number;
  consumerCount: number;
}

export interface ReplayResult {
  moved: number;
}

@Injectable()
export class DlqService implements OnModuleInit {
  private readonly logger = new Logger(DlqService.name);

  constructor(private readonly config: ConfigService) {}

  private get url(): string {
    return this.config.get<string>('RABBITMQ_URL')!;
  }

  private get mainQueue(): string {
    return this.config.get<string>('RABBITMQ_QUEUE') ?? 'order-events';
  }

  private get dlqName(): string {
    return this.config.get<string>('RABBITMQ_DLQ') ?? 'order-events.dlq';
  }

  async onModuleInit(): Promise<void> {
    try {
      const connection = await amqp.connect(this.url);
      const channel = await connection.createChannel();
      await channel.assertQueue(this.dlqName, { durable: true });
      await channel.close();
      await connection.close();
      this.logger.log(`DLQ '${this.dlqName}' asserted`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to assert DLQ '${this.dlqName}': ${msg}`);
    }
  }

  async getStats(): Promise<DlqStats> {
    const connection = await amqp.connect(this.url);
    try {
      const channel = await connection.createChannel();
      const info = await channel.checkQueue(this.dlqName);
      await channel.close();
      return {
        queue: this.dlqName,
        messageCount: info.messageCount,
        consumerCount: info.consumerCount,
      };
    } finally {
      await connection.close();
    }
  }

  async replayAll(): Promise<ReplayResult> {
    const connection = await amqp.connect(this.url);
    let moved = 0;
    try {
      const channel = await connection.createChannel();
      while (true) {
        const msg = await channel.get(this.dlqName, { noAck: false });
        if (msg === false) break;

        channel.sendToQueue(this.mainQueue, msg.content, {
          persistent: true,
          headers: msg.properties.headers,
          contentType: msg.properties.contentType,
        });
        channel.ack(msg);
        moved++;
      }
      await channel.close();
      this.logger.log(
        `Replayed ${moved} message(s) from '${this.dlqName}' to '${this.mainQueue}'`,
      );
      return { moved };
    } finally {
      await connection.close();
    }
  }
}
