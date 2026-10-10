import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExpenseShareDto } from './expense-share.dto';

export class CreateExpenseDto {
  // Facoltativa: se omessa si salva '' (la colonna resta NOT NULL) e il
  // frontend mostra un testo di fallback.
  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  // Giorno della spesa ('YYYY-MM-DD'), scelto dall'utente. Se omesso vale il
  // giorno corrente del server (default del DB). La data di inserimento
  // (`createdDate`) non e' nel DTO: la imposta solo il DB.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  date?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantPublicIds: string[] = [];

  // Chi ha effettivamente pagato. Se omesso e' il creatore della spesa.
  @IsOptional()
  @IsString()
  paidByPublicId?: string;

  @IsOptional()
  @IsString()
  groupPublicId?: string;

  @IsOptional()
  @IsString()
  categoryPublicId?: string;

  // Divisione diseguale: una quota per ogni contributore (creatore +
  // partecipanti + membri del gruppo, ne' uno di piu' ne' uno di meno), la cui
  // somma deve fare esattamente `amount`. Se omessa la divisione e' equa.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseShareDto)
  shares?: ExpenseShareDto[];
}
