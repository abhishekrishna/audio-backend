import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import {
  AccessTokenGuard,
  AccessTokenStrategy,
  DatabaseModule,
  HealthModule,
  NOTIFICATIONS_SERVICE,
  RefreshTokenStrategy,
  WAH_CARE_COLLECTION,
} from '@app/common';
import { RolesGuard } from '@app/common/auth/guards/roles.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChildModule } from './child/child.module';
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
    ClientsModule.registerAsync([
      // here trying to connect
      {
        name: NOTIFICATIONS_SERVICE,
        useFactory: (configService: ConfigService): unknown => ({
          transport: Transport.TCP,
          options: {
            host: configService.getOrThrow('TCP_HOST'),
            port: +configService.getOrThrow('NOTIFICATION_TCP_PORT'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
    ClientsModule.registerAsync([
      // here trying to connect
      {
        name: WAH_CARE_COLLECTION,
        useFactory: (configService: ConfigService): unknown => ({
          transport: Transport.TCP,
          options: {
            host: configService.getOrThrow('TCP_HOST'),
            port: +configService.getOrThrow('WAHCARE_COLLECTION_TCP_PORT'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
    DatabaseModule,
    ChildModule,
    HealthModule,
    LoggingEventModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    JwtService,
    ConfigService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
