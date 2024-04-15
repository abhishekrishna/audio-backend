import { IsOptional } from 'class-validator';
import { UserType } from '../enums/user-type.enum';

export class SignInput {
  mobileNo: number;

  userType: UserType;

  @IsOptional()
  password: number;

  @IsOptional()
  otp: number;
}
