import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserType } from '../user/enums/user-type.enum';
import {
  LoggingEvent,
  LoggingEventDocument,
} from './entities/logging-event.entity';
import { loggingEventType } from './enums/screen-message.enum';

@Injectable()
export class LoggingEventService {
  constructor(
    @InjectModel(LoggingEvent.name)
    private loggingEventModel: Model<LoggingEventDocument>,
  ) {}

  async accessTokens(
    userId: string,
    userType: UserType,
    type?: loggingEventType,
  ): Promise<string> {
    const loggingEvent = await this.loggingEventModel.findOne({
      userId,
      userType,
      active: true,
      type: type || loggingEventType.LOGIN,
    });
    if (!loggingEvent) {
      return null;
    }
    return loggingEvent.accessToken;
  }

  async create(
    userId: string,
    userType: UserType,
    accessToken: string,
    type: loggingEventType,
  ): Promise<void> {
    await this.loggingEventModel.updateMany(
      { userId, userType },
      {
        $set: {
          active: false,
        },
      },
    );
    await this.loggingEventModel.create({
      userId,
      userType,
      accessToken,
      type,
      active: true,
    });
  }

  async doesTokenExists(
    userId: string,
    userType: UserType,
    accessToken: string,
  ): Promise<boolean> {
    const logger = await this.loggingEventModel.findOne({
      userId,
      userType,
      accessToken,
      active: true,
    });
    if (!logger) return false;
    return true;
  }
}
