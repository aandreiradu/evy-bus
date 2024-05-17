import { SQSService } from '@app/common/aws';
import { BillingMessage } from '@app/common/constants/types';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingRepository } from './billing.repository';
import { BotGateway } from '@app/common/discord/discord.gateway';

@Injectable()
export class BillingService {
  private readonly logger: Logger = new Logger(BillingService.name);

  constructor(
    private readonly billingRepository: BillingRepository,
    private readonly sqsService: SQSService,
    private readonly configService: ConfigService,
    private readonly botGateway: BotGateway,
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

      await this.botGateway.sendMessage(
        {
          request: JSON.stringify(message),
          details: {
            message: 'Failed to send message to billing queue',
            exception: JSON.stringify(error),
            timestamp: new Date().toISOString(),
          },
        },
        'BILLING_PUBLISH_MESSAGE',
      );
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

      await this.botGateway.sendMessage(
        {
          request: JSON.stringify(message),
          details: {
            message: 'Failed to register payment',
            exception: JSON.stringify(error),
            timestamp: new Date().toISOString(),
          },
        },
        'BILLING_REGISTER_PAYMENT',
      );

      throw new InternalServerErrorException('Failed to register payment');
    }
  }
}
