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

  // async getQueueByNameAndUserId(queueName : string, userId : string) {
  //   return this.dbClient
  //   .get({
  //     TableName : this.configService.get('AWS_DYNAMODB_QUEUES_TABLE_NAME'),
  //     Key : {
  //       queueURL :
  //     }
  //   })
  // }

  async saveQueueTokens(args: SaveQueueArgs) {
    await this.dbClient
      .put({
        TableName: this.configService.get('AWS_DYNAMODB_QUEUES_TABLE_NAME'),
        Item: args,
      })
      .promise();
  }
}
