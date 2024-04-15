import { MinLength } from 'class-validator';

export class SignUpInput {
  mobileNo: number;

  @MinLength(6)
  password: string;
}
