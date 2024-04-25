import { IsString, IsOptional } from 'class-validator';

export class UpdateUserProfile {
  @IsString()
  firstName: string;

  @IsString()
  @IsOptional()
  middleName: string;

  @IsString()
  lastName: string;
}
