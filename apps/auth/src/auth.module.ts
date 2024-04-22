import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SQSService } from '@app/common/aws/sqs/sqs.service';
import { AuthEventConsumer } from './consumers/auth.consumer';
import { AuthRepository } from './auth.repository';
import { DynamoDBService } from '@app/common/aws/dynamodb/dynamodb.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      global: true,
    }),
  ],
  providers: [
    AuthService,
    SQSService,
    AuthEventConsumer,
    AuthRepository,
    DynamoDBService,
  ],
  exports: [AuthService, DynamoDBService],
})
export class AuthModule {}
