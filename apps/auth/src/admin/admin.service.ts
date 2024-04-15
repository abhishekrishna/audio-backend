import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserService } from '../user/user.service';
import { AdminDocument } from './admin.schema';
import { Admin } from './entities/admin.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name)
    private childModel: Model<AdminDocument>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}
}
