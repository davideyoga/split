import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @UseGuards(SessionAuthGuard)
  findAvailable(@Req() request: Request) {
    const user = request['user'] as AuthUser;
    return this.categoryService.findAvailable(user.publicId);
  }

  @Post()
  @UseGuards(SessionAuthGuard)
  create(
    @Req() request: Request,
    @Body(new ValidationPipe()) dto: CreateCategoryDto,
  ) {
    const user = request['user'] as AuthUser;
    return this.categoryService.create(user.publicId, dto);
  }

  @Patch('/:publicId')
  @UseGuards(SessionAuthGuard)
  update(
    @Req() request: Request,
    @Param('publicId') publicId: string,
    @Body(new ValidationPipe()) dto: UpdateCategoryDto,
  ) {
    const user = request['user'] as AuthUser;
    return this.categoryService.update(user.publicId, publicId, dto);
  }

  @Delete('/:publicId')
  @UseGuards(SessionAuthGuard)
  archive(@Req() request: Request, @Param('publicId') publicId: string) {
    const user = request['user'] as AuthUser;
    return this.categoryService.archive(user.publicId, publicId);
  }
}
