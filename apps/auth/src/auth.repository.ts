import { DynamoDBService } from '@app/common/aws/dynamodb/dynamodb.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateUserDTO } from './dto/create-user.dto';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import {
  SaveQueueTokenURLArgs,
  UserQueueTokensResponse,
} from '@app/common/constants/types';

@Injectable()
export class AuthRepository {
  constructor(
    private readonly configService: ConfigService,
    private readonly dynamoDBService: DynamoDBService,
  ) {}

  async getUserByEmail(email: string) {
    const dbClient = this.dynamoDBService.getClient();

    const user = await dbClient
      .query({
        TableName: this.configService.get('AWS_DYNAMODB_USERS_TABLE_NAME'),
        ProjectionExpression: 'id, email, password, firstName',
        IndexName: 'email_index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email,
        },
      })
      .promise();

    if (!user.Items || !user.Items.length) {
      return null;
    }

    return user.Items[0] as CreateUserDTO & { id: string };
  }

  async createUser(createUserDTO: CreateUserDTO) {
    const dbClient = this.dynamoDBService.getClient();

    const user = {
      ...createUserDTO,
      id: uuidv4(),
      password: await bcrypt.hash(createUserDTO['password'], 10),
    };

    delete createUserDTO['password'];
    delete createUserDTO['confirmPassword'];
    delete user['confirmPassword'];

    await dbClient
      .put({
        TableName: this.configService.get('AWS_DYNAMODB_USERS_TABLE_NAME'),
        Item: user,
      })
      .promise();
  }

  async saveRefreshToken(userId: string, refreshToken: string) {
    const dbClient = this.dynamoDBService.getClient();

    await dbClient
      .update({
        TableName: this.configService.get('AWS_DYNAMODB_USERS_TABLE_NAME'),
        Key: {
          id: userId,
        },
        UpdateExpression: 'set refreshToke = :refreshToken',
        ExpressionAttributeValues: {
          ':refreshToken': refreshToken,
        },
      })
      .promise();
  }

  async getExistingQueueToken(userId: string) {
    const dbClient = this.dynamoDBService.getClient();

    const existingQueuesTokens = await dbClient
      .get({
        TableName: this.configService.get('AWS_DYNAMODB_USERS_TABLE_NAME'),
        Key: {
          id: userId,
        },
        ProjectionExpression: 'queueTokens, id',
      })
      .promise();

    console.log({ existingQueuesTokens });

    return (existingQueuesTokens?.Item as UserQueueTokensResponse) || null;
  }

  async saveQueueTokens({ userId, queueTokens }: SaveQueueTokenURLArgs) {
    console.log('params', { userId, queueTokens });
    const dbClient = this.dynamoDBService.getClient();

    await dbClient
      .update({
        TableName: this.configService.get('AWS_DYNAMODB_USERS_TABLE_NAME'),
        Key: {
          id: userId,
        },
        UpdateExpression: 'set queuesTokens = :queuesTokens',
        ExpressionAttributeValues: {
          ':queuesTokens': JSON.stringify(queueTokens),
        },
      })
      .promise();
  }
}
