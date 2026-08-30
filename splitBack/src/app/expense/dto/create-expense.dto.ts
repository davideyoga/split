import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantPublicIds: string[] = [];

  @IsOptional()
  @IsString()
  groupPublicId?: string;
}
