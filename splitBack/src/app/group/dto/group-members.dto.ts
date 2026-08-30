import { IsArray, IsString } from 'class-validator';

export class GroupMembersDto {
  @IsArray()
  @IsString({ each: true })
  memberPublicIds: string[];
}
