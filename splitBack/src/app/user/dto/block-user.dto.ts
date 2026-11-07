import { IsUUID } from 'class-validator';

export class BlockUserDto {
  @IsUUID()
  publicId!: string;
}
