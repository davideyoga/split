import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
  MAX_CATEGORY_COLOR_LENGTH,
  MAX_CATEGORY_ICON_LENGTH,
  MAX_CATEGORY_NAME_LENGTH,
} from '../../limits';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(MAX_CATEGORY_NAME_LENGTH)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CATEGORY_ICON_LENGTH)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CATEGORY_COLOR_LENGTH)
  color?: string;
}
