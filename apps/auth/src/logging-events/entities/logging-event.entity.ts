import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { UserType } from '../../user/enums/user-type.enum';
import { loggingEventType } from '../enums/screen-message.enum';

@Schema({ timestamps: true })
export class LoggingEvent {
  _id: string;

  @Prop()
  userId: string;

  @Prop({ type: String })
  userType: UserType;

  @Prop()
  accessToken: string;

  @Prop({ type: String })
  type: loggingEventType;

  @Prop()
  active: boolean;

  createdAt: Date;

  updatedAt: Date;
}

export type LoggingEventDocument = LoggingEvent & Document;

export const LoggingEventSchema = SchemaFactory.createForClass(LoggingEvent);
