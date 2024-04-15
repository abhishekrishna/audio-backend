import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  app.connectMicroservice({
    transport: Transport.TCP,
    options: {
      host: configService.getOrThrow('TCP_HOST'),
      port: +configService.getOrThrow('TCP_PORT'),
    },
  });
  app.enableCors();
  // app.use(coockieParser());
  app.useGlobalPipes(new ValidationPipe());
  await app.startAllMicroservices();
  await app.listen(+configService.getOrThrow('APP_PORT'), () => {
    logger.log(`Server started on http://localhost:${+configService.getOrThrow('APP_PORT')}`);
  });
}
bootstrap();
