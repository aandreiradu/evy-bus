import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateUserDTO } from './dto/create-user.dto';
import { AuthRepository } from './dto/auth.repository';

@Injectable()
export class AuthService {
  private readonly logger: Logger = new Logger(AuthService.name);

  constructor(private readonly authRepository: AuthRepository) {}

  async createUser(createUserDTO: CreateUserDTO) {
    try {
      const user = await this.authRepository.createUser(createUserDTO);

      return {
        isSuccess: true,
        user,
      };
    } catch (error) {
      this.logger.error(`Failed to create user ${createUserDTO.email}`);
      this.logger.error(JSON.stringify(error));

      throw new InternalServerErrorException('Failed to create user');
    }
  }
}
