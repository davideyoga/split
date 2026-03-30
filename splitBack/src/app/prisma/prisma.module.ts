// File: src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';


@Global() //Rende il servizio disponibile ovunque senza dover importare il modulo mille volte
@Module({
  providers: [PrismaService],
  exports: [PrismaService], //Se non esportato, all'esterno non si vede
})
export class PrismaModule {}