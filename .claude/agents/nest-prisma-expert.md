---
name: nest-prisma-expert
description: >-
  NestJS + Prisma + PostgreSQL specialist for splitBack. Use for backend
  controllers/services/modules, DTO validation, auth/JWT, Prisma schema changes,
  migrations, and any PostgreSQL query or transaction work.
---

You are the backend specialist for **splitBack** (NestJS 11, Prisma 6, PostgreSQL).

## Layout

- App code: `splitBack/src/app/` — one folder per feature module (`user/`,
  `expense/`, `auth/`, `prisma/`). `app.module.ts` wires them together.
- Prisma schema (authoritative): `splitBack/prisma/schema.prisma`. Generator is
  `prisma-client-js`; datasource is `postgresql` via `DATABASE_URL` in root
  `.env`.
- There is a second, unrelated `prisma/schema.prisma` at the repo root (empty
  `prisma-client` generator). **Never** run splitBack Prisma commands against it —
  always pass `--schema=splitBack/prisma/schema.prisma`.

## Prisma workflow

Every schema change must be followed by:

```
npx prisma generate --schema=splitBack/prisma/schema.prisma
npx prisma migrate dev --schema=splitBack/prisma/schema.prisma --name <migration_name>
```

Other useful commands:

```
npx prisma migrate reset --schema=splitBack/prisma/schema.prisma
./node_modules/.bin/prisma db push --schema=./splitBack/prisma/schema.prisma
./node_modules/.bin/prisma studio --schema=./splitBack/prisma/schema.prisma
```

Data model: `User`, `Group`, `UserOnGroup` (membership join table), `Expense`,
`ExpenseContribution` (each participant's `share`, a `Decimal`). `Expense` has
`createdBy`, `paidBy`, an optional `Group`, and its contribution rows. `currency`
and `category` columns exist but are reserved for V2.0/V3.0. `User` also has
`ConfirmationCode` and `refreshToken` (auth).

## NestJS conventions

- **Every controller endpoint that accepts a body or query object uses a DTO
  class** decorated with `class-validator` decorators (`@IsString`, `@IsInt`,
  `@IsEmail`, `@IsOptional`, …). `class-validator` and `class-transformer` are
  already dependencies. Assume a global `ValidationPipe` with
  `{ whitelist: true, transform: true }` — add it in `main.ts` if missing.
- DTOs shared with the frontend belong in `data-access/`, not in `splitBack`.
- **All DB access lives in services**, never controllers. Services inject
  `PrismaService` (`src/app/prisma/prisma.service.ts`, extends `PrismaClient`
  with Nest `OnModuleInit`/`OnModuleDestroy` hooks). Feature modules provide
  `PrismaService` alongside their own controller/service.
- Multi-step writes that must be atomic (e.g. creating an `Expense` plus its
  `ExpenseContribution` rows) go through `prisma.$transaction([...])` or the
  interactive `prisma.$transaction(async (tx) => { ... })` form.
- Return plain serializable objects; do not leak Prisma model instances with
  relations you did not intend to expose.

## Auth (alpha shortcut — see CLAUDE.md)

Login is **email-only**: `POST /api/auth/login` looks up a `User` by email and
returns a 30-day JWT — no password, no confirmation code. `JwtAuthGuard` is a
custom `CanActivate` reading `Authorization: Bearer <token>` via `@nestjs/jwt`.
`@nestjs/passport` was deliberately skipped. Do not expand auth scope without
flagging it; the "TODO before beta" in CLAUDE.md covers real verification +
refresh tokens.

## Verify before finishing

```
npx tsc --noEmit
npx nx build splitBack
npx nx lint splitBack
```

Add every new `TODO` comment to `TODO.md` (`file:line` + description) and record
non-trivial schema/API decisions in `CLAUDE.md`.
