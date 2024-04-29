import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { QueueRepository } from './queue.repository';
import { SaveQueueArgs } from './types';
import { SQSService } from '../aws';
import { CreateQueueArgs } from '../constants/types';
import { UtilsService } from '../utils';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

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
      const responseAwsQueue = await this.sqsService.createQueue({
        QueueName: queuePayload.QueueName,
        tags: queuePayload.tags,
        Attributes: queuePayload.Attributes,
      });

      const queueToken = this.utilsService.generateQueueToken();

      await this.queueRepository.saveQueueTokens({
        id: uuidv4(),
        queueToken,
        queueURL: responseAwsQueue.QueueUrl,
        userId: queuePayload.userId,
      });

      return {
        isSuccess: true,
        queueToken: queueToken,
      };
    } catch (error) {
      if (error.name === 'AWS.SimpleQueueService.QueueNameExists') {
        this.logger.warn(`Queue ${queuePayload.QueueName} already exists.`);
        return null;
      }

      this.logger.error(`Failed to create queue`);
      console.error(error);
      throw new InternalServerErrorException('Failed to create queue');
    }
  }

  async sendMessage(message: any): Promise<void> {
    try {
      const eventsQueueURL = this.configService.get<string>(
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
