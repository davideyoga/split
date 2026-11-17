import { IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_AMOUNT, MAX_PUBLIC_ID_LENGTH } from '../../limits';

// Quota di un contributore in una divisione diseguale. `share` puo' essere 0
// (partecipa alla spesa, e quindi la vede, ma non deve niente). Prima dei
// Settlement era anche il ripiego per registrare un rimborso; i rimborsi ora
// hanno il loro modulo (settlement/).
export class ExpenseShareDto {
  @IsString()
  @MaxLength(MAX_PUBLIC_ID_LENGTH)
  userPublicId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  share!: number;
}
