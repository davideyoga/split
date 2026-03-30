import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    //private emailService: EmailService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        nickName: createUserDto.nickName,
      },
    });

    //const confirmationCode = this.emailService.generateConfirmationCode();
    const confirmationCode = 'testcode';
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.prisma.confirmationCode.create({
      data: {
        code: confirmationCode,
        userId: user.id,
        expiresAt: expiresAt,
      },
    });

    //this.emailService.sendConfirmationEmail(user.email, confirmationCode);

    return user;
  }

  async getUser(nickName: string) {
    const users = await this.prisma.user.findMany({
      where: {
        nickName: {
          contains: nickName,
          mode: 'insensitive',
        },
      },
      select: {
        publicId: true,
        nickName: true,
      },
      take: 10,
    });

    return users;
  }
}