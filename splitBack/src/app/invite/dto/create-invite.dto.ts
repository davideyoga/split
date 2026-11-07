import { IsIn } from 'class-validator';
import { INVITE_EXPIRY_DAYS, type InviteExpiryDays } from '../invite-token';

export class CreateInviteDto {
  @IsIn(INVITE_EXPIRY_DAYS)
  expiresInDays!: InviteExpiryDays;
}
