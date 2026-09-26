import { IsNumber, IsString, Min } from 'class-validator';

// Quota di un contributore in una divisione diseguale. `share` puo' essere 0
// (partecipa alla spesa, e quindi la vede, ma non deve niente): e' il modo di
// registrare un rimborso, "Pippo mi da' 15 EUR" = pagante Pippo, quota tutta mia.
export class ExpenseShareDto {
  @IsString()
  userPublicId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  share!: number;
}
