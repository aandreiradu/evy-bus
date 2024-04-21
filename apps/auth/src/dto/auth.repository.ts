import { DynamoDBService } from '@app/common/aws/dynamodb/dynamodb.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateUserDTO } from './create-user.dto';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthRepository {
  constructor(
    private readonly configService: ConfigService,
    private readonly dynamoDBService: DynamoDBService,
  ) {}

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

    const responseAWS = await dbClient
      .put({
        TableName: this.configService.get('AWS_DYNAMODB_USERS_TABLE_NAME'),
        Item: user,
      })
      .promise();

    return responseAWS;
  }
}
