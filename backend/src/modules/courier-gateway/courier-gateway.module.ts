import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CourierGateway } from './courier.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [CourierGateway],
  exports: [CourierGateway],
})
export class CourierGatewayModule {}
