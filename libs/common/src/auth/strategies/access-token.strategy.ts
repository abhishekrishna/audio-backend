import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import axios from 'axios';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@app/common/types/jwt-payload.type';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('ACCESS_TOKEN_SECRET'),
      passReqToCallback: true,
    });
  }

  async getLoggingEvent(
    userId: string,
    userType: UserType,
    type: loggingEventType,
  ): Promise<string> {
    const response = await axios.get(
      `${this.configService.getOrThrow(
        'AUTH_SERVICE',
      )}/loggingevent/accessTokens?userId=${userId}&userType=${userType}&type=${type}`,
    );

    return response.data;
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtPayload> {
    if (
      req?.url === '/auth/setPassword' &&
      req?.body?.mobileNo &&
      req?.body?.mobileNo !== payload?.mobileNo
    ) {
      throw new UnauthorizedException();
    }
    const accessToken = await this.getLoggingEvent(
      payload.userId,
      payload.userType,
      req?.url === '/auth/setPassword'
        ? loggingEventType.SET_PASSWORD
        : loggingEventType.LOGIN,
    );
    if (
      accessToken &&
      accessToken === req.headers?.authorization?.replace('Bearer ', '')
    ) {
      return Promise.resolve(payload);
    }
    throw new UnauthorizedException();
  }
}
