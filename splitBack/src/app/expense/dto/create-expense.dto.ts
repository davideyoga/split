import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  // Facoltativa: se omessa si salva '' (la colonna resta NOT NULL) e il
  // frontend mostra un testo di fallback.
  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
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
}
