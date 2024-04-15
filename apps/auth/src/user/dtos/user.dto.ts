// import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { Type } from 'class-transformer';
// import { IsArray, IsOptional, IsString, IsStrongPassword, ValidateNested } from 'class-validator';
// import { ChildrenDetails } from '@app/common/dto/childrens-details.dto';
// import { Status } from '@app/common/enums/status.enum';
// import { RegistrationDetails } from '../../child/dtos/registration-details.dto';
// import { UserType } from '../enums/user-type.enum';
// import { ClinicDetails } from './clinic-details.dto';
// import { DoctorDetails } from './doctor-details.dto';
// import { OtherInfo } from './other-info.dto';
// import { PreschoolDetails } from './preschool-details.dto';
// import { Profile } from './profile.dto';
// import { SqlData } from './sql-data';
// import { TeachersDetails } from './teachers-details.dto';

// @Schema({ timestamps: true })
// export class User {
//   @IsOptional()
//   _id: string;

//   @Prop()
//   @IsOptional()
//   @IsString()
//   userName: string;

//   @Prop({ type: Object })
//   @IsStrongPassword()
//   password: { [key: string]: string };

//   @Prop({ unique: true })
//   mobileNo: number;

//   @Prop()
//   email: string;

//   @Prop({ type: [String] })
//   @IsArray()
//   @IsString({ each: true })
//   userType: UserType[];

//   @Prop()
//   @ValidateNested()
//   @Type(() => Profile)
//   profile: Profile;

//   @Prop()
//   @ValidateNested()
//   @Type(() => OtherInfo)
//   otherInfo: OtherInfo;

//   @Prop()
//   @ValidateNested({ each: true })
//   @Type(() => DoctorDetails)
//   doctorDetails: DoctorDetails[];

//   @Prop()
//   @ValidateNested({ each: true })
//   @Type(() => ClinicDetails)
//   clinicDetails: ClinicDetails[];

//   @Prop()
//   @ValidateNested({ each: true })
//   @Type(() => ChildrenDetails)
//   childrenDetails: ChildrenDetails[];

//   @Prop()
//   @ValidateNested({ each: true })
//   @Type(() => TeachersDetails)
//   teachersDetails: TeachersDetails[];

//   @Prop()
//   @ValidateNested({ each: true })
//   @Type(() => PreschoolDetails)
//   preschoolDetails: PreschoolDetails[];

//   @Prop({ type: String })
//   status: Status;

//   @Prop()
//   @ValidateNested()
//   @Type(() => SqlData)
//   sqlData: SqlData;

//   @Prop({ default: new Date() })
//   createdAt: Date;

//   @Prop()
//   registrationDetails: RegistrationDetails;

//   updatedAt: Date;

//   @Prop()
//   otp: string;
// }

// export type UserDocument = User & Document;

// export const UserSchema = SchemaFactory.createForClass(User);
