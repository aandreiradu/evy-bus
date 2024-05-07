import { SQSService } from '@app/common/aws';
import { BillingMessage } from '@app/common/constants/types';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingRepository } from './billing.repository';

@Injectable()
export class BillingService {
  private readonly logger: Logger = new Logger(BillingService.name);

  constructor(
    private readonly billingRepository: BillingRepository,
    private readonly sqsService: SQSService,
    private readonly configService: ConfigService,
  ) {}

  async publishToBilling(message: BillingMessage) {
    try {
      const billingQueueURL = this.configService.get(
        'AWS_SQS_BILLING_QUEUE_URL',
      );
      await this.sqsService.sendMessage(
        billingQueueURL,
        JSON.stringify(message),
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish to billing queue message ${JSON.stringify(message)}`,
      );
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      /* Here we need to raise some alerts discord/mails/sms,etc*/
    }
  }

  async registerPayment(message: BillingMessage): Promise<void> {
    try {
      await this.billingRepository.registerPayment(message);
    } catch (error) {
      this.logger.error(
        `Failed to register payment ${JSON.stringify(message)}`,
      );
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException('Failed to register payment');
    }
  }
}
