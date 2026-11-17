import { IsString, MaxLength } from 'class-validator';

// PATCH /api/user/me. Le regole sul nickname (lunghezza, caratteri) le applica
// UserService con nicknameError(), per rispondere con un codice per regola
// invece dei messaggi in inglese di class-validator.
export class UpdateMeDto {
  @IsString()
  // Le regole vere (5-20 caratteri) sono in nickname.ts, sul valore senza
  // spazi ai lati: questo ferma solo i testi enormi.
  @MaxLength(200)
  nickName!: string;
}
