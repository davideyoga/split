import { IsString } from 'class-validator';

// Solo il nome: gli altri membri entrano col link d'invito (2026-11-07).
export class CreateGroupDto {
  @IsString()
  name: string;
}
