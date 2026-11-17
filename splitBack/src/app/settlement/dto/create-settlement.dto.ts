import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_AMOUNT, MAX_PUBLIC_ID_LENGTH, MAX_TEXT_LENGTH } from '../../limits';

// Rimborso: `fromPublicId` da' `amount` a `toPublicId`. Chi lo registra deve
// essere uno dei due.
export class CreateSettlementDto {
  @IsString()
  @MaxLength(MAX_PUBLIC_ID_LENGTH)
  fromPublicId!: string;

  @IsString()
  @MaxLength(MAX_PUBLIC_ID_LENGTH)
  toPublicId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount!: number;

  // Facoltativa (es. "contanti"): se vuota si salva null.
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXT_LENGTH)
  note?: string;
}
