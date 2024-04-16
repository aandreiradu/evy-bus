import { Controller, Get } from '@nestjs/common';
import { SQSService } from '@app/common/aws/sqs/sqs.service';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly sqsService: SQSService,
  ) {}

  @Get()
  async getHello() {
    return this.sqsService.sendMessage(
      this.configService.get('AWS_SQS_AUTH_QUEUE_URL'),
      {
        timestamp: Date.now(),
      },
    );
  }
}
