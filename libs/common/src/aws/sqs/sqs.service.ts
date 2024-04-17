import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQS } from 'aws-sdk';
import {
  CreateQueueCommand,
  SQSClient,
  SendMessageCommand,
  SendMessageRequest,
} from '@aws-sdk/client-sqs';
import { AWS_EVENT_TYPES } from '../eventTypes';

@Injectable()
export class SQSService {
  private readonly logger: Logger = new Logger(SQSService.name);
  private sqsClient: SQSClient | null = null;
  clients: Record<string, SQS> = {};

  private constructor(private readonly configService: ConfigService) {}

  async createQueue(queuePayload: AWS.SQS.Types.CreateQueueRequest) {
    try {
      const createQueuePayload = new CreateQueueCommand({
        ...queuePayload,
      });

      const client = this.getClient();
      const responseAws = await client.send(createQueuePayload);
      this.logger.log(responseAws);

      return responseAws;
    } catch (error) {
      this.logger.error(`Failed to create queue ${queuePayload.QueueName}`);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException('Failed to create queue');
    }
  }

  createConsumer(
    instanceNo: number,
    name: string,
    sqsConfig: SQS.ClientConfiguration = {},
  ): SQS {
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      sqsConfig['endpoint'] = 'http://localhost:4566';
      sqsConfig['region'] = 'eu-central-1';
    }

    this.clients[instanceNo] = new SQS(sqsConfig ?? {});

    this.logger.log(`SQS ${name} consumer ${instanceNo} initialized`);

    return this.clients[instanceNo];
  }

  async removeEventsFromQueue(
    sqsQueueURL: string,
    sqsConsumer: SQS,
    receiptHandle: string,
  ) {
    // for (const event of events) {
    return sqsConsumer
      .deleteMessage({
        QueueUrl: sqsQueueURL,
        ReceiptHandle: receiptHandle,
      })
      .promise();
    // }
  }

  getClient(): SQSClient {
    if (this.sqsClient) {
      return this.sqsClient;
    }

    if (this.configService.get<string>('NODE_ENV') === 'development') {
      this.sqsClient = new SQSClient({
        region: 'eu-central-1',
        endpoint: 'http://localhost:4566',
      });
    }
    return this.sqsClient;
  }

  getConsumer(instanceNo: string): SQS {
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      if (!this.sqsClient) {
        this.sqsClient = new SQSClient({
          region: 'eu-central-1',
          endpoint: 'http://localhost:4566',
        });
      } else {
        console.log('am client');
      }
    }

    return this.clients[instanceNo] ?? null;
  }

  async sendMessage(
    queueURL: string,
    message: any,
    eventType?: AWS_EVENT_TYPES,
  ) {
    try {
      const commandPayload: SendMessageRequest = {
        QueueUrl: queueURL,
        DelaySeconds: 10,
        MessageBody: JSON.stringify(message),
      };

      if (eventType) {
        commandPayload['MessageAttributes'] = {
          EventType: {
            DataType: 'String',
            StringValue: eventType,
          },
        };
      }

      const command = new SendMessageCommand(commandPayload);
      const response = await this.sqsClient.send(command);

      return response;
    } catch (error) {
      this.logger.log(
        `Failed to send message to queue ${queueURL}; message ${JSON.stringify(
          message,
        )}`,
      );
      this.logger.error(error);

      throw new InternalServerErrorException(
        'Failed to publish message to SQS',
      );
    }
  }
}
