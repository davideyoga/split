import { IsArray, IsNumber, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsArray()
  @IsString({ each: true })
  participantPublicIds: string[];
}
