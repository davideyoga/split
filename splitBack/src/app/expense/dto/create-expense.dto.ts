import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MAX_AMOUNT,
  MAX_PARTICIPANTS,
  MAX_PUBLIC_ID_LENGTH,
  MAX_SHARES,
  MAX_TEXT_LENGTH,
} from '../../limits';
import { ExpenseShareDto } from './expense-share.dto';

export class CreateExpenseDto {
  // Facoltativa: se omessa si salva '' (la colonna resta NOT NULL) e il
  // frontend mostra un testo di fallback.
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXT_LENGTH)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
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
  @ArrayMaxSize(MAX_PARTICIPANTS)
  @IsString({ each: true })
  @MaxLength(MAX_PUBLIC_ID_LENGTH, { each: true })
  participantPublicIds: string[] = [];

  // Chi ha effettivamente pagato. Se omesso e' il creatore della spesa.
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PUBLIC_ID_LENGTH)
  paidByPublicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_PUBLIC_ID_LENGTH)
  groupPublicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_PUBLIC_ID_LENGTH)
  categoryPublicId?: string;

  // Divisione diseguale: una quota per ogni contributore (creatore +
  // partecipanti + membri del gruppo, ne' uno di piu' ne' uno di meno), la cui
  // somma deve fare esattamente `amount`. Se omessa la divisione e' equa.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SHARES)
  @ValidateNested({ each: true })
  @Type(() => ExpenseShareDto)
  shares?: ExpenseShareDto[];
}
