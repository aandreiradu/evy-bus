import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);

  // app.useLogger(app.get(Logger));
}
bootstrap();
