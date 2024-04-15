import {
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto-js';

import { firstValueFrom } from 'rxjs';
import { ValidationException } from '@/notification/src/meta/validation.exception';
import { ProductType } from '@/wah-care-collection/src/common/enums/product-type.enum';
import { NOTIFICATIONS_SERVICE, WAH_CARE_COLLECTION } from '@app/common';
import { LoginResponse } from './entities/login-response.entity';
import { ScreenMessage } from './enums/screen-message.enum';
import { ScreenType } from './enums/screen-type.enum';
import { loggingEventType } from './logging-events/enums/screen-message.enum';
import { LoggingEventService } from './logging-events/logging-event.service';
import { AutoSignInput } from './user/dtos/auto-signin.dto';
import { PreschoolDetails } from './user/dtos/preschool-details.dto';
import { SignInput } from './user/dtos/sign-input.dto';
import { UserType } from './user/enums/user-type.enum';
import { UserService } from './user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private readonly loggingEventService: LoggingEventService,
    @Inject(NOTIFICATIONS_SERVICE) private readonly whatsappBotService: ClientProxy,
    @Inject(WAH_CARE_COLLECTION) private readonly wahCareCollectionService: ClientProxy,
  ) {}

  createTokens(userId: string, mobileNo: number, userType: UserType): Promise<LoginResponse> {
    const accessToken = this.jwtService.sign(
      {
        userId,
        mobileNo,
        userType,
      },
      {
        secret: this.configService.get('ACCESS_TOKEN_SECRET'),
      },
    );
    // const refreshToken = this.jwtService.sign(
    //   {
    //     userId,
    //     mobileNo,
    //     accessToken,
    //   },
    //   {
    //     expiresIn: '7d',
    //     secret: this.configService.get('REFRESH_TOKEN_SECRET'),
    //   },
    // );

    return Promise.resolve({ accessToken });
  }

  createTokensToSetPassword(
    userId: string,
    mobileNo: number,
    userType: UserType,
  ): Promise<LoginResponse> {
    const accessToken = this.jwtService.sign(
      {
        userId,
        mobileNo,
        userType,
      },
      {
        expiresIn: '5m', // 5 minutes
        secret: this.configService.get('ACCESS_TOKEN_SECRET'),
      },
    );
    return Promise.resolve({ accessToken });
  }

  async loginStatus(signInInput: SignInput): Promise<LoginResponse> {
    if (!signInInput?.mobileNo || !signInInput?.userType) {
      throw new UnauthorizedException('Missing parameters');
    }
    const user = await this.userService.findUser(signInInput.mobileNo, signInInput.userType);
    if (!user) {
      throw new NotFoundException("Couldn't find Your Account.");
    }
    if (!user?.password || !user?.password[signInInput.userType]) {
      const generateOtp = Math.floor(1000 + Math.random() * 9000);
      this.whatsappBotService.emit('whatsapp-otp', {
        templateName: 'otp_verification',
        mobileNumber: [`+91${signInInput.mobileNo}`],
        otp: `${generateOtp}`,
        userType: `${signInInput.userType} App`,
      });
      await this.userService.assignOtpToUser(signInInput.mobileNo, generateOtp); // send Otp
      return { screenType: ScreenType.OTP, message: ScreenMessage.OTP_SENT };
    }
    if (user.password) {
      return { screenType: ScreenType.PASSWORD, message: ScreenMessage.ENTER_PASSWORD };
    }
  }

  async otpVerification(signInInput: SignInput): Promise<LoginResponse> {
    if (!signInInput?.mobileNo || !signInInput?.userType || !signInInput?.otp) {
      throw new UnauthorizedException('Missing parameters');
    }
    const user = await this.userService.findUser(signInInput.mobileNo, signInInput.userType);
    if (!user) {
      throw new NotFoundException("Couldn't find Your Account.");
    }
    // validate Otp
    const otpValue = await this.userService.findUser(signInInput.mobileNo, signInInput.userType);
    // Decrypt and verify the otp
    const decryptedOTP = crypto.AES.decrypt(
      otpValue.otp,
      this.configService.get('OTP_SECRET_KEY'),
    ).toString(crypto.enc.Utf8);
    // Decrypted Data
    const decryptedOTPObject = JSON.parse(decryptedOTP);
    // Checking type is object
    if (decryptedOTPObject?.otp !== signInInput?.otp) {
      return { screenType: ScreenType.OTP, message: ScreenMessage.OTP_NOT_VALID };
    }
    // current time stamp
    const currentTimestampInSeconds = Math.floor(Date.now() / 1000);
    if (!decryptedOTPObject?.dateNow) {
      throw new ValidationException('Date is missing', HttpStatus.FORBIDDEN);
    }

    // Decrypted time stamp
    const decryptedTimestamp = parseInt(decryptedOTPObject?.dateNow.slice(0, 44), 10);
    // Calculate time difference in minutes
    const timeDifferenceInSeconds = Math.abs(currentTimestampInSeconds - decryptedTimestamp);
    const timeDifferenceInMinutes = timeDifferenceInSeconds / 60;
    // Authenticating if time difference between request is less than 15 minutes then only authenticate
    if (timeDifferenceInMinutes < 15) {
      const { accessToken } = await this.createTokensToSetPassword(
        user._id,
        user.mobileNo,
        signInInput.userType,
      );

      await this.userService.assignOtpToUser(otpValue.mobileNo);
      await this.userService.updateAccessToken(
        user._id,
        accessToken,
        signInInput.userType,
        loggingEventType.SET_PASSWORD,
      );
      return {
        accessToken,
        screenType: ScreenType.GENERATE_PASSWORD,
        message: ScreenMessage.ENTER_PASSWORD,
      };
    }
    throw new ValidationException('Your otp has expired', HttpStatus.FORBIDDEN);
  }

  async forgotPassword(signInInput: SignInput): Promise<LoginResponse> {
    if (!signInInput?.mobileNo || !signInInput?.userType) {
      throw new UnauthorizedException('Missing parameters');
    }
    const user = await this.userService.findUser(signInInput.mobileNo, signInInput.userType);
    if (!user) {
      throw new NotFoundException("Couldn't find Your Account.");
    }

    if (!user?.password || !user?.password[`${signInInput?.userType}`]) {
      throw new NotFoundException('Setup Your Password First.');
    }

    const generateOtp = Math.floor(1000 + Math.random() * 9000);

    this.whatsappBotService.emit('whatsapp-otp', {
      templateName: 'otp_verification',
      mobileNumber: [`+91${signInInput.mobileNo}`],
      otp: `${generateOtp}`,
      userType: `${signInInput.userType} App`,
    });

    await this.userService.assignOtpToUser(signInInput.mobileNo, generateOtp); // send Otp

    return { screenType: ScreenType.OTP, message: ScreenMessage.OTP_SENT };
  }

  async setPassword(signUpInput: SignInput): Promise<LoginResponse> {
    if (!signUpInput?.mobileNo || !signUpInput?.userType || !signUpInput?.password) {
      throw new UnauthorizedException('Missing parameters');
    }
    const mobileNo = await this.userService.findUser(signUpInput.mobileNo, signUpInput.userType);
    if (!mobileNo) {
      throw new UnprocessableEntityException("Couldn't find Your Account.");
    }
    const user = await this.userService.updateUserPassword(
      signUpInput.password,
      signUpInput.mobileNo,
      signUpInput.userType,
    );
    const { accessToken } = await this.createTokens(user._id, user.mobileNo, signUpInput.userType);
    await this.userService.updateAccessToken(
      user._id,
      accessToken,
      signUpInput.userType,
      loggingEventType.SET_PASSWORD,
    );
    return { accessToken, user, message: ScreenMessage.LOGIN_SUCCESSFUL };
  }

  async signIn(signInInput: SignInput): Promise<LoginResponse> {
    if (!signInInput?.mobileNo || !signInInput?.userType || !signInInput.password) {
      throw new UnauthorizedException('Missing parameters');
    }
    const user = await this.userService.findUser(signInInput.mobileNo, signInInput.userType);
    if (!user) {
      throw new NotFoundException("Couldn't find Your Account.");
    }

    if (!user?.password || !user?.password[`${signInInput?.userType}`]) {
      throw new NotFoundException('Setup Your Password First.');
    }
    const isPasswordValid = await bcrypt.compare(
      String(signInInput.password),
      user.password[signInInput.userType],
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credentials are not valid.');
    }
    const { accessToken } = await this.createTokens(user._id, user.mobileNo, signInInput.userType);
    await this.userService.updateAccessToken(
      user._id,
      accessToken,
      signInInput.userType,
      loggingEventType.LOGIN,
    );
    let prductType: ProductType[] = [];
    if (user.userType.includes(UserType.PRESCHOOL) && signInInput.userType === UserType.PRESCHOOL) {
      prductType = await firstValueFrom(
        this.wahCareCollectionService.send('listPruductTypes', { preschoolId: [user._id] }),
      );
    } else if (
      user.userType.includes(UserType.TEACHER) &&
      signInInput.userType === UserType.TEACHER
    ) {
      if (user?.preschoolDetails.length !== 0) {
        const ids = user?.preschoolDetails?.map((val) => val?.preschoolId);
        prductType = await firstValueFrom(
          this.wahCareCollectionService.send('listPruductTypes', { preschoolId: ids }),
        );
      }
    }
    const productType = new Set(prductType);
    return {
      accessToken,
      user,
      message: ScreenMessage.LOGIN_SUCCESSFUL,
      prductType: [...productType.values()],
    };
  }

  // async getNewTokens(id: string, rfToken: string): Promise<LoginResponse> {
  //   const user = await this.userService.findOne(id);
  //   if (!user) {
  //     throw new ForbiddenException('Access Denied');
  //   }
  //   const verifyRefreshToken = await bcrypt.compare(rfToken, user.refreshToken);
  //   if (!verifyRefreshToken) {
  //     throw new ForbiddenException('Access Denied');
  //   }
  //   const { accessToken, refreshToken } = await this.createTokens(user._id, user.mobileNo);
  //   await this.userService.updateRefreshToken(user._id, refreshToken);
  //   return { accessToken, refreshToken, user };
  // }
  async autoSignIn(signInInput: AutoSignInput): Promise<LoginResponse> {
    const doesTokenExists = await this.loggingEventService.doesTokenExists(
      signInInput.userId,
      signInInput.userType,
      signInInput.accessToken,
    );
    if (doesTokenExists) {
      const user = await this.userService.findUserById(signInInput.userId);
      let prductType: ProductType[] = [];
      if (
        user.userType.includes(UserType.PRESCHOOL) &&
        signInInput.userType === UserType.PRESCHOOL
      ) {
        prductType = await firstValueFrom(
          this.wahCareCollectionService.send('listPruductTypes', { preschoolId: user._id }),
        );
      } else if (
        user.userType.includes(UserType.TEACHER) &&
        signInInput.userType === UserType.TEACHER
      ) {
        prductType = await firstValueFrom(
          this.wahCareCollectionService.send('listPruductTypes', {
            preschoolId: user.preschoolDetails.map((preschool: PreschoolDetails): string => {
              if (preschool.preschoolId) return preschool.preschoolId;
              return null;
            }),
          }),
        );
      }
      const productType = new Set(prductType);
      return {
        accessToken: signInInput.accessToken,
        user,
        message: ScreenMessage.LOGIN_SUCCESSFUL,
        prductType: [...productType.values()],
      };
    }
    throw new UnauthorizedException('Credentials are not valid.');
  }
}
