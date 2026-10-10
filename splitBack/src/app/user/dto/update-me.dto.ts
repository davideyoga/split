import { IsString } from 'class-validator';

// PATCH /api/user/me. Le regole sul nickname (lunghezza, caratteri) le applica
// UserService con nicknameError(), per rispondere con un codice per regola
// invece dei messaggi in inglese di class-validator.
export class UpdateMeDto {
  @IsString()
  nickName!: string;
}
