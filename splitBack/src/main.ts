/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

// Load .env before anything else so process.env (DATABASE_URL,
// BETTER_AUTH_SECRET, MAIL_*, …) is populated when the Nest modules are
// evaluated.
import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Express } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app/app.module';
import { BETTER_AUTH, CLIENT_IP_HEADER, type Auth } from './app/auth/auth.factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // AGGIUNGI QUESTA RIGA:
  app.enableCors();
  // (Opzionale) Se vuoi configurarlo meglio in futuro:
  // app.enableCors({ origin: 'http://localhost:4200' }); //TODO

  // Rotte di login di Better Auth (/api/auth/*). Registrate direttamente su
  // Express qui, cioe' dopo CORS ma prima del body parser che Nest aggiunge in
  // app.listen(): Better Auth legge il body della richiesta da se'.
  // - Better Auth riceve una Request web senza l'indirizzo del socket, quindi
  //   l'IP del client (per il rate limit per IP) gli arriva in
  //   CLIENT_IP_HEADER, sempre sovrascritto qui: un valore mandato dal client
  //   non conta.
  // - I cookie si scartano: la sessione viaggia solo come Bearer (plugin
  //   bearer), come in SessionAuthGuard, cosi' un cookie rimasto nel browser
  //   non autentica nulla da solo.
  const auth = app.get<Auth>(BETTER_AUTH);
  const authHandler = toNodeHandler(auth);
  (app.getHttpAdapter().getInstance() as Express).all('/api/auth/*splat', (req, res) => {
    req.headers[CLIENT_IP_HEADER] = req.socket.remoteAddress ?? '';
    delete req.headers.cookie;
    return authHandler(req, res);
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
