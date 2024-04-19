import { SQSService } from '@app/common/aws';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SqsMessageHandler } from '@ssut/nestjs-sqs';
import { QueueAttributeMap } from 'aws-sdk/clients/sqs';

@Injectable()
export class GatewayEventsConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(GatewayEventsConsumer.name);
  private maxRetryLimit = 1;

  constructor(private readonly sqsService: SQSService) {}

  async onApplicationBootstrap() {
    try {
      const queueAttributesResponse = await this.sqsService.getQueueAttributes(
        'events',
      );
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
  async handleGatewayMessage(event: AWS.SQS.Message) {
    const eventDetails = JSON.parse(event.Body);

    return true;
  }
}
