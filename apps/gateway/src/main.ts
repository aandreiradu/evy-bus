import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  await app.listen(3000);
}
bootstrap();
