import { SQSService } from '@app/common/aws';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GatewayService {
  private readonly logger: Logger = new Logger(GatewayService.name);

  constructor(
    private readonly sqsService: SQSService,
    private readonly configSerivce: ConfigService,
  ) {}

  createQueue(
    accountKey: string,
    queuePayload: AWS.SQS.Types.CreateQueueRequest,
  ) {
    try {
      const responseAwsQueue = this.sqsService.createQueue({
        QueueName: 'test-ack-2',
      });

      return responseAwsQueue;
    } catch (error) {
      if (error.name === 'AWS.SimpleQueueService.QueueNameExists') {
        this.logger.warn(`Queue ${queuePayload.QueueName} already exists.`);
        return null;
      }

      this.logger.error(`Failed to create queue`);
      throw new InternalServerErrorException(JSON.stringify(error));
    }
  }

  async publishToEventsQueue(message: any): Promise<void> {
    try {
      const eventsQueueURL = this.configSerivce.get<string>(
        'AWS_SQS_EVENTS_QUEUE_URL',
      );
      const responseSQS = await this.sqsService.sendMessage(
        eventsQueueURL,
        JSON.stringify(message),
      );
      console.log('responseSQS', responseSQS);
    } catch (error) {
      this.logger.error(
        `Failed to publish to events queue message ${JSON.stringify(message)}`,
      );
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException();
    }
  }
}
