import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AccountKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const queueKey = this.extractEvyHeaader(request);

    if (!queueKey) {
      throw new UnauthorizedException('Missing X-EVY-Account');
    }

    request['body'] = {
      ...request['body'],
      accountKey: queueKey,
    };
    return true;
  }

  private extractEvyHeaader(request: Request) {
    return request.headers['x-evy-account'] ?? null;
  }
}
