import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class QueueKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const queueKey = this.extractEvyHeaader(request);

    if (!queueKey) {
      throw new UnauthorizedException('Missing X-EVY-Queue');
    }

    return true;
  }

  private extractEvyHeaader(request: Request) {
    return request.headers['X-EVY-Queue'] ?? null;
  }
}
