import * as fs from 'fs';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { ValidationException } from '@/notification/src/meta/validation.exception';
import { CurrentUser, Roles } from '@app/common';
import { Public } from '@app/common/decorators/public.decorator';
import { CreateVisit } from '@app/common/dto/create-visit.dto';
import { VisitUserResponse } from '@app/common/dto/visit-user-response.dto';
import { LoginResponse } from '../entities/login-response.entity';
import { User } from './dtos';
import { CreatePreschool } from './dtos/create-preschool.dto';
import { createTeacher } from './dtos/create-teacher-dto';
import { CreateUserInput } from './dtos/create-user-input.dto';
import { FamilyDetails } from './dtos/family-details';
import { UpdateUserDto } from './dtos/update-user-dto';
import { VisitMobileNoCheckRes } from './dtos/visit-mobile-number-check-res.dto';
import { UserType } from './enums/user-type.enum';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('createTeacher')
  @Roles(UserType.ADMIN, UserType.PRESCHOOL)
  createTeacher(@Body() input: createTeacher): Promise<User> {
    return this.userService.createTeacher(input);
  }

  /* for Role Guard */
  @Public()
  @Get('find-user-for-auth')
  findUserForAuth(@Query('userId') userId: string): Promise<User> {
    return this.userService.findOne(userId);
  }

  @Get('findTeachersByPreschool')
  @Roles(UserType.ADMIN, UserType.PRESCHOOL)
  findTeachersByPreschool(@Query('preschoolId') preschoolId: string): Promise<User[]> {
    return this.userService.findTeachersByPreschool(preschoolId);
  }

  @Get('find-by-id')
  @Roles(UserType.ADMIN)
  findById(@Query('id') id: string): Promise<User> {
    return this.userService.findOne(id);
  }

  @MessagePattern({ cmd: 'find-by-id' }, { async: true }) // ! need to check
  findByIdForTcp(@Payload() userId: string): Promise<User> {
    return this.userService.findOne(userId);
  }

  @Post('createUser') // ! need to check
  @Roles(UserType.ADMIN, UserType.PRESCHOOL)
  createUser(@Body() input: CreateUserInput, @CurrentUser('userId') userId: string): Promise<User> {
    return this.userService.createUser(input, userId);
  }

  // create a function parent-child relationship within an Excel
  @MessagePattern({ cmd: 'create-parent-child-by-excel' }, { async: true })
  createParentChildByExcel(@Payload() input: CreatePreschool): Promise<User> {
    return this.userService.createParentChildByExcel(input);
  }

  @Roles(UserType.ADMIN)
  @Post('createPreschoolAndClinic')
  createPreschoolAndClinic(@Body() input: CreatePreschool): Promise<User> {
    return this.userService.createPreschoolAndClinic(input);
  }

  @Post('get_users')
  @Roles(UserType.ADMIN)
  findUserByUserType(@Body('userType') userType: UserType[]): Promise<User[]> {
    return this.userService.findUserByUserType(userType);
  }

  // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Runs at 12:00 AM (midnight)
  // @Public()
  // @Get('users_data_sync')
  // dataMigrationForUsers(): Promise<boolean> {
  //   return this.userService.dataMigrationForUsers();
  // }

  @Get('get_all_doctor')
  @Roles(UserType.ADMIN, UserType.CLINIC)
  getDoctor(@Query('userType') userType: string): Promise<User[]> {
    return this.userService.getDoctors(userType);
  }

  @Get('get_doctor_detail')
  @Roles(UserType.ADMIN, UserType.CLINIC)
  getDoctorDetail(@Query('docId') docId: string): Promise<User[]> {
    return this.userService.getDoctorsDetail(docId);
  }

  @Post('get_child_hierarchy') // !
  @Roles(UserType.ADMIN, UserType.DOCTOR, UserType.PRESCHOOL, UserType.TEACHER, UserType.CLINIC)
  getChildHierarchy(
    @Body('childId') childId: string,
    @Body('usertype') usertype: UserType,
  ): Promise<User[]> {
    return this.userService.getChildUserHierarchy(childId, usertype);
  }

  @Get('get_user_child')
  @Roles(UserType.ADMIN, UserType.PRESCHOOL, UserType.PARENT)
  getChild(@Query('userId') userId: string): Promise<User[]> {
    return this.userService.findChild(userId);
  }

  @Get('visit-mobile-number-check')
  @Roles(UserType.ADMIN, UserType.PRESCHOOL, UserType.CLINIC)
  visitMobileNumberCheck(
    @Query('mobileNo') mobileNo: number,
    @CurrentUser('userId') userId: string,
  ): Promise<VisitMobileNoCheckRes> {
    return this.userService.visitMobileNumberCheck(mobileNo, userId);
  }

  @MessagePattern({ cmd: 'create-visit-user' }, { async: true })
  async createUserForVisit(@Payload() input: CreateVisit): Promise<VisitUserResponse> {
    const data = await this.userService.createUserForVisit(input);
    return data;
  }
  // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Runs at 12:00 AM (midnight)
  // @Public()
  // @Get('users_data_scheduler')
  // dataMigrationForUsersByTimestamp(): Promise<boolean> {
  //   return this.userService.dataMigrationForUsersByTimestamp();
  // }

  @Get('findMotherFatherByMobileNo')
  @Roles(UserType.ADMIN, UserType.PRESCHOOL, UserType.TEACHER)
  findMotherFatherByMobileNo(@Query('mobileNo') mobileNo: number): Promise<FamilyDetails> {
    return this.userService.fetchFamilyDetailsByParentMobileNumber(mobileNo);
  }

  @MessagePattern({ cmd: 'get-parents-by-child' }, { async: true })
  async getParentsByChilIdForTcp(@Payload() childId: string): Promise<User[]> {
    const parentDetails = await this.userService.getParentsByChilId(childId);
    return parentDetails;
  }

  @Get('get-parents-by-child')
  @Roles(UserType.ADMIN, UserType.PRESCHOOL)
  async getParentsByChilId(@Query() childId: string): Promise<User[]> {
    const parentDetails = await this.userService.getParentsByChilId(childId);
    return parentDetails;
  }

  // @Public()
  @Roles(UserType.ADMIN)
  @Post('ImportJsonToCreatePreschoolUser')
  @UseInterceptors(FileInterceptor('file')) // 'file' is the field name for the uploaded file
  async importExcelDataToCreatePreshcoolUser(
    @UploadedFile() file: Express.Multer.File,
    @Body('preschoolId') preschoolId: string,
  ): Promise<boolean> {
    if (preschoolId && file) {
      const filePath = file.path; // Access the path of the uploaded file
      const jsonResult = await this.userService.importExcelToCreateChildForPreshcool(
        filePath,
        preschoolId,
      );
      fs.unlinkSync(file.path);
      return jsonResult;
    }
    throw new ValidationException('Missing parameters', HttpStatus.FORBIDDEN);
  }

  @Public()
  @Get('get_clinic_details_auth')
  getClinicDetailsForAuth(
    @Query('clinicId') clinicId: string,
    @Query('docId') docId: string,
  ): Promise<User> {
    return this.userService.getClinicDetailsForAuth(clinicId, docId);
  }

  /*
    Update user profile and password
    request body:
    {
      user.firstName,
      user.lastName,
      userType
      password (optional)
    }
    response:
     return the updated user profile
  */
  @Post('update')
  @Roles(UserType.ADMIN, UserType.PRESCHOOL, UserType.TEACHER)
  async updateByUserId(@Body() updateUserDto: UpdateUserDto): Promise<LoginResponse> {
    const userDetails = await this.userService.updateByUserId(updateUserDto);
    // console.log(userId);
    return userDetails;
  }

  @MessagePattern({ cmd: 'get-user-by-mobile-no' }, { async: true })
  getUserByMobileNo(@Payload() mobileNo: number): Promise<User> {
    return this.userService.findUser(mobileNo);
  }

  @MessagePattern({ cmd: 'get-teacher-by-teacher-Id' }, { async: true })
  findTeacherById(@Payload() teacherId: string): Promise<User> {
    return this.userService.findTeacherById(teacherId);
  }
}
