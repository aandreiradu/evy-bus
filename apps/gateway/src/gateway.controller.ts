import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { AccessTokenGuard } from '@app/common/guards';
import { v4 as uuidv4 } from 'uuid';
import {
  createUserSchema,
  CreateUserDTO,
} from 'apps/auth/src/dto/create-user.dto';
import { ZodValidationPipe } from '@app/common/pipes/validation.pipe';
import {
  AuthenticateUserDTO,
  authenticateUserSchema,
} from 'apps/auth/src/dto/authenticate-user.dto';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { CreateQueueDTO, createQueueSchema } from './dto/create-queue.dto';
import { AuthenticatedRequest } from '@app/common/constants/types';
@Controller()
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly configService: ConfigService,
  ) {}

  @Post('sign-up')
  @UsePipes(new ZodValidationPipe(createUserSchema))
  async createUser(@Body() createUserDTO: CreateUserDTO) {
    return this.gatewayService.createUser(createUserDTO);
  }

  @Post('sign-in')
  @UsePipes(new ZodValidationPipe(authenticateUserSchema))
  async authenticateUser(
    @Body() authenticateUserDTO: AuthenticateUserDTO,
    @Res() response: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.gatewayService.authenticateUser(authenticateUserDTO);

    const cookieName = this.configService.get('JWT_REFRESH_TOKEN_COOKIE_NAME');

    return response
      .cookie(cookieName, refreshToken, {
        httpOnly: true,
        secure: true /*,expires :*/,
      })
      .json({ accessToken });
  }

  @Post('create-queue')
  @UsePipes(new ZodValidationPipe(createQueueSchema))
  @UseGuards(AccessTokenGuard)
  async createQueue(
    @Req() req: AuthenticatedRequest,
    @Body() createQueueDTO: CreateQueueDTO,
  ) {
    return this.gatewayService.createQueue({
      userId: req['userId'],
      QueueName: createQueueDTO['QueueName'],
    });
  }

  @Post('send-message')
  async sendMessage(@Body() payload: any) {
    const CID = uuidv4();

    await this.gatewayService.publishToEventsQueue({
      ...payload,
      CorrelationId: CID,
    });

    return {
      message: 'Message received successfully',
    };
  }
}
