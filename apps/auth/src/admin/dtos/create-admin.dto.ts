import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IsDobFormat } from '@app/common/validator/dob-format.validator';
import { Gender } from '../enums/gender.enum';
import { Track } from '../entities/track.entity';

export class CreateAdmin {
  @IsString()
  firstName: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsDobFormat()
  dob: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  userId?: string;

  tracks?: [Track];
}
