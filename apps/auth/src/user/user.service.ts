import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto-js';
import * as ExcelJS from 'exceljs';
import { startCase, toUpper } from 'lodash';
import { ObjectId } from 'mongodb';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { ProductType } from '@/wah-care-collection/src/common/enums/product-type.enum';
import { UtilityFunctionService } from '@/wah-care-collection/src/common/services/utility-function.service';
import { CenterType } from '@/wah-care-collection/src/master-product/enums/center-type.enum';
import { NOTIFICATIONS_SERVICE, WAH_CARE_COLLECTION } from '@app/common';
import { ChildrenDetails } from '@app/common/dto/childrens-details.dto';
import { CreateVisit } from '@app/common/dto/create-visit.dto';
import { VisitUserResponse } from '@app/common/dto/visit-user-response.dto';
import { Status } from '@app/common/enums/status.enum';
import { ChildService } from '../child/child.service';
import { Gender } from '../child/enums/gender.enum';
import { LoginResponse } from '../entities/login-response.entity';
import { ScreenMessage } from '../enums/screen-message.enum';
import { loggingEventType } from '../logging-events/enums/screen-message.enum';
import { LoggingEventService } from '../logging-events/logging-event.service';
import { User, UserDocument } from './dtos';
import { CreatePreschool } from './dtos/create-preschool.dto';
import { createTeacher } from './dtos/create-teacher-dto';
import { CreateUserInput } from './dtos/create-user-input.dto';
import { FamilyDetails } from './dtos/family-details';
import { PreschoolDetails } from './dtos/preschool-details.dto';
import { UpdateUserDto } from './dtos/update-user-dto';
import { VisitMobileNoCheckRes } from './dtos/visit-mobile-number-check-res.dto';
import { UserType } from './enums/user-type.enum';
import { VisitScreenType } from './enums/visit-screentype.enum';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => ChildService))
    private readonly childService: ChildService,
    private readonly configService: ConfigService,
    // private readonly sqlDatabaseService: SqlDatabaseService,
    private readonly loggingEventService: LoggingEventService,
    @Inject(NOTIFICATIONS_SERVICE) private readonly whatsappBotService: ClientProxy,
    @Inject(WAH_CARE_COLLECTION) private readonly wahCareCollectionService: ClientProxy,
    private readonly utilityFunctionService: UtilityFunctionService,
  ) {}

  async createTeacher(input: createTeacher): Promise<User> {
    const preschool = await this.userModel.findById(input.preschoolId);
    try {
      if (preschool) {
        const userTeacher = await this.userModel.findOne({ mobileNo: input.mobileNo });
        if (!userTeacher) {
          const newTeacher = await this.userModel.create({
            userType: input.userType,
            preschoolDetails: {
              preschoolId: preschool._id,
              preschoolName: preschool.profile.displayName,
            },
            profile: {
              firstName: input.firstName,
              middleName: input.middleName,
              lastName: input.lastName,
              birthDate: input.birthDate,
              aadharNo: input.aadharNo,
            },
            mobileNo: input.mobileNo,
          });
          await this.userModel.updateOne(
            { _id: input.preschoolId },
            {
              $addToSet: {
                teachersDetails: {
                  teacherId: newTeacher._id,
                  teacherName: newTeacher.profile.firstName,
                },
              },
            },
          );
          return newTeacher;
        }
        const updateTeacher = await this.userModel.findOneAndUpdate(
          { mobileNo: input.mobileNo },
          {
            $addToSet: {
              userType: input.userType,
              preschoolDetails: {
                preschoolId: preschool._id,
                preschoolName: preschool.profile.displayName,
              },
            },
            'profile.firstName': input.firstName,
            'profile.middleName': input.middleName,
            'profile.lastName': input.lastName,
            'profile.birthDate': input.birthDate,
            'profile.aadharNo': input.aadharNo,
          },
          { new: true },
        );
        // console.log(updateTeacher);
        // updating the teacher details if the teacher already exists and the data is updated
        await this.userModel.findOneAndUpdate(
          {
            'teachersDetails.teacherId': updateTeacher._id,
          },
          {
            $set: {
              'teachersDetails.$.teacherName': updateTeacher.profile.firstName,
            },
          },
          { upsert: true, new: true },
        );
        return updateTeacher;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === 11000 || error.code === 11001) {
        // MongoDB duplicate key error (E11000 or E11001)
        throw new HttpException('User with this mobile number already exists', HttpStatus.CONFLICT);
      }
      this.logger.error(error);
      throw new BadRequestException();
    }
  }

  async findTeachersByPreschool(preschoolId: string): Promise<User[]> {
    const getTeacher = await this.userModel.find({
      userType: { $in: [UserType.TEACHER] },
      'preschoolDetails.preschoolId': new ObjectId(preschoolId),
    });
    return getTeacher;
  }

  async createUser(input: CreateUserInput, userId?: string): Promise<User> {
    const user = await this.userModel.findOne({
      _id: userId,
      userType: { $in: [UserType.PRESCHOOL] },
    });
    try {
      if (user) {
        const userExist = await this.userModel.findOne({
          mobileNo: input.mobileNo,
          userType: { $in: [UserType.FATHER, UserType.MOTHER] },
        });
        if (userExist) {
          throw new HttpException('User Already Exist!', HttpStatus.CONFLICT);
        }
        const newUser = await this.userModel.create({
          ...input,
          ...(user?.userType.includes(UserType.TEACHER) && {
            registrationDetails: { id: user._id, registeredBy: UserType.TEACHER },
            // If UserType is set to TEACHER, we retrieve preschool details from the TEACHER.
            preschoolDetails: user.preschoolDetails,
          }),
          ...(user?.userType.includes(UserType.PRESCHOOL) && {
            registrationDetails: { id: user._id, registeredBy: UserType.PRESCHOOL },
            // If UserType is set to PRESCHOOL, we retrieve profile details from the PRESCHOOL.
            preschoolDetails: {
              preschoolId: user._id,
              preschoolName: user.profile.firstName,
            },
          }),
          ...(user?.userType.includes(UserType.DOCTOR) && {
            registrationDetails: { id: user._id, registeredBy: UserType.DOCTOR },
            // If UserType is set to DOCTOR, we retrieve clinicDetails details from the DOCTOR.
            clinicDetails: user.clinicDetails,
          }),
          ...(user?.userType.includes(UserType.CLINIC) && {
            registrationDetails: { id: user._id, registeredBy: UserType.CLINIC },
            // If UserType is set to CLINIC, we retrieve profile details from the CLINIC.
            clinicDetails: {
              clinicID: user._id,
              clinicName: user.profile.firstName,
            },
          }),
        });
        if (input.childDetails) {
          // creating and adding child in new created user
          await this.childService.createAndUpdateUserChild(input.childDetails, newUser._id);
        }

        this.whatsappBotService.emit('whatsapp-notify', {
          opt: 'DYNAMIC_TEMPLATE',
          mobileNumber: [`+91${input.mobileNo}`],
          template: {
            name: 'welcome_message',
            language: {
              code: 'en',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: user.profile.firstName,
                  },
                ],
              },
            ],
          },
        });
        return newUser;
      }
      throw new NotFoundException('User Not Found!');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === 11000 || error.code === 11001) {
        throw new HttpException('User with this mobile number already exists', HttpStatus.CONFLICT);
      }
      this.logger.error(error);
      throw new BadRequestException();
    }
  }

  // create a parent-child relationship within an Excel
  async createParentChildByExcel(input: CreatePreschool): Promise<User> {
    // get a parent detail an excel mobileNo and userType
    const userExist = await this.userModel.findOne({
      mobileNo: input['Parent WhatsApp number'],
      userType: { $in: [UserType.FATHER] },
    });
    // check a parent detail already register an condition
    if (userExist) {
      // update a parent first name
      await this.userModel.updateOne(
        { mobileNo: input['Parent WhatsApp number'] },
        {
          $set: {
            profile: {
              firstName: input['Parent Name'],
            },
          },
        },
      );
      // editing child record, using the parentId and input child name as route parameters
      await this.childService.createAndUpdateChildExcel(input['Child Name'], userExist._id);
      return userExist;
    }
    // creating parent records, using the excel mobileNo and parent name as route parameters
    const newUser = await this.userModel.create({
      mobileNo: input['Parent WhatsApp number'],
      clinicDetails: [],
      doctorDetails: [],
      preschoolDetails: [],
      profile: {
        firstName: input['Parent Name'],
      },
      status: Status.ACTIVE,
      teachersDetails: [],
      userType: UserType.FATHER,
    });
    if (newUser) {
      // creating and adding child in new created user
      await this.childService.createAndUpdateChildExcel(input['Child Name'], newUser._id);
    }
    // this.whatsappBotService.emit('whatsapp-notify', {
    //   opt: 'DYNAMIC_TEMPLATE',
    //   mobileNumber: [`+91${input.mobileNo}`],
    //   template: {
    //     name: 'welcome_message',
    //     language: {
    //       code: 'en',
    //     },
    //     components: [
    //       {
    //         type: 'body',
    //         parameters: [
    //           {
    //             type: 'text',
    //             text: user.profile.firstName,
    //           },
    //         ],
    //       },
    //     ],
    //   },
    // });

    return userExist;
  }

  async createUserForVisit(user: CreateVisit): Promise<VisitUserResponse> {
    let fatherData: User;
    let motherData: User;
    if (user?.fatherInfo) {
      // Checks if the father exists.
      const Data = await this.userModel.findOne({
        mobileNo: user.fatherInfo.mobileNo,
        userType: UserType.FATHER,
      });
      if (Data) {
        fatherData = Data;
      }
      if (!Data) {
        // Creates a new father if it does not exist.
        const father = await this.userModel.findOneAndUpdate(
          {
            mobileNo: user?.fatherInfo?.mobileNo,
          },
          {
            $set: {
              status: Status.ACTIVE,
              profile: {
                firstName: startCase(user?.fatherInfo?.firstName),
                lastName: startCase(user?.lastName),
                addressInfo: user?.addressInfo,
              },
              // // Adds the address info if available.
              // ...(user?.addressInfo && {
              //   'profile.addressInfo': user?.addressInfo,
              // }),
            },

            $addToSet: {
              userType: UserType.FATHER,
            },
          },
          {
            upsert: true,
            new: true,
          },
        );
        fatherData = father;
      } else {
        await this.userModel.updateOne(
          { mobileNo: user?.fatherInfo?.mobileNo },
          {
            $set: {
              'profile.firstName': startCase(user?.fatherInfo?.firstName),
              'profile.lastName': startCase(user?.lastName),
              'profile.addressInfo': user?.addressInfo,
            },
          },
          { upsert: true, new: true },
        );
      }
    }

    if (user?.motherInfo) {
      // Checks if the mother exists.
      const Data = await this.userModel.findOne({
        mobileNo: user?.motherInfo?.mobileNo,
        userType: UserType.MOTHER,
      });
      if (Data) {
        motherData = Data;
      }
      if (!Data) {
        // Creates a new mother if it does not exist.
        const mother = await this.userModel.findOneAndUpdate(
          {
            mobileNo: user?.motherInfo?.mobileNo,
          },
          {
            $set: {
              status: Status.ACTIVE,
              profile: {
                firstName: startCase(user?.motherInfo?.firstName),
                lastName: startCase(user?.lastName),
                addressInfo: user?.addressInfo,
              },
              //   // Adds the address info if available.
              //   ...(user?.addressInfo && {
              //     'profile.addressInfo': user?.addressInfo,
              //   }),
            },
            $addToSet: {
              userType: UserType.MOTHER,
            },
          },
          {
            upsert: true,
            new: true,
          },
        );
        motherData = mother;
      } else {
        await this.userModel.updateOne(
          { mobileNo: user?.motherInfo?.mobileNo },
          {
            $set: {
              profile: {
                firstName: startCase(user?.motherInfo?.firstName),
                lastName: startCase(user?.lastName),
                addressInfo: user?.addressInfo,
              },
            },
          },
          { upsert: true, new: true },
        );
      }
    }

    let childID: string;
    if (fatherData || motherData) {
      // Checks if the child exists in the father's list.
      const isExistCHildName = fatherData.childrenDetails.find(
        (val) => val.childName === startCase(user.childName),
      );
      if (isExistCHildName) {
        childID = isExistCHildName.childID;
      }
      // Creates a new child if it does not exist in the father's list.
      if (!isExistCHildName) {
        childID = await this.childService.createChildForVisit(user, fatherData, motherData);
      } else {
        childID = await this.childService.updateChildForVisit(user, childID);
      }
    }

    return { fatherID: fatherData?._id, motherID: motherData?._id, childID };
  }

  /*
    updates/creates the user password and returns the updated user object
  */
  async updateUserPassword(password: number, mobileNo: number, userType: string): Promise<User> {
    try {
      const hashedPassword = await new Promise<string>((resolve, reject) => {
        bcrypt.hash(String(password), 10, (err, hash) => {
          if (err) {
            reject(err);
          } else {
            resolve(hash);
          }
        });
      });

      return await this.userModel.findOneAndUpdate(
        { mobileNo },
        {
          $set: {
            [`password.${userType}`]: hashedPassword,
          },
        },
        { upsert: true, new: true },
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === 11000 || error.code === 11001) {
        this.logger.error(error.message);
        throw new HttpException('User with this mobile number already exists', HttpStatus.CONFLICT);
      }
      this.logger.error(error);
      throw new BadRequestException();
    }
  }

  // async dataMigrationForUsers(): Promise<boolean> {
  //   // Adding all details of Doctors, Clinic And Hospital
  //   const clinicDoctorData = await this.sqlDatabaseService.query('SELECT * FROM mxa_users_doctor');
  //   await Promise.all(
  //     (clinicDoctorData || []).map(async (row) => {
  //       const doctorInstance = await this.userModel.updateOne(
  //         { 'sqlData.uid': row.uid, mobileNo: row.mobileno },
  //         {
  //           $set: {
  //             ...row,
  //             userName: row.username,
  //             mobileNo: row.mobileno,
  //             ...(row.userlevels === 2 && {
  //               userType: UserType.DOCTOR,
  //             }),
  //             ...(row.userlevels === 3 && {
  //               userType: UserType.CLINIC,
  //             }),
  //             'otherInfo.smsReportStatus': row?.smsreportstatus,
  //             'otherInfo.smsPQStatus': row?.smspqstatus,
  //             'otherInfo.hccId': row?.hccID,
  //             'profile.firstName': row?.firstname,
  //             'profile.middleName': row?.middlename,
  //             'profile.lastName': row?.lastname,
  //             'profile.displayName': row?.displayname,
  //             'profile.birthDate': row?.dob,
  //             'profile.addressInfo.address': row?.address,
  //             'profile.addressInfo.state': row?.state,
  //             'profile.addressInfo.area': row?.area,
  //             'profile.addressInfo.city': row?.city,
  //             'profile.addressInfo.pincode': row?.pincode,
  //             status: row?.active === 1 ? Status.ACTIVE : Status.INACTIVE,
  //             createdAt: row?.created,
  //             updatedAt: row?.updatedate,
  //             'sqlData.uid': row?.uid,
  //             'sqlData.userLevel': row?.userlevels,
  //           },
  //         },

  //         { new: true, upsert: true },
  //       );
  //       return doctorInstance;
  //     }),
  //   );
  //   // Adding childrens who belong to a particular doctor and clinic.
  //   const childDoctorData = await this.sqlDatabaseService.query(
  //     'SELECT mxa_doctor_queues.patientID AS childId, mxa_users_doctor.* FROM mxa_users_doctor inner join mxa_doctor_queues on mxa_doctor_queues.doctorID =  mxa_users_doctor.uid OR mxa_doctor_queues.clinicID = mxa_users_doctor.uid',
  //   );

  //   await Promise.all(
  //     (childDoctorData || []).map(async (row) => {
  //       const userData = await this.userModel.findOne({
  //         mobileNo: row.mobileno,
  //         'sqlData.uid': row.uid,
  //       });
  //       if (userData) {
  //         await this.childService.updateDetailsInfo(row.childId, userData, userData.userType);
  //       }
  //     }),
  //   );

  //   // adds clinic details
  //   const doctorRows = await this.sqlDatabaseService.query(
  //     'SELECT * FROM mxa_users_doctor where userlevels = 2',
  //   );
  //   await Promise.all(
  //     (doctorRows || []).map(async (row) => {
  //       let doctorData: User;

  //       if (row.userlevels === 2) {
  //         doctorData = await this.findSchoolData(row.hccID, row.userlevels);
  //       }
  //       const doctorInstance = await this.userModel.updateOne(
  //         {
  //           'sqlData.uid': row?.uid,
  //           'sqlData.userLevel': row?.userlevels,
  //           mobileNo: row?.mobileno,
  //         },
  //         {
  //           $set: {
  //             ...row,
  //           },
  //           $addToSet: {
  //             clinicDetails: {
  //               clinicId: doctorData?._id,
  //               clinicName: doctorData?.profile?.firstName,
  //             },
  //           },
  //         },

  //         { new: true, upsert: true },
  //       );
  //       return doctorInstance;
  //     }),
  //   );

  //   // Adding PreSchool data
  //   const preSchoolRows = await this.sqlDatabaseService.query(
  //     'SELECT mxa_users_preschool.* FROM mxa_users_preschool',
  //   );
  //   await Promise.all(
  //     (preSchoolRows || []).map(async (row) => {
  //       const preSchoolInstance = await this.userModel.updateOne(
  //         { 'sqlData.uid': row?.uid, mobileNo: row?.mobileno },
  //         {
  //           $set: {
  //             ...row,
  //             userName: row?.username,
  //             mobileNo: row?.mobileno,
  //             ...(row?.userlevels === 5 && {
  //               userType: UserType.PRINCIPAL,
  //             }),
  //             ...(row?.userlevels === 4 && {
  //               userType: UserType.PRESCHOOL,
  //             }),
  //             ...(row?.userlevels === 6 && {
  //               userType: UserType.TEACHER,
  //             }),
  //             'otherInfo.smsReportStatus': row?.smsreportstatus,
  //             'otherInfo.smsPQStatus': row?.smspqstatus,
  //             'otherInfo.hccId': row?.hccID,
  //             'profile.firstName': row?.firstname,
  //             'profile.middleName': row?.middlename,
  //             'profile.lastName': row?.lastname,
  //             'profile.displayName': row?.displayname,
  //             'profile.birthDate': row?.dob,
  //             'profile.addressInfo.address': row?.address,
  //             'profile.addressInfo.state': row?.state,
  //             'profile.addressInfo.area': row?.area,
  //             'profile.addressInfo.city': row?.city,
  //             'profile.addressInfo.pincode': row?.pincode,
  //             status: row?.active === 1 ? Status.ACTIVE : Status.INACTIVE,
  //             createdAt: row?.created,
  //             updatedAt: row?.updatedate,
  //             'sqlData.uid': row?.uid,
  //             'sqlData.userLevel': row?.userlevels,
  //           },
  //         },

  //         { new: true, upsert: true },
  //       );
  //       return preSchoolInstance;
  //     }),
  //   );
  //   // Inside preschool data, adds the children who belong.
  //   const childPreSchoolRows = await this.sqlDatabaseService.query(
  //     'SELECT mxa_student_queues.studentID AS childId, mxa_users_preschool.* FROM mxa_users_preschool inner join mxa_student_queues on mxa_student_queues.schoolID =  mxa_users_preschool.uid OR mxa_student_queues.teacherID = mxa_users_preschool.uid',
  //   );

  //   await Promise.all(
  //     (childPreSchoolRows || []).map(async (row) => {
  //       const userData = await this.userModel.findOne({
  //         'sqlData.uid': row?.uid,
  //         mobileNo: row?.mobileno,
  //       });
  //       await this.childService.updateDetailsInfo(row.childId, userData, userData.userType);
  //     }),
  //   );

  //   // Adds schools details
  //   const principalRows = await this.sqlDatabaseService.query(
  //     'SELECT * FROM mxa_users_preschool where userlevels = 5 OR userlevels = 6',
  //   );
  //   await Promise.all(
  //     (principalRows || []).map(async (row) => {
  //       let schoolData: User;
  //       if (row?.userlevels === 5) {
  //         schoolData = await this.findSchoolData(row?.uid, row?.userlevels);
  //       }
  //       if (row?.userlevels === 6) {
  //         schoolData = await this.findSchoolData(row?.hccID, row?.userlevels);
  //       }
  //       const parentsInstance = await this.userModel.updateOne(
  //         { 'sqlData.uid': row?.uid, mobileNo: row?.mobileno },
  //         {
  //           $set: {
  //             ...row,
  //           },
  //           $addToSet: {
  //             preschoolDetails: {
  //               preschoolId: schoolData?._id,
  //               preschoolName: schoolData?.profile?.firstName,
  //             },
  //           },
  //         },

  //         { new: true, upsert: true },
  //       );
  //       return parentsInstance;
  //     }),
  //   );

  //   // Adding parents data based on USERTYPE (FATHER, MOTHER).
  //   const parentsRow = await this.sqlDatabaseService.query(
  //     'Select mxa_users_child.uid AS childId, mxa_users_child.displayname AS childName, mxa_users_parents.*  from  mxa_users_child inner join mxa_users_parents on mxa_users_parents.uid = mxa_users_child.fatherID OR mxa_users_parents.uid = mxa_users_child.motherID',
  //   );
  //   await Promise.all(
  //     (parentsRow || []).map(async (row) => {
  //       const childID = await this.childService.findOne(row?.childId);
  //       const parentsInstance = await this.userModel.updateOne(
  //         { 'sqlData.uid': row?.uid, mobileNo: row?.mobileno },
  //         {
  //           $set: {
  //             ...row,
  //             userName: row?.username,
  //             mobileNo: row?.mobileno,
  //             userType: row?.userlevels === 7 ? UserType.FATHER : UserType.MOTHER,
  //             'otherInfo.smsReportStatus': row?.smsreportstatus,
  //             'otherInfo.smsPQStatus': row?.smspqstatus,
  //             'profile.firstName': row?.firstname,
  //             'profile.middleName': row?.middlename,
  //             'profile.lastName': row?.lastname,
  //             'profile.displayName': row?.displayname,
  //             'profile.addressInfo.address': row?.address,
  //             'profile.addressInfo.state': row?.state,
  //             'profile.addressInfo.area': row?.area,
  //             'profile.addressInfo.city': row?.city,
  //             'profile.addressInfo.pincode': row?.pincode,
  //             status: row?.active === 1 ? Status.ACTIVE : Status.INACTIVE,
  //             createdAt: row?.created,
  //             updatedAt: row?.updatedate,
  //             'sqlData.uid': row?.uid,
  //             'sqlData.userLevel': row?.userlevels,
  //           },
  //           $addToSet: {
  //             childrenDetails: {
  //               childID: childID._id,
  //               childName: childID.firstName || null,
  //               dob: childID.dob || null,
  //             },
  //           },
  //         },
  //         { new: true, upsert: true },
  //       );
  //       return parentsInstance;
  //     }),
  //   );
  //   // update children collection with parents object id

  //   // fathher and mother data from MongoDB
  //   const parentsInfo = await this.userModel.find({
  //     userType: { $in: [UserType.MOTHER, UserType.FATHER] },
  //   });
  //   await Promise.all(
  //     (parentsInfo || []).map(async (row) => {
  //       await this.childService.updateChildParentsInfo(row, row?.userType);
  //     }),
  //   );

  //   return true;
  // }

  async getUser(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async updateAccessToken(
    _id: string,
    accessToken: string,
    userType: UserType,
    type: loggingEventType,
  ): Promise<void> {
    await this.loggingEventService.create(_id, userType, accessToken, type);
  }

  async logout(_id: string): Promise<unknown> {
    await this.userModel.findOneAndUpdate(
      {
        _id,
        refreshToken: { $ne: null },
      },
      { $set: { refreshToken: null } },
      { new: true },
    );
    return { loggedOut: true };
  }

  async findUser(mobileNo?: number, userType?: UserType, otp?: number): Promise<User> {
    interface IFilter {
      mobileNo?: number;
      userType?: unknown;
      otp?: number;
    }
    const query: IFilter = {};
    if (mobileNo) {
      query.mobileNo = mobileNo;
    }
    if (otp) {
      query.otp = otp;
    }
    if (userType && userType !== UserType.PARENT) {
      query.userType = userType;
    }
    if (userType === UserType.PARENT) {
      query.userType = { $in: [UserType.MOTHER, UserType.FATHER] };
    }
    return this.userModel.findOne(query);
  }

  async findOne(_id: string): Promise<User> {
    const user = await this.userModel.findById(_id).exec();
    return user;
  }

  async findSchoolData(uid: string, userlevels: number): Promise<User> {
    if (userlevels === 5) {
      const schoolData = await this.userModel.findOne({
        'otherInfo.hccId': uid,
      });
      return schoolData;
    }
    if (userlevels === 6 || userlevels === 2) {
      const schoolData = await this.userModel.findOne({
        'sqlData.uid': uid,
      });
      return schoolData;
    }
    return null;
  }

  async assignOtpToUser(mobileNo: number, generateOtp?: number): Promise<boolean> {
    let encryptedOtp = null;
    if (generateOtp) {
      const otpObject = {
        otp: generateOtp,
        dateNow: Math.floor(Date.now() / 1000).toString(),
      };

      encryptedOtp = crypto.AES.encrypt(
        JSON.stringify(otpObject),
        this.configService.get('OTP_SECRET_KEY'),
      ).toString();
    }

    await this.userModel.findOneAndUpdate(
      { mobileNo },
      {
        otp: encryptedOtp || '',
      },
      { upsert: true },
    );
    return true;
  }

  getDoctors(userType: string): Promise<User[]> {
    const docList = this.userModel.find({ userType });
    return docList;
  }

  getDoctorsDetail(docId: string): Promise<User[]> {
    const docDetail = this.userModel.find({ _id: docId });
    return docDetail;
  }

  getClinicDetailsForAuth(clinicId: string, docId: string): Promise<User> {
    const docDetail = this.userModel.findOne({ _id: clinicId, 'doctorDetails.doctorID': docId });
    return docDetail;
  }

  async getChildUserHierarchy(childId: string, usertype: UserType): Promise<User[]> {
    const getChild = await this.childService.findChildDetails(childId);
    let ids;
    if (usertype === UserType.DOCTOR) {
      const getInfo = getChild.doctorInfo;
      ids = getInfo.map((val) => val.id);
    }
    if (usertype === UserType.PRESCHOOL) {
      const getInfo = getChild.preSchoolInfo;
      ids = getInfo.map((val) => val.id);
    }
    if (usertype === UserType.TEACHER) {
      const getInfo = getChild.teacherInfo;
      ids = getInfo.map((val) => val.id);
    }
    if (usertype === UserType.CLINIC) {
      const getInfo = getChild.clinicInfo;
      ids = getInfo.map((val) => val.id);
    }

    const multiDocDetail = await this.userModel.find({ _id: { $in: ids } });
    return multiDocDetail;
  }

  async findChild(userId: string): Promise<User[]> {
    const getChild = await this.userModel.find({ _id: userId });
    return getChild;
  }

  async createPreschoolAndClinic(input: CreatePreschool): Promise<User> {
    if (input.userType !== UserType.PRESCHOOL && input.userType !== UserType.CLINIC) {
      throw new HttpException('only Preschool and Clinic user can create', HttpStatus.BAD_REQUEST);
    }
    try {
      await this.userModel.updateOne(
        { mobileNo: input.mobileNo },
        {
          $set: {
            email: input.email,
            profile: {
              displayName: input.userName,
              firstName: input.firstName,
              lastName: input.lastName,
              aadharNo: input?.aadharNo,
              panCard: input?.panCard,
              ...(input?.addressInfo && { addressInfo: input?.addressInfo }),
            },
          },
          $addToSet: {
            userType: input.userType,
          },
        },
        {
          upsert: true,
          new: true,
        },
      );
      const findPreschoolAndClinic = await this.userModel.findOne({ mobileNo: input.mobileNo });
      if (findPreschoolAndClinic) {
        this.whatsappBotService.emit('whatsapp-notify', {
          opt: 'DYNAMIC_TEMPLATE',
          mobileNumber: [`+91${input.mobileNo}`],
          // mobileNumber: [`+919898757894`],
          template: {
            name: 'preschool_registration_success_message',
            language: {
              code: 'en',
            },
          },
        });
        return findPreschoolAndClinic;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === 11000 || error.code === 11001) {
        this.logger.error(error.message);
        throw new HttpException('User with this mobile number already exists', HttpStatus.CONFLICT);
      }
      this.logger.error(error);
      throw new BadRequestException();
    }
  }

  async findUserByUserType(userType: UserType[]): Promise<User[]> {
    return this.userModel.find({ userType: { $in: userType } });
  }

  // create and editing child details an user module
  async updateChild(_id: string, childID: string, childName: string, dob: string): Promise<void> {
    await this.userModel.updateOne(
      { _id },
      {
        $addToSet: {
          childrenDetails: {
            childID,
            childName,
            dob,
          },
        },
      },
      { new: true, upsert: true },
    );
  }

  async visitMobileNumberCheck(mobileNo: number, userId: string): Promise<VisitMobileNoCheckRes> {
    const user = await this.userModel.findById(userId);
    // only PRESCHOOL and CLINIC can create visit
    if (user.userType.includes(UserType.PRESCHOOL) || user.userType.includes(UserType.CLINIC)) {
      const mobileNoUser = await this.userModel.findOne({ mobileNo });
      if (mobileNoUser) {
        const requiredRoles = [
          UserType.FATHER,
          UserType.MOTHER,
          UserType.TEACHER,
          UserType.DOCTOR,
          UserType.PRINCIPAL,
        ]; // taking as human
        const areRolesPresent = requiredRoles.some((role) => mobileNoUser.userType.includes(role));
        if (areRolesPresent) {
          return {
            user: mobileNoUser,
            screenType: VisitScreenType.EXIST_USER,
            message: 'User Already Exists',
          };
        }
        if (!areRolesPresent) {
          // CLINIC, PRESCHOOL AVAILABLE
          throw new HttpException('PRESCHOOL AND CLINIC CANNOT BE USERS', HttpStatus.BAD_REQUEST);
        }
      } else {
        return {
          screenType: VisitScreenType.NEW_USER,
          message: 'You Can Create a Visit',
        };
      }
    }
    return { message: 'Only PRESCHOOL And CLINIC Can Create Visit!' };
  }

  async fetchFamilyDetailsByParentMobileNumber(mobileNo: number): Promise<FamilyDetails> {
    const parentBuffer = await this.userModel.findOne({
      mobileNo,
      userType: { $in: [UserType.MOTHER, UserType.FATHER] },
    });
    const familyDetails: FamilyDetails = new FamilyDetails();
    const childrenData = [];
    const motherData = { firstName: null, mobileNo: null };
    const fatherData = { firstName: null, mobileNo: null };
    if (parentBuffer != null && parentBuffer.childrenDetails != null) {
      await Promise.all(
        parentBuffer.childrenDetails.map(async (child) => {
          const childData: ChildrenDetails = child;
          const temp = await this.childService.findChildDetails(child.childID);
          childData.gender = temp.gender;
          if (fatherData.mobileNo === null && temp.fatherInfo.parentId) {
            const fatherDetails = await this.userModel.findById(temp.fatherInfo.parentId);
            fatherData.firstName = fatherDetails.profile?.firstName;
            familyDetails.lastName = fatherDetails.profile?.lastName;
            fatherData.mobileNo = fatherDetails.mobileNo;
          }
          if (motherData.mobileNo === null && temp.motherInfo.parentId) {
            const motherDetails = await this.userModel.findById(temp.motherInfo.parentId);
            motherData.firstName = motherDetails.profile?.firstName;
            familyDetails.lastName = motherDetails.profile?.lastName;
            motherData.mobileNo = motherDetails.mobileNo;
          }
          childrenData.push(childData);
        }),
      );
      familyDetails.fatherName = fatherData.firstName;
      familyDetails.fatherNumber = fatherData.mobileNo;
      familyDetails.motherName = motherData.firstName;
      familyDetails.motherNumber = motherData.mobileNo;
      familyDetails.childrenDetails = childrenData;
      if (parentBuffer.profile?.addressInfo)
        familyDetails.address = parentBuffer.profile.addressInfo;
    }
    return familyDetails;
  }

  async getParentsByChilId(childId: string): Promise<User[]> {
    const parentDetails = await this.userModel.find({
      'childrenDetails.childID': new ObjectId(childId),
      userType: { $in: [UserType.FATHER, UserType.MOTHER] },
    });
    return parentDetails;
  }

  // extracting first name and last name, eg."Mr.Hitesh Jain"
  extractName(text: string): string[] {
    return text?.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/);
  }

  // Importing an Excel file to generate visits, bill collections, and active user collections for children, and also to create/update children with new/existing parent users.
  async importExcelToCreateChildForPreshcool(
    filePath: string,
    preschoolId: string,
  ): Promise<boolean> {
    // Finding the preschool by its ID
    const preschool = await this.userModel.findById(preschoolId);
    if (!preschool) {
      throw new NotFoundException('The provided preschool ID is not valid');
    }
    // Reading the JSON file using ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(4); // Assuming you're reading the first sheet.
    const excelDatas = [];
    const headerRow = {}; // Declare headerRow at a higher scope.
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || rowNumber === 2) {
        // Concatenate the values from both rows to form the complete header name.
        row.eachCell((cell, colNumber) => {
          // Use the cell value as the header name (you can trim or normalize the name if needed).
          const headerValue = cell.value;
          headerRow[`Column${colNumber}`] = headerValue;
        });
        // Log the actual column names (if needed).
      } else {
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          // Use the actual header names as keys.
          const headerName = headerRow[`Column${colNumber}`];
          rowData[`${headerName}`] = cell.value;
        });
        excelDatas.push(rowData);
      }
    });
    for await (const data of excelDatas) {
      const motherName = this.extractName(data['Mother Name']);
      const fatherName = this.extractName(data['Father Name']);

      let father;
      if (data['Father Mobile Number']) {
        // Checking if the father already exists in the database
        const isFatherExist = await this.userModel.findOne({
          mobileNo: data['Father Mobile Number'],
        });
        if (isFatherExist) {
          // If the father exists, update the userType
          await this.userModel.updateOne(
            {
              mobileNo: data['Father Mobile Number'],
            },
            {
              $addToSet: {
                userType: UserType.FATHER,
              },
            },
          );
          father = isFatherExist;
        }
        if (!isFatherExist) {
          // If the father does not exist, create a new user
          father = await this.userModel.create({
            mobileNo: data['Father Mobile Number'],
            'profile.firstName': startCase(fatherName[1]) || null,
            'profile.lastName': startCase(fatherName[2]) || null,
            'profile.addressInfo.address': data['Line 1'] || null,
            'profile.addressInfo.area': data?.Area || null,
            'profile.addressInfo.city': data?.City || null,
            'profile.addressInfo.state': data?.State || null,
            'profile.addressInfo.pincode': data?.pincode || null,
            userType: UserType.FATHER,
          });
        }
      }
      let mother;
      // Getting mother's details if available
      if (data['Mother Mobile Number']) {
        const isMotherExist = await this.userModel.findOne({
          mobileNo: data['Mother Mobile Number'],
        });

        if (isMotherExist) {
          // If the mother exists, update the userType
          await this.userModel.updateOne(
            {
              mobileNo: data['Mother Mobile Number'],
            },
            {
              $addToSet: {
                userType: UserType.MOTHER,
              },
            },
          );
          mother = isMotherExist;
        }
        if (!isMotherExist) {
          // If the mother does not exist, create a new user
          mother = await this.userModel.create({
            mobileNo: data['Mother Mobile Number'],
            'profile.firstName': startCase(motherName[1]) || null,
            'profile.lastName': startCase(motherName[2]) || null,
            'profile.addressInfo.address': data['Line 1'] || null,
            'profile.addressInfo.area': data?.Area || null,
            'profile.addressInfo.city': data?.City || null,
            'profile.addressInfo.state': data?.State || null,
            'profile.addressInfo.pincode': data?.pincode || null,
            userType: UserType.MOTHER,
          });
        }
      }

      const userId = [];
      const mobileNo = [];

      if (father) {
        userId.push(father?._id);
        mobileNo.push(father?.mobileNo); // Adding father's ID and mobileNo to arrays
      }
      if (mother) {
        userId.push(mother?._id);
        mobileNo.push(mother?.mobileNo); // Adding mother's ID and mobileNo to arrays
      }
      // searching childName in father's childrenDetails
      const isExistCHildName = father?.childrenDetails?.find(
        (item) => item.childName === startCase(data['First Name']),
      );

      // Creates a new child if it does not exist in the father's list.
      if (!isExistCHildName) {
        const childId = await this.childService.createChildForVisit(
          {
            childName: startCase(data['First Name']),
            gender: toUpper(data['Child Gender']) as Gender,
            dob: this.utilityFunctionService.getDateInStringFormat(data?.Dob),
          },
          father,
          mother,
          {
            id: preschoolId,
            preschoolName: preschool?.profile?.displayName,
          },
        );

        // Getting teachers details
        const teacher = await this.findUser(data['Teacher Responsible']);
        // creating visit
        const visit = await firstValueFrom(
          this.wahCareCollectionService.send(
            { cmd: 'preschool-create-visit' },
            {
              userId,
              mobileNo,
              childId,
              preschoolId: preschool?._id,
            },
          ),
        );

        // Getting product
        const product = await firstValueFrom(
          this.wahCareCollectionService.send(
            { cmd: 'get-product' },
            { serviceName: data['Child - Standard'], preschoolId },
          ),
        );

        // generating bill
        await firstValueFrom(
          this.wahCareCollectionService.send(
            { cmd: 'preschool-create-bill' },
            {
              childID: childId,
              serviceId: product._id,
              centerId: preschoolId,
              visitId: visit?._id,
              centerType: CenterType.PRESCHOOL,
              division: `${`${data['Child - Standard']} ${data['Child - Division']}`}` || null,
              teacherId: teacher?._id || null,
              startDate: this.utilityFunctionService.getDateInStringFormat(data['Start Date']),
            },
          ),
        );
      }
    }
    return true;
  }

  async updateByUserId(updateUserDto: UpdateUserDto): Promise<LoginResponse> {
    const usersDetails = await this.userModel.findOne({
      mobileNo: updateUserDto.mobileNo,
      userType: updateUserDto.userType,
    });
    if (!usersDetails) {
      throw new NotFoundException('User does not exist');
    }
    if (updateUserDto.password) {
      await this.updateUserPassword(
        updateUserDto.password,
        updateUserDto.mobileNo,
        updateUserDto.userType,
      );
    }
    const IQuery = {
      mobileNo: updateUserDto.mobileNo,
      'profile.firstName': updateUserDto.profile.firstName,
      'profile.middleName': updateUserDto.profile.middleName,
      'profile.lastName': updateUserDto.profile.lastName,
    };
    if (updateUserDto.profile.middleName) {
      IQuery['profile.middleName'] = updateUserDto.profile.middleName;
    }
    if (updateUserDto.profile.addressInfo) {
      IQuery['profile.addressInfo.address'] = updateUserDto.profile.addressInfo.address;
      IQuery['profile.addressInfo.area'] = updateUserDto.profile.addressInfo.area;
      IQuery['profile.addressInfo.city'] = updateUserDto.profile.addressInfo.city;
      IQuery['profile.addressInfo.pincode'] = updateUserDto.profile.addressInfo.pincode;
    }
    const user = await this.userModel.findOneAndUpdate(
      { mobileNo: updateUserDto.mobileNo },
      IQuery,
      {
        new: true,
      },
    );
    let prductType: ProductType[] = [];
    if (
      user.userType.includes(UserType.PRESCHOOL) &&
      updateUserDto.userType === UserType.PRESCHOOL
    ) {
      prductType = await firstValueFrom(
        this.wahCareCollectionService.send('listPruductTypes', { preschoolId: user._id }),
      );
    } else if (
      user.userType.includes(UserType.TEACHER) &&
      updateUserDto.userType === UserType.TEACHER
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
      user,
      message: ScreenMessage.UPDATE_PROFILE_SUCCESSFUL,
      prductType: [...productType.values()],
    };
  }

  async findUserById(userId: string): Promise<User> {
    const userData = await this.userModel.findById(new ObjectId(userId));
    if (!userData) return null;
    return userData;
  }

  async findTeacherById(teacherId: string): Promise<User> {
    const teacherData = await this.userModel.findById(new ObjectId(teacherId), 'profile');
    if (!teacherData) return null;
    return teacherData;
  }
}
