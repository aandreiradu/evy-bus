import { NestFactory } from '@nestjs/core';
import { BillingModule } from './billing.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(BillingModule);
  // app.useLogger(app.get(Logger));
}
bootstrap();
