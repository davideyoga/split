import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  publicId: string;
  nickName: string;
  email: string;
}

interface JwtPayload {
  sub: string; // publicId
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string): Promise<{ accessToken: string; user: AuthUser }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Utente non trovato');
    }

    const payload: JwtPayload = { sub: user.publicId, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        publicId: user.publicId,
        nickName: user.nickName,
        email: user.email,
      },
    };
  }

  async validateToken(token: string): Promise<AuthUser> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token non valido');
    }

    const user = await this.prisma.user.findUnique({
      where: { publicId: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Utente non trovato');
    }

    return {
      publicId: user.publicId,
      nickName: user.nickName,
      email: user.email,
    };
  }
}
