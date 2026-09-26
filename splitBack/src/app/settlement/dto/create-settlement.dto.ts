import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// Rimborso: `fromPublicId` da' `amount` a `toPublicId`. Chi lo registra deve
// essere uno dei due.
export class CreateSettlementDto {
  @IsString()
  fromPublicId!: string;

  @IsString()
  toPublicId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  // Facoltativa (es. "contanti"): se vuota si salva null.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
