import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { SQSService } from '@app/common/aws';
import { GatewayEventsConsumer } from './gateway.consumer';
import { SqsModule } from '@ssut/nestjs-sqs';
@Module({
  imports: [
    LoggerModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SqsModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return {
          producers: [],
          consumers: [
            {
              name: 'events',
              region: 'eu-central-1',
              instances: 2,
              attributeNames: ['All'],
              queueUrl: configService.get<string>('AWS_SQS_EVENTS_QUEUE_URL'),
              batchSize: 1,
              pollingWaitTimeMs: 1000,
              waitTimeSeconds: 20,
              visibilityTimeout: 120,
            },
          ],
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [GatewayController],
  providers: [GatewayService, SQSService, GatewayEventsConsumer],
})
export class GatewayModule {}
