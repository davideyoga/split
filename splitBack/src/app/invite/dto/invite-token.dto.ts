import { Matches } from 'class-validator';
import { INVITE_TOKEN_PATTERN } from '../invite-token';

// Il token viaggia nel body, mai nell'URL: niente log di accesso, niente Referer.
export class InviteTokenDto {
  @Matches(INVITE_TOKEN_PATTERN)
  token!: string;
}
