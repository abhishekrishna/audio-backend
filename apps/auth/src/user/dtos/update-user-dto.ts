import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsOptional } from 'class-validator';
import { UserType } from '../enums/user-type.enum';
import { UpdateUserProfile } from './update-user-profile-dto';

@Schema({ timestamps: false })
export class UpdateUserDto {
  @IsOptional()
  _id: string;

  @Prop({ unique: true })
  mobileNo: number;

  @Prop()
  profile: UpdateUserProfile;

  @IsOptional()
  password: number;

  userType: UserType;
}

export type UserDocument = UpdateUserDto & Document;

export const UserSchema = SchemaFactory.createForClass(UpdateUserDto);
