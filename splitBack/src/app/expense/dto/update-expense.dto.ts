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

// PATCH parziale: un campo omesso resta com'e'. `groupPublicId` e
// `categoryPublicId` accettano anche `null`, che toglie il gruppo/la categoria.
// Nessun default su `participantPublicIds`: omesso significa "stessi
// partecipanti di prima", non "nessun partecipante".
export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  // Partecipanti singoli, oltre al creatore della spesa e ai membri del gruppo.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantPublicIds?: string[];

  @IsOptional()
  @IsString()
  paidByPublicId?: string;

  @IsOptional()
  @IsString()
  groupPublicId?: string | null;

  @IsOptional()
  @IsString()
  categoryPublicId?: string | null;

  // Divisione: array = quote diseguali (stesse regole della creazione), `null`
  // = torna alla divisione equa. Omessa = restano le quote attuali se importo e
  // contributori non cambiano, altrimenti si ridivide in parti uguali.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseShareDto)
  shares?: ExpenseShareDto[] | null;
}
