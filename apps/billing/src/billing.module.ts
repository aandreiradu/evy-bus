import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { SQSService } from '@app/common/aws';
import { DynamoDBService } from '@app/common/aws/dynamodb/dynamodb.service';
import { BillingRepository } from './billing.repository';
import { BillingConsumer } from './billing.consumer';
import { SqsModule } from '@ssut/nestjs-sqs';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    SqsModule.registerAsync({
      useFactory: async (configService: ConfigService) => {
        return {
          producers: [],
          consumers: [
            {
              name: 'billing',
              region: 'eu-central-1',
              instances: 1,
              attributeNames: ['All'],
              queueUrl: configService.get<string>('AWS_SQS_BILLING_QUEUE_URL'),
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
  controllers: [],
  providers: [
    BillingService,
    SQSService,
    DynamoDBService,
    BillingRepository,
    BillingConsumer,
  ],
  exports: [BillingService],
})
export class BillingModule {}
