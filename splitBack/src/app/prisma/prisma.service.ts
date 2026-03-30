// File: src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super(); // Chiama il costruttore di PrismaClient
    console.log('PrismaService constructor called');
  }

  async onModuleInit() {
    console.log('PrismaService is initializing, attempting to connect...');
    try {
      await this.$connect();
      console.log('>>> Prisma Client connected successfully! <<<');
    } catch (error) {
      console.error(
        '!!! FAILED TO CONNECT TO DATABASE !!!',
        error
      );
    }
  }

  async onModuleDestroy() {
    console.log('PrismaService is disconnecting...');
    await this.$disconnect();
  }
}