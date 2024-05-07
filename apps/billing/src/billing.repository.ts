import { DynamoDBService } from '@app/common/aws/dynamodb/dynamodb.service';
import { BillingMessage } from '@app/common/constants/types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BillingRepository {
  constructor(
    private readonly dynamoDbService: DynamoDBService,
    private readonly configService: ConfigService,
  ) {}

  async registerPayment(message: BillingMessage): Promise<void> {
    const dbClient = this.dynamoDbService.getClient();

    const paymentPK = uuidv4();

    const paymentDocument = {
      ...message,
      id: paymentPK,
    };

    await dbClient
      .put({
        TableName: this.configService.get('AWS_DYNAMODB_BILLING_TABLE_NAME'),
        Item: paymentDocument,
      })
      .promise();
  }
}
