import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SaveQueueArgs } from './types';
import { DynamoDBService } from '../aws/dynamodb/dynamodb.service';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

@Injectable()
export class QueueRepository {
  private dbClient: DocumentClient = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly dynamoDbService: DynamoDBService,
  ) {
    this.dbClient = this.dynamoDbService.getClient();
  }

  async getQueueUrlByToken(
    token: string,
  ): Promise<{ queueURL: string; queueUserId: string } | null> {
    console.log({ token });
    const dbClient = this.dynamoDbService.getClient();

    const queueURLQuery = await dbClient
      .query({
        TableName: this.configService.get('AWS_DYNAMODB_QUEUES_TABLE_NAME'),
        IndexName: 'queueToken_index',
        KeyConditionExpression: 'queueToken = :queueToken',
        ExpressionAttributeValues: {
          ':queueToken': token,
        },
        ProjectionExpression: 'queueURL, userId',
      })
      .promise();

    if (!queueURLQuery.Items.length) return null;

    const { userId: queueUserId, queueURL } = queueURLQuery.Items[0] ?? {};

    return {
      queueURL,
      queueUserId,
    };
  }

  async saveQueueTokens(args: SaveQueueArgs) {
    await this.dbClient
      .put({
        TableName: this.configService.get('AWS_DYNAMODB_QUEUES_TABLE_NAME'),
        Item: args,
      })
      .promise();
  }
}
