import { SQSService } from '@app/common/aws';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

@Injectable()
export class GatewayService {
  private readonly logger: Logger = new Logger(GatewayService.name);

  constructor(private readonly sqsService: SQSService) {}

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
}
