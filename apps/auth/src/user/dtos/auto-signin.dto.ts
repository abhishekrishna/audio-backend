import { UserType } from '../enums/user-type.enum';

export class AutoSignInput {
  userId: string;

  userType: UserType;

  accessToken: string;
}
