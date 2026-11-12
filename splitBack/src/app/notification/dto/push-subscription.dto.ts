import { Type } from 'class-transformer';
import { IsIn, IsString, MaxLength, ValidateNested } from 'class-validator';
import { MAX_ENDPOINT_LENGTH } from '../push/push-endpoint';

// Le chiavi di PushSubscription.toJSON(). Lunghezze e formato veri li
// controlla isValidWebPushKeys (push-endpoint.ts): qui solo un tetto.
export class PushKeysDto {
  @IsString()
  @MaxLength(200)
  p256dh!: string;

  @IsString()
  @MaxLength(100)
  auth!: string;
}

/**
 * Un browser che vuole le push (POST /api/notification/push/subscribe). E'
 * PushSubscription.toJSON() piu' la lingua dell'app su quel dispositivo, che
 * e' quella in cui arriveranno le push.
 */
export class PushSubscribeDto {
  @IsString()
  @MaxLength(MAX_ENDPOINT_LENGTH)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @IsIn(['it', 'en'])
  locale!: 'it' | 'en';
}

export class PushUnsubscribeDto {
  @IsString()
  @MaxLength(MAX_ENDPOINT_LENGTH)
  endpoint!: string;
}
