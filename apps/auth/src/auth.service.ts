import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateUserDTO } from './dto/create-user.dto';
import { AuthRepository } from './auth.repository';
import { AuthenticateUserDTO } from './dto/authenticate-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { QueueToken } from '@app/common/constants/types';

@Injectable()
export class AuthService {
  private readonly logger: Logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async createUser(createUserDTO: CreateUserDTO) {
    try {
      const existingUser = await this.authRepository.getUserByEmail(
        createUserDTO.email,
      );

      if (existingUser) {
        throw new ConflictException('Another account is using this email');
      }

      await this.authRepository.createUser(createUserDTO);

      return {
        isSuccess: true,
        message: 'Account created successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Failed to create user ${createUserDTO.email}`);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async authenticateUser(authenticateUserDTO: AuthenticateUserDTO) {
    try {
      const userAccount = await this.authRepository.getUserByEmail(
        authenticateUserDTO.email,
      );

      if (!userAccount) {
        throw new BadRequestException('Invalid email or password');
      }

      const { password: hashPasswords, id: userId } = userAccount;

      const passwordMatch = await this.comparePasswords(
        authenticateUserDTO.password,
        hashPasswords,
      );

      if (!passwordMatch) {
        throw new BadRequestException('Invalid email or password');
      }

      const { accessToken, refreshToken } = await this.generateJWTToken(userId);

      await this.authRepository.saveRefreshToken(userId, refreshToken);

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Failed to get user by email ${authenticateUserDTO.email}`,
      );
      this.logger.error(error);

      throw new InternalServerErrorException();
    }
  }

  private async comparePasswords(
    plainPassword: string,
    hashPassword: string,
  ): Promise<boolean> {
    try {
      return bcrypt.compare(plainPassword, hashPassword);
    } catch (error) {
      this.logger.error(`Failed to compare passwords`);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException(
        'Authentication failed. Please try again later',
      );
    }
  }

  async generateJWTToken(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(
          { userId },
          {
            secret: this.configService.get('JWT_ACCESS_TOKEN_SECRET'),
            expiresIn: '1h',
          },
        ),
        this.jwtService.signAsync(
          { userId },
          {
            secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
            expiresIn: '30d',
          },
        ),
      ]);

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error(`Failed to generate JWT token for userId ${userId}`);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException(
        `Authentication failed. Please try again later`,
      );
    }
  }

  async saveQueueTokens({ userId, queueToken, queueURL }) {
    try {
      const existingUserQueuesTokens =
        await this.authRepository.getExistingQueueToken(userId);

      let queueTokens: QueueToken[] = [];
      if (!existingUserQueuesTokens || !existingUserQueuesTokens?.length) {
        queueTokens = [
          {
            queueToken,
            queueURL,
          },
        ];
      } else {
        queueTokens = existingUserQueuesTokens;
        queueTokens.push({ queueToken, queueURL });
      }

      await this.authRepository.saveQueueTokens({ userId, queueTokens });
    } catch (error) {
      this.logger.error(
        `Failed to save queue tokens for userId ${userId}; queueToken: ${queueToken}; queueURL : ${queueURL}`,
      );
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException();
    }
  }
}
