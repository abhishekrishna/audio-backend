import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { UtilityFunctionService } from '@/wah-care-collection/src/common/services/utility-function.service';
import { NOTIFICATIONS_SERVICE, WAH_CARE_COLLECTION } from '@app/common';

import { ChildModule } from '../child/child.module';
import { LoggingEventModule } from '../logging-events/logging-event.module';
import { User, UserSchema } from './dtos';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    forwardRef(() => ChildModule),
    LoggingEventModule,
    MulterModule.register({
      dest: './uploads/preschool-user', // Set your desired upload directory
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
  ],
  providers: [UserService, UtilityFunctionService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
