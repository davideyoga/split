import { IsString, MaxLength } from 'class-validator';
import { MAX_GROUP_NAME_LENGTH } from '../../limits';

// Solo il nome: gli altri membri entrano col link d'invito (2026-11-07).
export class CreateGroupDto {
  @IsString()
  @MaxLength(MAX_GROUP_NAME_LENGTH)
  name: string;
}
