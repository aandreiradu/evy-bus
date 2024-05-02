import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { QueueRepository } from './queue.repository';
import { CreateQueueArgs, SaveQueueArgs } from './types';
import { SQSService } from '../aws';
import { UtilsService } from '../utils';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { SendMessageCommandOutput } from '@aws-sdk/client-sqs';

export type PublishToEventsQueue = {
  correlationId: string;
  userId: string;
  queueToken: string;
  clientMessage: unknown;
};

@Injectable()
export class QueueService {
  private readonly logger: Logger = new Logger(QueueService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly queueRepository: QueueRepository,
    private readonly sqsService: SQSService,
    private readonly utilsService: UtilsService,
  ) {}

  async saveQueueTokens(args: SaveQueueArgs): Promise<void> {
    try {
      await this.queueRepository.saveQueueTokens(args);
    } catch (error) {
      this.logger.error(
        `Failed to save queue tokens for payload ${JSON.stringify(args)}`,
      );
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException('Faeild to save queue tokens');
    }
  }

  async createQueue(queuePayload: CreateQueueArgs) {
    try {
      const responseAwsQueue = await this.sqsService.createQueue(queuePayload);
      const queueToken = this.utilsService.generateQueueToken();

      await this.queueRepository.saveQueueTokens({
        id: uuidv4(),
        queueToken,
        queueURL: responseAwsQueue.QueueUrl,
        userId: queuePayload.userId,
        errorURL: queuePayload.errorURL,
        successURL: queuePayload.successURL,
      });

      return {
        isSuccess: true,
        queueToken: queueToken,
      };
    } catch (error) {
      if (error.name === 'AWS.SimpleQueueService.QueueNameExists') {
        this.logger.warn(`Queue ${queuePayload.queueName} already exists.`);
        return null;
      }

      this.logger.error(`Failed to create queue`);
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));
      throw new InternalServerErrorException('Failed to create queue');
    }
  }

  async sendMessageEventsQueue(
    message: PublishToEventsQueue,
  ): Promise<SendMessageCommandOutput> {
    try {
      const eventsQueueURL = this.configService.get<string>(
        'AWS_SQS_EVENTS_QUEUE_URL',
      );
      const responseSQS = await this.sqsService.sendMessage(
        eventsQueueURL,
        JSON.stringify(message),
      );

      return responseSQS;
    } catch (error) {
      this.logger.error(
        `Failed to publish to events queue message ${JSON.stringify(message)}`,
      );
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException();
    }
  }

  async getQueueUrlByToken(token: string, userId: string) {
    try {
      const queueURLQuery = await this.queueRepository.getQueueUrlByToken(
        token,
      );

      return queueURLQuery;
    } catch (error) {
      this.logger.error(
        `Failed to get queue for token ${token}; userId ${userId}`,
      );
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException();
    }
  }
}
