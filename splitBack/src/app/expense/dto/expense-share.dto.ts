import { IsNumber, IsString, Min } from 'class-validator';

// Quota di un contributore in una divisione diseguale. `share` puo' essere 0
// (partecipa alla spesa, e quindi la vede, ma non deve niente). Prima dei
// Settlement era anche il ripiego per registrare un rimborso; i rimborsi ora
// hanno il loro modulo (settlement/).
export class ExpenseShareDto {
  @IsString()
  userPublicId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  share!: number;
}
