# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Split is an Nx monorepo for an app that lets users split travel expenses with friends (see `doc/aiPrompt.txt`). Planned screens:

- **Home** — groups the user belongs to, and individual expenses with other users; a bottom-right button to create a new expense.
- **Nuova spesa (New expense)** — add participants (individual users or groups), set the expense amount, set the user's own share, select currency (V2.0), select category (V3.0).
- **Seleziona partecipanti (Select participants)** — choose to add a group or a single user (TODO in the source doc: decide whether to split this into separate screens for individuals vs. groups).

## Environment setup

1. `npm install` — installs all dependencies from `package.json` (this is a single-root npm workspace covering `packages/*`, `splitBack`, `splitBack-e2e`, `data-access`).
2. Install PostgreSQL and create the app user/DB:
   ```
   sudo -u postgres psql
   CREATE USER admin WITH PASSWORD 'mia_password';
   ALTER USER admin CREATEDB;
   CREATE DATABASE split-db OWNER admin;
   ```
3. Set `DATABASE_URL` in `.env` at the repo root (used by Prisma via `prisma.config.ts` / `dotenv`).
4. Set `JWT_SECRET` in `.env` (any random string) — used by `AuthModule` (`splitBack/src/app/auth/`) to sign/verify login tokens.

## Common commands

Serve apps:
```
npx nx serve splitFront   # Ionic/Angular client, dev server
npx nx serve splitBack    # NestJS API
```

Build / lint:
```
npx nx build <project>
npx nx lint <project>
```

Prisma (the authoritative schema lives at `splitBack/prisma/schema.prisma` — always pass `--schema`):
```
npx prisma migrate dev --schema=splitBack/prisma/schema.prisma --name <migration_name>   # create/apply a migration
npx prisma migrate reset --schema=splitBack/prisma/schema.prisma                          # reset the dev DB
./node_modules/.bin/prisma db push --schema=./splitBack/prisma/schema.prisma               # push schema without a migration
./node_modules/.bin/prisma studio --schema=./splitBack/prisma/schema.prisma                # open Prisma Studio
```

> Note: there is a second, unrelated `prisma/schema.prisma` at the repo root (newer `prisma-client` generator, no models defined yet). It is not what `splitBack` uses at runtime — don't confuse the two when running Prisma commands.

## Architecture

**Monorepo layout (Nx, npm workspaces):**
- `splitFront/` — Ionic + Angular client (standalone components, SCSS), meant to run both as a web app and as a mobile app via Capacitor (`capacitor.config.ts`, `@capacitor/android`/`ios` deps). i18n via `@ngx-translate` with `src/assets/i18n/{en,it}.json`.
- `splitBack/` — NestJS API using Prisma as the ORM/DB client.
- `data-access/` — shared library workspace (currently just a scaffolded `DataAccessModule`), intended to hold code shared between front and back.
- `packages/` — placeholder for additional publishable Nx libraries (currently empty).

**Backend (`splitBack`):**
- Standard Nest module structure: `app.module.ts` wires `PrismaModule` and feature modules (`user/`) together.
- `PrismaService` (`src/app/prisma/prisma.service.ts`) extends `PrismaClient`, connecting/disconnecting via Nest's `OnModuleInit`/`OnModuleDestroy` lifecycle hooks. Feature modules depend on it directly (e.g. `UserModule` provides `PrismaService` alongside its own controller/service) rather than only importing `PrismaModule`.
- Data model (`splitBack/prisma/schema.prisma`): `User`, `Group`, `UserOnGroup` (join table for group membership), `Expense`, `ExpenseContribution`. An `Expense` has a `createdBy` user, a `paidBy` user, an optional `Group`, and a list of `ExpenseContribution` rows that record each participant's `share` (Decimal) of the cost — this contribution list is how splitting between multiple users/groups is modeled. `Expense.currency` and `Expense.category` fields exist already but are earmarked for V2.0/V3.0 features respectively. `User` also has `ConfirmationCode` (email confirmation) and `refreshToken` fields for auth.
- Built via Nx's `@nx/js:node` + webpack executors (see `splitBack/package.json` `nx.targets`), not the Nest CLI directly.
- `GET /api/expense` (`ExpenseController.findMine`, guarded by `JwtAuthGuard`) returns the logged-in user's expenses — defined as any `Expense` where the user has an `ExpenseContribution` row, not just ones they created or paid — ordered by `createdDate` descending. Used to populate the expense list on the Home screen.

**Frontend (`splitFront`):**
- Standalone Angular components/pages under `src/app/pages/` (`home`, `add-expense`) and `src/app/components/` (`select-participant`).
- Cross-cutting state is handled via services in `src/app/services/`: `data-sharing.ts` and `participant-selection-service.ts` pass selection state between the participant-picker component and the add-expense page; `user.service.ts` talks to the backend.
- Built with `@angular/build:application` (esbuild-based Angular builder), Ionic CSS utilities imported globally in `project.json`, SCSS as the style language.

**Auth (alpha shortcut — `splitBack/src/app/auth/`, `splitFront/src/app/services/auth.*`):**
- Login is **email-only**: `POST /api/auth/login` looks up a `User` by email and, if found, returns a JWT — no password, no confirmation code, no real email is sent. The user must already exist (created via the pre-existing `POST /api/user`); login never creates one.
- `JwtAuthGuard` is a small custom `CanActivate` reading `Authorization: Bearer <token>` directly via `@nestjs/jwt`'s `JwtService` — `@nestjs/passport` was deliberately skipped to keep the dependency footprint minimal, consistent with how light the rest of `splitBack` is.
- Tokens are long-lived (30 days), there is no refresh flow — the `User.refreshToken` schema field remains unused.
- **TODO before beta:** this is only safe because the app is handed to a small set of trusted alpha testers. Before any wider release, replace email-only login with real verification (password and/or a sent confirmation code, reusing the existing `ConfirmationCode` model) and add token refresh/expiry handling.

**Localization (i18n):**
- `splitFront` uses `@ngx-translate` with translation files at `src/assets/i18n/en.json` and `src/assets/i18n/it.json`.
- Any user-facing text shown in HTML templates (pages, components) or via pop-ups/alerts/toasts must be added to **both** `en.json` and `it.json` — never hardcode user-facing strings directly in the template or in TS code.


# Instructions for Claude Code

## Verification Commands
After modifying any Angular/Ionic code, run these verification steps:

1. Type Check: `npx tsc --noEmit`
2. Angular Build: `npx ng build --configuration=development`
3. Unit Tests: `npx ng test --watch=false`

> Note: All 3 commands must pass successfully before concluding a task.

## Development Workflow
- Always check for TypeScript errors after creating or updating components.
- Do not run interactive or watching test commands (like `ng test` without `--watch=false`).

## Documenting decisions
Every time a non-trivial choice is made — whether a shortcut taken to reach alpha testing faster, or a definitive/architectural decision — check whether it should be recorded in `CLAUDE.md` or in another appropriate `.md` file (e.g. a doc under `doc/`), and add it. This includes things like: temporary workarounds that will need revisiting, deliberate scope cuts for the alpha, chosen libraries/patterns, and schema or API decisions. Shortcuts should be flagged as such (e.g. "TODO before beta: ...") so they aren't mistaken for final decisions.

## TODO tracking
Every `TODO` comment added anywhere in the code must also be recorded in `TODO.md` at the repo root, with a `file:line` reference and a short description. When a `TODO` is resolved or removed from the code, remove its entry from `TODO.md` too, so the list stays an accurate reflection of what's actually pending.