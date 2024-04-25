import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsOptional, IsString, IsStrongPassword } from 'class-validator';

@Schema({ timestamps: true })
export class User {
  @IsOptional()
  _id: string;

  @Prop()
  @IsOptional()
  @IsString()
  userName: string;

  @Prop({ type: Object })
  @IsStrongPassword()
  password: { [key: string]: string };

  @Prop({ unique: true })
  mobileNo: number;

  @Prop()
  email: string;

  updatedAt: Date;

  @Prop()
  otp: string;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);
