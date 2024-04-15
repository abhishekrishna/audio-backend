import { Body, Controller, Post } from '@nestjs/common';
// import { Roles } from '@app/common';
import { Public } from '@app/common/decorators/public.decorator';

import { AuthService } from './auth.service';
import { LoginResponse } from './entities/login-response.entity';
import { AutoSignInput } from './user/dtos/auto-signin.dto';
import { SignInput } from './user/dtos/sign-input.dto';
// import { UserType } from './user/enums/user-type.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('setPassword')
  setPassword(@Body() signUpInput: SignInput): Promise<LoginResponse> {
    return this.authService.setPassword(signUpInput);
  }

  @Public()
  @Post('loginStatus')
  loginStatus(@Body() signInInput: SignInput): Promise<LoginResponse> {
    return this.authService.loginStatus(signInInput);
  }

  @Public()
  @Post('otpVerification')
  otpVerification(@Body() signInInput: SignInput): Promise<LoginResponse> {
    return this.authService.otpVerification(signInInput);
  }

  @Public()
  @Post('signIn')
  signIn(@Body() signInInput: SignInput): Promise<LoginResponse> {
    return this.authService.signIn(signInInput);
  }

  @Public()
  @Post('forgotPassword')
  forgotPassword(@Body() signInInput: SignInput): Promise<LoginResponse> {
    return this.authService.forgotPassword(signInInput);
  }

  @Public()
  @Post('autoSignIn')
  autoSignIn(@Body() signInInput: AutoSignInput): Promise<LoginResponse> {
    return this.authService.autoSignIn(signInInput);
  }

  // @Public()
  // @UseGuards(RefreshTokenGuard)
  // @Post('new_tokens')
  // getNewTokens(
  //   @CurrentUserMobileNo() userId: string,
  //   @CurrentUser('refreshToken') refreshToken: string,
  // ): Promise<LoginResponse> {
  //   return this.authService.getNewTokens(userId, refreshToken);
  // }
}
