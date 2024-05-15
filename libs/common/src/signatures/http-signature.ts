import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class HttpSignature {
  private readonly logger: Logger = new Logger(HttpSignature.name);

  generateWebhookSignature(secret: string, payload: string): string {}
}
