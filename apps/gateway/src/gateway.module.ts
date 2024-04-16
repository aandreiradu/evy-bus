import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { AuthEventConsumer } from 'apps/auth/src/consumers/auth.consumer';

@Module({
  imports: [],
  controllers: [GatewayController],
  providers: [GatewayService, AuthEventConsumer],
})
export class GatewayModule {}
