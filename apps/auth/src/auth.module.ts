import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import {
  AccessTokenGuard,
  AccessTokenStrategy,
  DatabaseModule,
  RefreshTokenStrategy,
} from '@app/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoggingEventModule } from './logging-events/logging-event.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './apps/auth/.env',
    }),
    forwardRef(() => UserModule),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.get('JWT_EXPIRATION')}s`,
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,

    LoggingEventModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    JwtService,
    ConfigService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
