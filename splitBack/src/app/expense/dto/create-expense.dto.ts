import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
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
