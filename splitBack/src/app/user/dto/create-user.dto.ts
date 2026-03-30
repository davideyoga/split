// File: src/expense/dto/create-expense.dto.ts
import { IsEmail, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  nickName: string;
}
