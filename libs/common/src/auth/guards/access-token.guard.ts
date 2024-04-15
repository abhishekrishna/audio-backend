import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class AccessTokenGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  getRequest(context: ExecutionContext): unknown {
    const ctx = context.switchToHttp();

    return ctx.getRequest();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
