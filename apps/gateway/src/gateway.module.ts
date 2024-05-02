import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SQSService } from '@app/common/aws';
import { GatewayEventsConsumer } from './gateway.consumer';
import { SqsModule } from '@ssut/nestjs-sqs';
import { AuthModule } from 'apps/auth/src/auth.module';
import { UtilsService } from '@app/common/utils';
import { QueueService } from '@app/common/queue/queue.service';
import { QueueRepository } from '@app/common/queue/queue.repository';
@Module({
  imports: [
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
              instances: 1,
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
    AuthModule,
  ],
  controllers: [GatewayController],
  providers: [
    SQSService,
    GatewayEventsConsumer,
    UtilsService,
    QueueService,
    QueueRepository,
  ],
})
export class GatewayModule {}
