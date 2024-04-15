import { Gender } from '../enums/gender.enum';
import { Track } from './track.entity';

export class Admin {
  id: string;

  displayName?: string;

  dob: string;

  gender: Gender;

  tracks: [Track];
}
