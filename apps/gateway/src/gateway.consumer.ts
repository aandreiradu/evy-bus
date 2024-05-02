import { SQSService } from '@app/common/aws';
import {
  PublishToEventsQueue,
  QueueService,
} from '@app/common/queue/queue.service';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { SqsMessageHandler } from '@ssut/nestjs-sqs';
import { QueueAttributeMap } from 'aws-sdk/clients/sqs';

@Injectable()
export class GatewayEventsConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(GatewayEventsConsumer.name);
  private maxRetryLimit = 1;

  constructor(
    private readonly sqsService: SQSService,
    private readonly queueService: QueueService,
  ) {}

  async onApplicationBootstrap() {
    try {
      const queueAttributesResponse =
        await this.sqsService.getQueueAttributesByName('events');

      if (!queueAttributesResponse?.isSuccess) {
        return;
      }
      const queueAttributes =
        queueAttributesResponse.attributes as QueueAttributeMap;
      this.maxRetryLimit = Number(
        JSON.parse(queueAttributes.RedrivePolicy)?.maxReceiveCount,
      );
    } catch (error) {
      this.logger.error(
        `Could not get queue attributes for events queue`,
        error,
      );
    }
  }

  @SqsMessageHandler('events', false)
  async handleGatewayMessage(message: AWS.SQS.Message) {
    try {
      const messageDetails = JSON.parse(message.Body);
      const messageAttributes = message.MessageAttributes;
      const messageBody = JSON.parse(messageDetails) as PublishToEventsQueue;

      const queueData = await this.queueService.getQueueUrlByToken(
        messageBody.queueToken,
        messageBody.userId,
      );

      if (!queueData) {
        this.logger.error(
          `Invalid queue token ${messageBody.queueToken} userId ${
            messageBody.userId
          }; message ${JSON.stringify(messageBody)}`,
        );
        return true;
      }

      const { queueURL, queueUserId, errorURL, successURL } = queueData ?? {};

      if (queueUserId !== messageBody.userId) {
        this.logger.warn(
          `UserId ${messageBody.userId} it's not authorized to push to the queue ${messageBody.queueToken}`,
        );

        return true;
      }

      const messagePayload = {
        correlationId: messageBody.correlationId,
        userId: messageBody.userId,
        clientMessage: messageBody.clientMessage,
        errorURL,
        successURL,
      };

      await this.sqsService.sendMessage(queueURL, messagePayload);

      console.log(
        `Successfully published the message to this queue ${queueURL}`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Failed to process message ${JSON.stringify(message)}`);
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException('Failed to process message');
    }
  }
}
