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
3. Set `DATABASE_URL` in `.env` at the repo root (used by Prisma via `splitBack/prisma.config.ts` / `dotenv`).
4. Set `JWT_SECRET` in `.env` (any random string) — used by `AuthModule` (`splitBack/src/app/auth/`) to sign/verify login tokens. If it is unset, `AuthModule` registers `JwtModule` with `secret: undefined` and every `POST /api/auth/login` for an **existing** user 500s at `jwtService.signAsync` (a non-existent email still 401s cleanly) — and the `splitFront` login page reports *any* failure as "No account found for this email" (`login.user-not-found`), which is misleading in that case.

> `splitBack/src/main.ts` runs `import 'dotenv/config'` as its first import, so the API loads `.env` from the repo root itself — you do **not** need to export `DATABASE_URL` / `JWT_SECRET` into the shell before `nx serve splitBack`. `dotenv` is an explicit dependency of `splitBack`. After editing `.env`, restart `nx serve splitBack` (the values are read at module-load time).

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

Seed test users (alpha):
```
set -a && . ./.env && set +a && node splitBack/prisma/seed.ts
```
`splitBack/prisma/seed.ts` upserts a fixed set of alpha test users by email —
the developer's own account plus Disney-named accounts (`Pippo`, `Pluto`,
`Paperino`, …) whose nicknames double as easy email-only logins. It is
idempotent (safe to re-run) and run manually with `node` (Node ≥ 22 strips the
TS types) — **not** wired into `prisma.config.ts`'s `seed` hook, so
`prisma migrate reset` does **not** re-run it; re-run the command above after a
reset. Seeded users are created with `confirmed: true` and skip the
`ConfirmationCode` row that `UserService.create` would add.

> Note: there is only one Prisma setup — `splitBack/prisma/schema.prisma` plus its `splitBack/prisma.config.ts`. An earlier empty scaffold (`prisma/schema.prisma` + `prisma.config.ts` at the repo root, from the "refactor from old project" commit) was **deleted** on 2026-08-30: it had no models, its `generated/prisma` client was never built, and nothing imported it. Its root `prisma.config.ts` also carried a `migrations.path` that could hijack migrations run from the repo root, which is how the stray `prisma/migrations/20260329165712_init_db` got created. If you need a root-level Prisma config back, don't — run Prisma commands from inside `splitBack/`, or keep passing `--schema=splitBack/prisma/schema.prisma`.

> Migrations (2026-08-30, groups work): `20260830163530_...` reconciled the earlier schema drift (`ExpenseContribution.share`, `Expense.paidById`/`currency`/`category`/`groupId`, drop of `ExpenseOnGroup`). `20260830183851_add_group_publicid_and_membership_unique` adds `Group.publicId` (uuid) + `@@unique([groupId, userId])` on `UserOnGroup`. `prisma migrate dev` is **non-interactive-hostile** here (it errors out); create the migration folder + SQL by hand (or via `prisma migrate diff --from-migrations … --to-schema-datamodel … --script`) and apply with `prisma db execute` / `prisma migrate deploy`. **Do not** pass the real `DATABASE_URL` as `--shadow-database-url` — Prisma wipes the shadow DB; doing so once during this work dropped the dev data (recovered by re-running `splitBack/prisma/seed.ts`).

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
- `GET /api/expense` (`ExpenseController.findMine`, guarded by `JwtAuthGuard`) returns the logged-in user's expenses — defined as any `Expense` where the user has an `ExpenseContribution` row, not just ones they created or paid — ordered by `createdDate` descending, `include`-ing `paidBy`, `group { publicId, name }`, and each contribution's `user`. Used to populate the expense list on the Home screen.
- `POST /api/expense` (`CreateExpenseDto`: `description`, `amount`, optional `participantPublicIds: string[]`, optional `groupPublicId`). The creator is always `createdBy` + `paidBy` + a contributor. **Contributors = deduped union of `creator ∪ participants ∪ group members`** (`Set<userId>`); the equal `share` = `round(amount / contributors.length, 2)` is written to every `ExpenseContribution` row. If `groupPublicId` is given: `404` if the group doesn't exist, `403` if the caller isn't a member, otherwise `Expense.groupId` is set and the group's members are folded into the contributor set. **One group per expense** (matches the singular `Expense.groupId`); extra individuals can still be added alongside. Rounding drift when `amount` isn't divisible by the contributor count is a known `TODO` (see `TODO.md`).

