/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

// Load .env before anything else so process.env (DATABASE_URL, JWT_SECRET, …)
// is populated when the Nest modules are evaluated (AuthModule reads
// JWT_SECRET at module-load time).
import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // AGGIUNGI QUESTA RIGA:
  app.enableCors(); 
  // (Opzionale) Se vuoi configurarlo meglio in futuro:
  // app.enableCors({ origin: 'http://localhost:4200' }); //TODO

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
