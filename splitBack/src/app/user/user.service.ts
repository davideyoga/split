import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

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
