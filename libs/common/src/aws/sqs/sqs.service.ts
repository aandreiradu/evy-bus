import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQS } from 'aws-sdk';
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  QueueAttributeName,
  SQSClient,
  SendMessageCommand,
  SendMessageRequest,
} from '@aws-sdk/client-sqs';
import { AWS_EVENT_TYPES } from '../eventTypes';

@Injectable()
export class SQSService {
  private readonly logger: Logger = new Logger(SQSService.name);
  private sqsClient: SQSClient | null = null;
  private sqs: SQS | null = null;
  clients: Record<string, SQS> = {};

  constructor(private readonly configService: ConfigService) {
    if (!this.sqsClient) this.sqsClient = this.getClient();

    this.sqs = new SQS({
      region: 'eu-central-1',
      endpoint: 'http://localhost:4566',
    });
  }

  async createDLQ(queueName: string) {
    try {
      const createQueueCommand = new CreateQueueCommand({
        QueueName: queueName,
      });

      const dlqURL = await this.sqsClient.send(createQueueCommand);

      return dlqURL?.QueueUrl || null;
    } catch (error) {
      this.logger.error(`Failed to create DLQ ${queueName}`);
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException('Failed to create DLQ');
    }
  }

  async createQueue(queuePayload: AWS.SQS.Types.CreateQueueRequest) {
    try {
      const maxReceiveCount = +queuePayload?.Attributes?.maxReceiveCount || 5;
      const dlqURL = await this.createDLQ(queuePayload.QueueName + 'DLQ');

      if (!dlqURL) {
        throw new InternalServerErrorException('Failed to create DLQ');
      }

      const dlqAttributes = await this.getQueueAttributesByURL(dlqURL);

      const { QueueArn: DLQArn } = dlqAttributes.Attributes;

      const createQueuePayload = new CreateQueueCommand({
        ...queuePayload,
        Attributes: {
          ReceiveMessageWaitTimeSeconds: '20', // enable long-pooling by default
          RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: DLQArn,
            maxReceiveCount: maxReceiveCount.toString(), // Convert to string
          }),
        },
      });

      const client = this.getClient();
      const responseAws = await client.send(createQueuePayload);

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
      }
    }

    return this.clients[instanceNo];
  }

  async sendMessage(
    queueURL: string,
    message: any,
    eventType?: AWS_EVENT_TYPES,
    isFifo = false,
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

      if (isFifo) {
        commandPayload.MessageGroupId = 'group_FTOS';
        commandPayload.MessageDeduplicationId = String(Date.now());
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

  async getQueueAttributesByURL(
    queueURL: string,
    attributes?: QueueAttributeName[],
  ) {
    try {
      const attributesCommand = new GetQueueAttributesCommand({
        QueueUrl: queueURL,
        AttributeNames: ['QueueArn'],
      });

      const queueAttributesResponse = await this.sqsClient.send(
        attributesCommand,
      );

      if (
        !queueAttributesResponse ||
        queueAttributesResponse.$metadata.httpStatusCode !== 200 ||
        !queueAttributesResponse?.Attributes
      ) {
        this.logger.error(
          `Unexpected response from get queue attributes for queueURL ${queueURL}`,
        );
        this.logger.error(
          `Command payload ${JSON.stringify({
            QueueUrl: queueURL,
            AttributeNames: attributes ? attributes : ['All'],
          })}`,
        );
        this.logger.error(JSON.stringify(queueAttributesResponse));

        throw new InternalServerErrorException(
          'Failed to get queue attributes',
        );
      }

      return queueAttributesResponse;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Failed to get queue attributes for URL ${queueURL}; attributes; ${JSON.stringify(
          attributes,
        )}`,
      );
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException('Failed to get queue attributes');
    }
  }

  async getQueueAttributesByName(queueName: string) {
    try {
      const queueURL = await this.getQueueURL(queueName);

      const getQueueAttributesParams: SQS.Types.GetQueueAttributesRequest = {
        QueueUrl: queueURL,
        AttributeNames: ['All'],
      };

      const queueURLResponse = await this.sqs
        .getQueueAttributes(getQueueAttributesParams)
        .promise();

      if (!queueURLResponse) {
        return {
          isSuccess: true,
          message: `No queue attributes found for queue ${queueURL}`,
        };
      }

      return {
        isSuccess: true,
        message: 'Queue attributes found',
        attributes: queueURLResponse.Attributes,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Failed to get queue attributes  for queue ${queueName}`,
      );
      this.logger.error(JSON.stringify(error));
      throw new InternalServerErrorException();
    }
  }

  async getQueueURL(queueName: string) {
    try {
      const getQueueURLParams: SQS.Types.GetQueueUrlRequest = {
        QueueName: queueName,
      };

      const queueURLResponse = await this.sqs
        .getQueueUrl(getQueueURLParams)
        .promise();

      if (!queueURLResponse?.QueueUrl) {
        throw new BadRequestException('Queue URL not found');
      }

      return queueURLResponse.QueueUrl;
    } catch (error) {
      this.logger.error(`Failed to get queue URL for queue ${queueName}`);
      this.logger.error(JSON.stringify(error));
      throw new InternalServerErrorException();
    }
  }
}
