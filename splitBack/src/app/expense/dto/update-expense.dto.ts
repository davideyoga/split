import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// PATCH parziale: un campo omesso resta com'e'. `groupPublicId` e
// `categoryPublicId` accettano anche `null`, che toglie il gruppo/la categoria.
// Nessun default su `participantPublicIds`: omesso significa "stessi
// partecipanti di prima", non "nessun partecipante".
export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
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
}
