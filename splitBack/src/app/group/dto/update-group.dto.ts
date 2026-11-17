import { IsString, MaxLength } from 'class-validator';
import { MAX_GROUP_NAME_LENGTH } from '../../limits';

export class UpdateGroupDto {
  @IsString()
  @MaxLength(MAX_GROUP_NAME_LENGTH)
  name: string;
}
