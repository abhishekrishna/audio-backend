import { SchemaFactory } from '@nestjs/mongoose';
import { Admin } from './entities/admin.entity';

export type AdminDocument = Admin & Document;

export const AdminSchema = SchemaFactory.createForClass(Admin);
