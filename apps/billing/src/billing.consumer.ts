import { BillingMessage } from '@app/common/constants/types';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { SqsMessageHandler } from '@ssut/nestjs-sqs';
import { BillingService } from './billing.service';
import { SQSService } from '@app/common/aws';
import { ConfigService } from '@nestjs/config';
import { QueueAttributeMap } from 'aws-sdk/clients/sqs';

@Injectable()
export class BillingConsumer implements OnApplicationBootstrap {
  private readonly logger: Logger = new Logger(BillingConsumer.name);
  private maxRetryLimit = 1;

  constructor(
    private readonly configService: ConfigService,
    private readonly billingService: BillingService,
    private readonly sqsService: SQSService,
  ) {}

  async onApplicationBootstrap() {
    try {
      const billingQueueName = this.configService.get(
        'AWS_SQS_BILLING_QUEUE_NAME',
      );
      const awsQueueAttributes = await this.sqsService.getQueueAttributesByName(
        billingQueueName,
      );

      if (!awsQueueAttributes.isSuccess) return;

      const queueAttributes =
        awsQueueAttributes.attributes as QueueAttributeMap;

      this.maxRetryLimit = Number(
        JSON.parse(queueAttributes.RedrivePolicy)?.maxReceiveCount,
      );
    } catch (error) {
      this.logger.warn(`Failed to set maxReceiveCount for billingConsumer`);
      this.logger.debug(error);
    }
  }

  @SqsMessageHandler('billing', false)
  async handleBillingMessages(message: AWS.SQS.Message) {
    try {
      const messageDetails = JSON.parse(JSON.stringify(message.Body));
      const messageBody = JSON.parse(messageDetails) as BillingMessage;

      await this.billingService.registerPayment(messageBody);

      this.logger.log(
        `Successfully registered payment for message userId ${messageBody.userId}; ${messageBody.timestamp}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to consume billing message ${JSON.stringify(message)}`,
      );
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      if (
        this.maxRetryLimit ===
        Number(message.Attributes?.ApproximateReceiveCount)
      ) {
        this.logger.warn(
          `Failed to handle message by billing.consumer. Max retry limit reached`,
        );
        this.logger.debug(message);
        this.logger.error(error);
      }

      if (error instanceof InternalServerErrorException) throw error;

      throw new InternalServerErrorException('Failed to register payment');
    }
  }
}
