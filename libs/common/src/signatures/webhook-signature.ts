import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class WebhookSignature {
  private readonly logger: Logger = new Logger(WebhookSignature.name);

  generateWebhookSignature(secret: string, payload: string): string {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const signedPayload = `${timestamp}.${payload}`;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      console.log('generated this signature');
      return `t=${timestamp},v1=${signature}`;
    } catch (error) {
      this.logger.error(
        `Failed to generate webhook signature for payload ${JSON.stringify(
          payload,
        )};`,
      );
      this.logger.debug(error);

      throw new InternalServerErrorException(
        'Failed to generate webhook signature',
      );
    }
  }

  verifySignature(
    secret: string,
    payload: string,
    signatureHeader: string,
  ): boolean {
    const elements = signatureHeader.split(',');
    const timestampElement = elements.find((e) => e.startsWith('t='));
    const signatureElement = elements.find((e) => e.startsWith('v1='));

    if (!timestampElement || !signatureElement) {
      throw new UnauthorizedException('Invalid signature header');
    }

    const timestamp = timestampElement.split('=')[1];
    const receivedSignature = signatureElement.split('=')[1];
    const signedPayload = `${timestamp}.${payload}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const isSignatureValid = this.timingSafeEqual(
      receivedSignature,
      expectedSignature,
    );

    const toleranceInSeconds = 300; // 5 minutes
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timestampDifference = Math.abs(
      currentTimestamp - parseInt(timestamp, 10),
    );

    if (timestampDifference > toleranceInSeconds) {
      throw new UnauthorizedException('Timestamp is out of tolerance');
    }

    return isSignatureValid;
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const aLen = Buffer.byteLength(a);
    const bLen = Buffer.byteLength(b);
    const bufferA = Buffer.alloc(aLen, 0, 'utf8');
    bufferA.write(a);
    const bufferB = Buffer.alloc(bLen, 0, 'utf8');
    bufferB.write(b);
    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}
