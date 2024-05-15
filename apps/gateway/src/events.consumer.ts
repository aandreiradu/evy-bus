import { SQSService } from '@app/common/aws';
import {
  EventQueueMessage,
  PublishToEventsQueue,
} from '@app/common/constants/types';
import { BotGateway } from '@app/common/discord/discord.gateway';
import { QueueService } from '@app/common/queue/queue.service';
import { WebhookSignature } from '@app/common/signatures/webhook-signature';
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
    private readonly botGateway: BotGateway,
    private readonly webhookSignature: WebhookSignature,
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

  //batch

  // @SqsMessageHandler('events', true)
  // async handleMessages(message: AWS.SQS.Message[]) {
  //   // this.logger.debug('batch len', message.length);
  //   for (let i = 0; i < message.length; i++) {
  //     try {
  //       const messageDetails = JSON.parse(message[i].Body);
  //       const messageBody = JSON.parse(messageDetails) as PublishToEventsQueue;

  //       const queueData = await this.queueService.getQueueUrlByToken(
  //         messageBody.queueToken,
  //         messageBody.userId,
  //       );

  //       if (!queueData) {
  //         this.logger.error(
  //           `Invalid queue token ${messageBody.queueToken} userId ${
  //             messageBody.userId
  //           }; message ${JSON.stringify(messageBody)}`,
  //         );
  //         return true;
  //       }

  //       const { queueURL, queueUserId, errorURL, successURL } = queueData ?? {};

  //       if (queueUserId !== messageBody.userId) {
  //         this.logger.warn(
  //           `UserId ${messageBody.userId} it's not authorized to push to the queue ${messageBody.queueToken}`,
  //         );

  //         return true;
  //       }

  //       const messagePayload: EventQueueMessage = {
  //         correlationId: messageBody.correlationId,
  //         userId: messageBody.userId,
  //         clientMessage: messageBody.clientMessage,
  //         errorURL,
  //         successURL,
  //       };

  //       await this.sqsService.sendMessage(
  //         queueURL,
  //         JSON.stringify(messagePayload),
  //       );

  //       // this.logger.debug(`Count is ${this.count}`);

  //       // console.log(
  //       //   `Successfully published the message to this queue ${queueURL}`,
  //       // );

  //       return true;
  //     } catch (error) {
  //       this.logger.error(
  //         `Failed to process message ${JSON.stringify(message)}`,
  //       );
  //       this.logger.error(error);
  //       this.logger.error(JSON.stringify(error));

  //       if (
  //         this.maxRetryLimit ===
  //         Number(message[i].Attributes?.ApproximateReceiveCount)
  //       ) {
  //         this.logger.warn(`Could not handle event message. Max retry reached`);
  //         this.logger.debug(message);
  //         this.logger.error(error);

  //         /* send message to discord here */
  //       } else {
  //         this.logger.debug(
  //           'Nu a ajuns la max, este =>',
  //           Number(message[i].Attributes?.ApproximateReceiveCount),
  //         );
  //         throw new InternalServerErrorException('Failed to process message');
  //       }
  //     }
  //   }
  // }

  //one-by-one
  @SqsMessageHandler('events', false)
  async handleMessages(message: AWS.SQS.Message) {
    try {
      const messageDetails = JSON.parse(message.Body);
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

      const webhookSignature = this.webhookSignature.generateWebhookSignature(
        messageBody.queueToken,
        JSON.stringify({
          correlationId: messageBody.correlationId,
          userId: messageBody.userId,
          clientMessage: messageBody.clientMessage,
          errorURL,
          successURL,
        }),
      );

      console.log({ webhookSignature });

      const messagePayload: EventQueueMessage = {
        correlationId: messageBody.correlationId,
        userId: messageBody.userId,
        clientMessage: messageBody.clientMessage,
        errorURL,
        successURL,
        webhookSignature,
      };

      const responseEventsConsumer = await this.sqsService.sendMessage(
        queueURL,
        JSON.stringify(messagePayload),
      );

      console.log('responseEventsConsumer', responseEventsConsumer);

      return true;
    } catch (error) {
      this.logger.error(`Failed to process message ${JSON.stringify(message)}`);
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      if (
        this.maxRetryLimit ===
        Number(message.Attributes?.ApproximateReceiveCount)
      ) {
        this.logger.warn(`Could not handle event message. Max retry reached`);
        this.logger.debug(message);
        this.logger.error(error);

        await this.botGateway.sendMessage(
          {
            request: JSON.stringify(message),
            details: {
              error: error,
              message: `Events consumer could not process the message`,
              timestamp: new Date().toISOString(),
            },
          },
          'EVENTS CONSUMER',
        );
      }

      throw new InternalServerErrorException('Failed to process message');
    }
  }
}
