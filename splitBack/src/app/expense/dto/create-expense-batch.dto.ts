import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreateExpenseDto } from './create-expense.dto';

// POST /api/expense/batch: piu' spese create tutte insieme o nessuna. Ognuna
// ha le stesse regole di POST /api/expense.
export class CreateExpenseBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateExpenseDto)
  expenses!: CreateExpenseDto[];
}
