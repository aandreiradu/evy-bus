import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SQSService } from '@app/common/aws/sqs/sqs.service';
import { AuthEventConsumer } from './consumers/auth.consumer';

@Module({
  imports: [],
  controllers: [AuthController],
  providers: [AuthService, SQSService, AuthEventConsumer],
  exports: [AuthService],
})
export class AuthModule {}