**Groups (`splitBack/src/app/group/`):**
- `Group` has a `publicId String @unique @default(uuid())` (mirrors `User`) — the API only ever exposes `publicId`, never the int `id`. `UserOnGroup` (the user↔group join table = "utente Partecipa Gruppo") now has `@@unique([groupId, userId])`, which makes adding members idempotent (`createMany({ skipDuplicates: true })`).
- All endpoints are guarded by `JwtAuthGuard` and keyed by `publicId`:
  - `POST /api/group` — `{ name, memberPublicIds: string[] }`. Creates the group; the **creator is always added as a member** even if omitted from `memberPublicIds`. Members are deduped; unknown `memberPublicIds` → `400`.
  - `GET /api/group` — groups the caller is a member of (each with a lightweight `members: { publicId, nickName }[]` list), newest first.
  - `GET /api/group/:publicId` — one group. `404` if it doesn't exist, `403` if it exists but the caller isn't a member (a minor existence-leak accepted for alpha debugging).
  - `PATCH /api/group/:publicId` — `{ name }` rename.
  - `POST /api/group/:publicId/members` — `{ memberPublicIds: string[] }` add members (idempotent).
  - `DELETE /api/group/:publicId/members/:userPublicId` — remove one member. Historical `ExpenseContribution` rows are left untouched.
- **Permissions — alpha shortcut:** any member (not just a creator/owner) can rename the group and add/remove members. **TODO before beta:** add `Group.createdById` (owner) and restrict mutations to the owner — see `group.service.ts` and `TODO.md`.
- Response shape comes from a single private `toResponse` mapper in `GroupService` (`{ publicId, name, createdDate, members }`); there is no `group.entity.ts`, consistent with how `UserService`/`ExpenseService` return plain objects.

**Frontend (`splitFront`):**
- Standalone Angular components/pages under `src/app/pages/` — one folder per page (`home`, `add-expense`, `login`), except the groups feature which uses a **feature folder** `pages/groups/` with a subfolder per page: `group-list/` (list + inline create-group form) and `group-detail/` (rename + add/remove members). Shared component `select-participant` lives in `src/app/components/`. Routes `groups` → `GroupList` and `groups/:publicId` → `GroupDetail` are lazy `loadComponent` + `authGuard`, like the rest.
- `Home` also loads `GroupService.getMyGroups()` and shows a "Groups" section above the expense list, plus a people-icon button in the header linking to `/groups`.
- The `select-participant` modal has a **person / group `ion-segment`**: "Person" mode is the nickname search (`UserService`), "Group" mode lazy-loads `GroupService.getMyGroups()` and lets you pick one. It emits back through `ParticipantSelectionService` — `selectedParticipant$` (a `User`) or `selectedGroup$` (a `Group`), two plain RxJS `Subject`s. `add-expense` subscribes to both: participants become removable chips, the group becomes a single `primary` chip "Name · N members" (one group max, cleared with the ✕). `group-list`/`group-detail` only use `selectedParticipant$` for member selection.
- Cross-cutting state services in `src/app/services/`: `participant-selection-service.ts` (above), `user.service.ts` / `group.service.ts` / `expense.service.ts` talk to the backend. (`data-sharing.ts` was dead legacy code — deleted 2026-08-30.)
- `Group` model: `src/app/models/group.model.ts` (`{ publicId, name, members: User[] }`). `GroupService` mirrors `UserService` (`environment.apiUrl`, `catchError` → `of([])` on reads); the `authInterceptor` attaches the Bearer token.
- Built with `@angular/build:application` (esbuild-based Angular builder), Ionic CSS utilities imported globally in `project.json`, SCSS as the style language.

**Auth (alpha shortcut — `splitBack/src/app/auth/`, `splitFront/src/app/services/auth.*`):**
- Login is **email-only**: `POST /api/auth/login` looks up a `User` by email and, if found, returns a JWT — no password, no confirmation code, no real email is sent. The user must already exist (created via the pre-existing `POST /api/user`); login never creates one.
- `JwtAuthGuard` is a small custom `CanActivate` reading `Authorization: Bearer <token>` directly via `@nestjs/jwt`'s `JwtService` — `@nestjs/passport` was deliberately skipped to keep the dependency footprint minimal, consistent with how light the rest of `splitBack` is.
- Tokens are long-lived (30 days), there is no refresh flow — the `User.refreshToken` schema field remains unused.
- **TODO before beta:** this is only safe because the app is handed to a small set of trusted alpha testers. Before any wider release, replace email-only login with real verification (password and/or a sent confirmation code, reusing the existing `ConfirmationCode` model) and add token refresh/expiry handling.

