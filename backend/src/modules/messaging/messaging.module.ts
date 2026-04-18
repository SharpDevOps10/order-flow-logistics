import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrderEventsPublisher } from './order-events.publisher';
import { ORDER_EVENTS_CLIENT } from './messaging.tokens';
import { DlqService } from './dlq.service';
import { DlqController } from './dlq.controller';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: ORDER_EVENTS_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL')!],
            queue: config.get<string>('RABBITMQ_QUEUE')!,
            queueOptions: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key':
                  config.get<string>('RABBITMQ_DLQ') ?? 'order-events.dlq',
              },
            },
          },
        }),
      },
    ]),
  ],
  controllers: [DlqController],
  providers: [OrderEventsPublisher, DlqService],
  exports: [OrderEventsPublisher, DlqService],
})
export class MessagingModule {}
