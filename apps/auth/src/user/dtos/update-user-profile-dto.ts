import { Type } from 'class-transformer';
import { IsString, ValidateNested, IsOptional } from 'class-validator';
import { AddressInfo } from '@app/common/dto/address-info.dto';

export class UpdateUserProfile {
  @IsString()
  firstName: string;

  @IsString()
  @IsOptional()
  middleName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInfo)
  addressInfo: AddressInfo;
}
