import { Prop } from '@nestjs/mongoose';
import { ProductType } from '@/wah-care-collection/src/common/enums/product-type.enum';
import { ScreenMessage } from '../enums/screen-message.enum';
import { ScreenType } from '../enums/screen-type.enum';
import { User } from '../user/dtos';

export class LoginResponse {
  accessToken?: string;

  refreshToken?: string;

  @Prop()
  user?: User;

  prductType?: ProductType[];

  screenType?: ScreenType;

  message?: ScreenMessage;
}
