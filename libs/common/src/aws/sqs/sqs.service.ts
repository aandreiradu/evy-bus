import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQS } from 'aws-sdk';
import {
  SQSClient,
  SendMessageCommand,
  SendMessageRequest,
} from '@aws-sdk/client-sqs';
import { AWS_EVENT_TYPES } from '../eventTypes';

@Injectable()
export class SQSService {
  private readonly logger: Logger = new Logger(SQSService.name);
  private sqsClient = new SQSClient({});
  clients: Record<string, SQS> = {};

  constructor(private readonly configService: ConfigService) {}

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

  getConsumer(instanceNo: string): SQS {
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
