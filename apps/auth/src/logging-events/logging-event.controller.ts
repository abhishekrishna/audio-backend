import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '@app/common/decorators/public.decorator';
import { UserType } from '../user/enums/user-type.enum';
import { loggingEventType } from './enums/screen-message.enum';
import { LoggingEventService } from './logging-event.service';

@Controller('loggingevent')
export class LoggingEventController {
  constructor(private readonly loggingEventService: LoggingEventService) {}

  // used by access-token.stategy
  @Public()
  @Get('accessTokens')
  async accessTokens(
    @Query('userId') userId: string,
    @Query('userType') userType: UserType,
    @Query('type') type: loggingEventType,
  ): Promise<string> {
    return this.loggingEventService.accessTokens(userId, userType, type);
  }
}
