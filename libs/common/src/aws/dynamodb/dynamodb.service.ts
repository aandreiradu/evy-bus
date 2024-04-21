import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDB } from 'aws-sdk';

@Injectable()
export class DynamoDBService {
  private readonly logger: Logger = new Logger(DynamoDBService.name);
  private client: DynamoDB.DocumentClient;
  private documentClient: DynamoDBClient;

  constructor(private readonly configService: ConfigService) {
    const clientConfig = {};

    if (this.configService.get<string>('NODE_ENV') === 'development') {
      clientConfig['endpoint'] = 'http://localhost:4566';
      clientConfig['region'] = 'eu-central-1';
    }

    this.client = new DynamoDB.DocumentClient(clientConfig);
    this.documentClient = new DynamoDBClient(clientConfig);

    this.logger.log(`DynamoDB client initialized`);
  }

  getClient(): DynamoDB.DocumentClient {
    return this.client;
  }

  getDocumentClient(): DynamoDBClient {
    return this.documentClient;
  }

  convertToObject<T>(attributeValues: DynamoDB.AttributeMap): T {
    return DynamoDB.Converter.unmarshall(attributeValues) as T;
  }
}
