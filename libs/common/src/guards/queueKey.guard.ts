import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../constants/types';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class QueueKeyGuard implements CanActivate {
  private readonly logger: Logger = new Logger(QueueKeyGuard.name);

  constructor(private readonly queueService: QueueService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    try {
      const userId = request?.userId;
      const token = request?.body?.token;

      if (!token) {
        throw new BadRequestException('Missing token');
      }

      const queueData = await this.queueService.getQueueUrlByToken(
        token,
        userId,
      );

      if (!queueData) {
        throw new BadRequestException('Invalid queue token');
      }

      const { queueURL, queueUserId, errorURL, successURL } = queueData ?? {};

      if (queueUserId !== userId) {
        this.logger.warn(
          `UserId ${userId} it's not authorized to push to the queue ${token}`,
        );

        throw new UnauthorizedException(
          `You're not allowed to perform this action`,
        );
      }

      request.body = {
        ...request.body,
        successURL,
        errorURL,
      };
      request['queueURL'] = queueURL;
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Exception occured for userId ${request?.userId}`);
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException('Exception occured');
    }
  }
}
