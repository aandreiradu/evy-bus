import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  private readonly logger: Logger = new Logger(AccessTokenGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext) {
    try {
      const request = context.switchToHttp().getRequest<Request>();
      const accessToken = this.extractTokenFromHeader(request);

      if (!accessToken) {
        throw new UnauthorizedException('Missing Authorization');
      }

      const tokenDecoded = await this.validateAuthorizationToken(accessToken);

      request['userId'] = tokenDecoded.userId;

      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async validateAuthorizationToken(token: string) {
    try {
      return this.jwtService.verifyAsync<{ userId: string }>(token, {
        secret: this.configService.get('JWT_ACCESS_TOKEN_SECRET'),
      });
    } catch (error) {
      if (
        error instanceof TokenExpiredError ||
        (error instanceof Error && error.name === 'TokenExpiredError')
      ) {
        throw new ForbiddenException();
      }

      this.logger.error(`Failed to validate JWT for token ${token}`);
      this.logger.error(JSON.stringify(error));

      throw new UnauthorizedException();
    }
  }
}
