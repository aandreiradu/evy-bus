import { SQSService } from '@app/common/aws';
import { CreateQueueArgs } from '@app/common/constants/types';
import { UtilsService } from '@app/common/utils';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from 'apps/auth/src/auth.service';
import { AuthenticateUserDTO } from 'apps/auth/src/dto/authenticate-user.dto';
import { CreateUserDTO } from 'apps/auth/src/dto/create-user.dto';

@Injectable()
export class GatewayService {
  private readonly logger: Logger = new Logger(GatewayService.name);

  constructor(
    private readonly sqsService: SQSService,
    private readonly configSerivce: ConfigService,
    private readonly authService: AuthService,
    private readonly utilsService: UtilsService,
  ) {}

  async createQueue(queuePayload: CreateQueueArgs) {
    try {
      const responseAwsQueue = await this.sqsService.createQueue({
        QueueName: queuePayload.QueueName,
        tags: queuePayload.tags,
        Attributes: queuePayload.Attributes,
      });

      const queueToken = this.utilsService.generateQueueToken();

      console.log('passing this to authseervice', {
        userId: queuePayload.userId,
        queueToken,
        queueURL: responseAwsQueue.QueueUrl,
      });

      await this.authService.saveQueueTokens({
        userId: queuePayload.userId,
        queueToken,
        queueURL: responseAwsQueue.QueueUrl,
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

  async publishToEventsQueue(message: any): Promise<void> {
    try {
      const eventsQueueURL = this.configSerivce.get<string>(
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

  async createUser(createUserDTO: CreateUserDTO) {
    return this.authService.createUser(createUserDTO);
  }

  async authenticateUser(authenticateUserDTO: AuthenticateUserDTO) {
    return this.authService.authenticateUser(authenticateUserDTO);
  }
}
