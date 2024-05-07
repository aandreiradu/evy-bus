import { BillingMessage } from '@app/common/constants/types';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SqsMessageHandler } from '@ssut/nestjs-sqs';
import { BillingService } from './billing.service';

@Injectable()
export class BillingConsumer {
  private readonly logger: Logger = new Logger(BillingConsumer.name);

  constructor(private readonly billingService: BillingService) {}

  @SqsMessageHandler('billing', false)
  async handleBillingMessages(message: AWS.SQS.Message) {
    try {
      const messageDetails = JSON.parse(message.Body);
      const messageBody = JSON.parse(messageDetails) as BillingMessage;

      await this.billingService.registerPayment(messageBody);

      this.logger.log(
        `Successfully registered payment for message userId ${messageBody.userId}; ${messageBody.timestamp}`,
      );
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;

      this.logger.error(
        `Failed to consume billing message ${JSON.stringify(message)}`,
      );
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException('Failed to register payment');
    }
  }
}
