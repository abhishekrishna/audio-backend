import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LoggingEvent,
  LoggingEventSchema,
} from './entities/logging-event.entity';
import { LoggingEventController } from './logging-event.controller';
import { LoggingEventService } from './logging-event.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LoggingEvent.name, schema: LoggingEventSchema },
    ]),
  ],
  providers: [LoggingEventService],
  controllers: [LoggingEventController],
  exports: [LoggingEventService],
})
export class LoggingEventModule {}
