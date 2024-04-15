import { UserType } from '@/auth/src/user/enums/user-type.enum';

export type JwtPayload = {
  mobileNo: string;
  userId: string;
  userType: UserType;
};

export type JwtPayloadWithRefreshToken = JwtPayload & { refreshToken: string };
