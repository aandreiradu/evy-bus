import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { AuthEventConsumer } from 'apps/auth/src/consumers/auth.consumer';

import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { SQSService } from '@app/common/aws';
@Module({
  imports: [
    LoggerModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [GatewayController],
  providers: [GatewayService, SQSService /*AuthEventConsumer */],
})
export class GatewayModule {}