**Localization (i18n):**
- `splitFront` uses `@ngx-translate` with translation files at `src/assets/i18n/en.json` and `src/assets/i18n/it.json`.
- Any user-facing text shown in HTML templates (pages, components) or via pop-ups/alerts/toasts must be added to **both** `en.json` and `it.json` — never hardcode user-facing strings directly in the template or in TS code.
- Sections so far: `add-expense.*`, `select-participant.*`, `login.*`, `home.*`, `groups.*`. Every component is fully translated (the `select-participant` modal's old hardcoded Italian was converted to `select-participant.*` when the person/group toggle landed).


# Instructions for Claude Code

## Verification Commands

After modifying **frontend** (`splitFront`) code:

1. Type Check: `npx tsc --noEmit`
2. Build: `npx nx build splitFront --configuration=development`
3. Lint: `npx nx lint splitFront`
4. Unit Tests: `npx nx test splitFront` — **not yet available.** The workspace has
   no unit-test runner configured (`nx.json` → `unitTestRunner: none`, no `test`
   target on `splitFront`, Jest not installed). When tests are needed, wire it up
   with `npx nx g @nx/jest:configuration --project=splitFront` first and record
   that decision here.

After modifying **backend** (`splitBack`) code:

1. Type Check: `npx tsc --noEmit`
2. Build: `npx nx build splitBack`
3. Lint: `npx nx lint splitBack`

> Note: every applicable command above must pass before concluding a task.
> `npx nx affected -t build lint typecheck` checks everything impacted by a change.

## Development Workflow
- Always check for TypeScript errors after creating or updating components.
- Do not run interactive or watching test commands (like `ng test` / `nx test --watch`).

## Documenting decisions
Every time a non-trivial choice is made — whether a shortcut taken to reach alpha testing faster, or a definitive/architectural decision — check whether it should be recorded in `CLAUDE.md` or in another appropriate `.md` file (e.g. a doc under `doc/`), and add it. This includes things like: temporary workarounds that will need revisiting, deliberate scope cuts for the alpha, chosen libraries/patterns, and schema or API decisions. Shortcuts should be flagged as such (e.g. "TODO before beta: ...") so they aren't mistaken for final decisions.

## TODO tracking
Every `TODO` comment added anywhere in the code must also be recorded in `TODO.md` at the repo root, with a `file:line` reference and a short description. When a `TODO` is resolved or removed from the code, remove its entry from `TODO.md` too, so the list stays an accurate reflection of what's actually pending.

## Local sub-agents

Specialist agents live in `.claude/agents/`. Delegate to them for focused work:

- **`nx-architect`** — Nx workspace structure, project boundaries, generators,
  `project.json`/`nx.json` targets, `nx affected` runs. Enforces that `splitFront`
  never imports `splitBack`/Prisma/Nest code; shared DTOs/interfaces go in
  `data-access/` (the workspace's only shared lib — there is no `libs/`).
- **`nest-prisma-expert`** — `splitBack` controllers/services/modules, `class-validator`
  DTOs, JWT auth, and all Prisma work. Every `schema.prisma` change is followed by
  `npx prisma generate --schema=splitBack/prisma/schema.prisma` + a
  `npx prisma migrate dev --schema=…` migration. DB access stays in services via
  `PrismaService`; atomic multi-writes use `prisma.$transaction()`.
- **`ionic-jest-specialist`** — `splitFront` Ionic/Angular standalone UI
  (mobile-first, i18n in both `en.json`/`it.json`) and frontend unit tests (mock
  Capacitor plugins, drive Ionic lifecycle hooks manually). Note: a test runner
  must be configured before frontend tests can run — see Verification Commands.

## Tooling / plugins (set up outside this repo)

The following Claude Code plugins / MCP servers are recommended for this stack and
must be installed by the developer in an interactive session (`/plugin install …`
or `claude mcp add …`), they are not part of the repo:

- `typescript-lsp@claude-plugins-official` — TS diagnostics/navigation for Nest + Ionic.
- `context7@claude-plugins-official` — up-to-date Nx / NestJS / Prisma / Ionic docs.
- `playwright@claude-plugins-official` — browser automation for the web build of `splitFront`.
- A PostgreSQL MCP (e.g. `pg-aiguide`, or a Postgres/Supabase MCP) pointed at
  `DATABASE_URL` — for ad-hoc SQL and schema inspection against the dev DB.