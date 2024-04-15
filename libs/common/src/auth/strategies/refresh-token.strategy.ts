import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, JwtPayloadWithRefreshToken } from '@app/common/types/jwt-payload.type';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('REFRESH_TOKEN_SECRET'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): Promise<JwtPayloadWithRefreshToken> {
    const accessToken = null;
    const refreshToken = req?.get('Authorization')?.replace('Bearer', '')?.trim();
    const data = { ...payload, accessToken };
    return Promise.resolve({ ...data, refreshToken });
  }
}
