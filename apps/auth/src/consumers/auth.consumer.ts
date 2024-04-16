import { SQSService } from '@app/common/aws/sqs/sqs.service';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQS } from 'aws-sdk';

@Injectable()
export class AuthEventConsumer implements OnApplicationShutdown {
  private readonly logger: Logger = new Logger(AuthEventConsumer.name);
  #activeConsumer = true;

  constructor(
    private readonly configService: ConfigService,
    private readonly sqsService: SQSService,
  ) {
    const eventConsumerInstances = this.configService.get(
      'EVENT_CONSUMER_AUTH_INSTANCES',
    );

    for (let i = 1; i <= eventConsumerInstances; i++) {
      this.createSqsListener(i);
    }
  }

  beforeApplicationShutdown() {
    this.logger.warn(
      '== Closing auth consumer connections (shutdown signal) ==',
    );
    this.#activeConsumer = false;
  }

  onApplicationShutdown(signal: string) {
    this.logger.warn(`Closing the Auth consumer...`);

    // set a timeout to complete running actions and force shutdown
    return new Promise<any>((resolve) => {
      setTimeout(() => {
        console.log('== Auth consumer closed ==');
        resolve(true);
      }, 3000);
    });
  }

  async createSqsListener(instanceNo: number) {
    const config: SQS.ReceiveMessageRequest = {
      QueueUrl: this.configService.get('AWS_SQS_AUTH_QUEUE_URL'),
      MaxNumberOfMessages: 5, // process 1 message per consumer,
      WaitTimeSeconds: 5, // second to retry fetching new event
      VisibilityTimeout: 120, // seconds before the event is available again for the next consumer,
      MessageAttributeNames: ['All'],
      AttributeNames: ['ApproximateReceiveCount'],
    };

    let sqsConumser: SQS = null;
    let sqsDetails: SQS.GetQueueAttributesResult = null;
    let maxReceiveCount = '1';

    try {
      sqsConumser = this.sqsService.createConsumer(instanceNo, 'auth');
      sqsDetails = await sqsConumser
        .getQueueAttributes({
          QueueUrl: config.QueueUrl,
          AttributeNames: ['All'],
        })
        .promise();
      maxReceiveCount =
        (sqsDetails.Attributes?.RedrivePolicy &&
          JSON.parse(sqsDetails.Attributes?.RedrivePolicy)?.maxReceiveCount) ||
        '1';
    } catch (error) {
      this.logger.warn(
        `Could not connect auth consumer instance ${instanceNo} to queue ${this.configService.get(
          'AWS_SQS_AUTH_QUEUE_URL',
        )}`,
        { name: AuthEventConsumer.name },
      );
      this.logger.error(error, { name: AuthEventConsumer.name });
      throw new Error(error);
    }

    while (this.#activeConsumer) {
      console.log('while loop');
      try {
        console.log('instanceNo polling from queue', instanceNo);
        const data = await sqsConumser.receiveMessage(config).promise();
        console.log('data', data);

        if (data?.Messages[0]?.ReceiptHandle) {
          console.log(`InstanceNo ${instanceNo} found a message`);
          await this.sqsService.removeEventsFromQueue(
            this.configService.get('AWS_SQS_AUTH_QUEUE_URL'),
            sqsConumser,
            data?.Messages[0]?.ReceiptHandle,
          );

          console.log(
            `instanceNo ${instanceNo} successfully removed from queue`,
          );
        }
      } catch (error) {
        this.logger.error('Failed to consumer messages');
        this.logger.error(JSON.stringify(error));

        console.log('closing the while loop');
        this.#activeConsumer = false;

        throw new InternalServerErrorException();
      }
    }
  }
}
