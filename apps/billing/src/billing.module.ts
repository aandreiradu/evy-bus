import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { SQSService } from '@app/common/aws';
import { DynamoDBService } from '@app/common/aws/dynamodb/dynamodb.service';
import { BillingRepository } from './billing.repository';

@Module({
  imports: [],
  controllers: [BillingController],
  providers: [BillingService, SQSService, DynamoDBService, BillingRepository],
  exports: [BillingService],
})
export class BillingModule {}
