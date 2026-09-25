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
   On this dev machine `admin` ended up as a **superuser** (`pg_roles.rolsuper = true`), not just `CREATEDB` as the snippet above creates. Prisma needs nothing beyond ownership of `split-db`, and a Postgres superuser can run shell commands on the host (`COPY … FROM PROGRAM`), so dropping the extra privileges (`ALTER USER admin NOSUPERUSER;`) is worth doing — especially while the server listens on `0.0.0.0:5432`.
3. Set `DATABASE_URL` in `.env` at the repo root (used by Prisma via `splitBack/prisma.config.ts` / `dotenv`).
4. Set `JWT_SECRET` in `.env` (any random string) — used by `AuthModule` (`splitBack/src/app/auth/`) to sign/verify login tokens. If it is unset, `AuthModule` registers `JwtModule` with `secret: undefined` and every `POST /api/auth/login` for an **existing** user 500s at `jwtService.signAsync` (a non-existent email still 401s cleanly) — and the `splitFront` login page reports *any* failure as "No account found for this email" (`login.user-not-found`), which is misleading in that case.

> `splitBack/src/main.ts` runs `import 'dotenv/config'` as its first import, so the API loads `.env` from the repo root itself — you do **not** need to export `DATABASE_URL` / `JWT_SECRET` into the shell before `nx serve splitBack`. `dotenv` is an explicit dependency of `splitBack`. After editing `.env`, restart `nx serve splitBack` (the values are read at module-load time). `.env` is gitignored, so a fresh clone has **no** `.env`: copy `.env.example` (committed, placeholder values only) and fill it in — don't just export the vars in one terminal, or the next terminal breaks again. This actually happened on 2026-09-06: `.env` had been *tracked* since 2026-01-03 (added one day before `.gitignore` started listing it — an already-tracked file stays tracked), it was deleted from the GitHub web UI on 2026-08-31 (commit `46a7c9f` "Delete .env"), and the `git pull` that brought that commit down removed the file from the working tree. The running server survived on its in-memory env; the next restart failed with P1012. The DB password and `JWT_SECRET` published in that history were rotated the same day, so the values still readable in commits up to `46a7c9f^` are dead.

## Common commands

Serve apps:
```
npx nx serve splitFront   # Ionic/Angular client, dev server
npx nx serve splitBack    # NestJS API
```

> `nx serve splitBack` is **not** a watch server: its `build` target (`splitBack/package.json`) is an `nx:run-commands` running `webpack-cli build` with no `--watch`, so `@nx/js:node` compiles once at startup and never rebuilds. **Restart it after every backend change** — otherwise new routes 404 (`Cannot GET /api/…`) while old ones still answer, which looks like a frontend bug. To check whether the running process is stale without restarting it, build and run the bundle on another port: `PORT=3333 node splitBack/dist/main.js`.

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
`splitBack/prisma/seed.ts` upserts the 10 preset expense categories (by `slug`) and a fixed set of alpha test users by email —
the developer's own account plus Disney-named accounts (`Pippo`, `Pluto`,
`Paperino`, …) whose nicknames double as easy email-only logins. It is
idempotent (safe to re-run) and run manually with `node` (Node ≥ 22 strips the
TS types) — **not** wired into `prisma.config.ts`'s `seed` hook, so
`prisma migrate reset` does **not** re-run it; re-run the command above after a
reset. Seeded users are created with `confirmed: true` and skip the
`ConfirmationCode` row that `UserService.create` would add.

> Note: there is only one Prisma setup — `splitBack/prisma/schema.prisma` plus its `splitBack/prisma.config.ts`. An earlier empty scaffold (`prisma/schema.prisma` + `prisma.config.ts` at the repo root, from the "refactor from old project" commit) was **deleted** on 2026-08-30: it had no models, its `generated/prisma` client was never built, and nothing imported it. Its root `prisma.config.ts` also carried a `migrations.path` that could hijack migrations run from the repo root, which is how the stray `prisma/migrations/20260329165712_init_db` got created. If you need a root-level Prisma config back, don't — run Prisma commands from inside `splitBack/`, or keep passing `--schema=splitBack/prisma/schema.prisma`.

> Migrations (2026-08-30, groups work): `20260830163530_...` reconciled the earlier schema drift (`ExpenseContribution.share`, `Expense.paidById`/`currency`/`category`/`groupId`, drop of `ExpenseOnGroup`). `20260830183851_add_group_publicid_and_membership_unique` adds `Group.publicId` (uuid) + `@@unique([groupId, userId])` on `UserOnGroup`. `prisma migrate dev` is **non-interactive-hostile** here (it errors out); create the migration folder + SQL by hand (or via `prisma migrate diff --from-migrations … --to-schema-datamodel … --script`) and apply with `prisma db execute` / `prisma migrate deploy`. **Do not** pass the real `DATABASE_URL` as `--shadow-database-url` — Prisma wipes the shadow DB; doing so once during this work dropped the dev data (recovered by re-running `splitBack/prisma/seed.ts`).
>
> Migration (2026-08-31, categories): `20260831230000_add_category` adds the `Category` table (+ its two unique indexes), swaps `Expense.category String?` for `categoryId Int?` + FK. `migrate diff --from-migrations` needs a *shadow* database and **`psql` is not installed on this machine** — create and drop a throwaway one with Prisma itself: `echo 'CREATE DATABASE split_shadow_tmp;' | npx prisma db execute --url "$DATABASE_URL" --stdin`, pass the same URL with `/split_shadow_tmp` as `--shadow-database-url`, then `DROP DATABASE` the same way once `migrate deploy` has run. Re-run the seed afterwards to get the preset categories.

## Architecture

**Monorepo layout (Nx, npm workspaces):**
- `splitFront/` — Ionic + Angular client (standalone components, SCSS), meant to run both as a web app and as a mobile app via Capacitor (`capacitor.config.ts`, `@capacitor/android`/`ios` deps). i18n via `@ngx-translate` with `src/assets/i18n/{en,it}.json`.
- `splitBack/` — NestJS API using Prisma as the ORM/DB client.
- `data-access/` — shared library workspace (currently just a scaffolded `DataAccessModule`), intended to hold code shared between front and back.
- `packages/` — placeholder for additional publishable Nx libraries (currently empty).

**Backend (`splitBack`):**
- Standard Nest module structure: `app.module.ts` wires `PrismaModule` and feature modules (`user/`) together.
- `PrismaService` (`src/app/prisma/prisma.service.ts`) extends `PrismaClient`, connecting/disconnecting via Nest's `OnModuleInit`/`OnModuleDestroy` lifecycle hooks. A failed `$connect()` is **swallowed** by a `try/catch` that only `console.error`s it, so the app still logs "Nest application successfully started" with a dead DB and every request 500s afterwards. Two symptoms to recognize: no `.env` → `PrismaClientInitializationError P1012: Environment variable not found: DATABASE_URL`; stale credentials (e.g. after rotating the DB password without restarting the server) → `Authentication failed` and plain `500 Internal server error` on every endpoint. Feature modules depend on it directly (e.g. `UserModule` provides `PrismaService` alongside its own controller/service) rather than only importing `PrismaModule`.
- Data model (`splitBack/prisma/schema.prisma`): `User`, `Group`, `UserOnGroup` (join table for group membership), `Expense`, `ExpenseContribution`, `Category`. An `Expense` has a `createdBy` user, a `paidBy` user, an optional `Group`, an optional `Category`, and a list of `ExpenseContribution` rows that record each participant's `share` (Decimal) of the cost — this contribution list is how splitting between multiple users/groups is modeled. `Expense.currency` exists already but is earmarked for V2.0. `User` also has `ConfirmationCode` (email confirmation) and `refreshToken` fields for auth.
- Built via Nx's `@nx/js:node` + webpack executors (see `splitBack/package.json` `nx.targets`), not the Nest CLI directly.
- `GET /api/expense` (`ExpenseController.findMine`, guarded by `JwtAuthGuard`) returns the logged-in user's expenses — defined as any `Expense` where the user has an `ExpenseContribution` row, not just ones they created or paid — ordered by `createdDate` descending, `include`-ing `paidBy`, `group { publicId, name }`, and each contribution's `user`. Used to populate the expense list on the Home screen.
- `GET /api/expense/group/:publicId` (`ExpenseController.findByGroup`, `JwtAuthGuard`) returns every expense attached to that group (`where: { groupId }`), same ordering and `include`s as `findMine`. `404` if the group doesn't exist, `403` if the caller isn't a member — the expenses of a group are visible to **all** its members, even those without an `ExpenseContribution` row (e.g. someone added after the expense). Feeds the `group-expenses` component on the group detail page.
- `POST /api/expense` (`CreateExpenseDto`: `description`, `amount`, optional `participantPublicIds: string[]`, optional `paidByPublicId`, optional `groupPublicId`, optional `categoryPublicId`). The creator is always `createdBy` + a contributor. **Contributors = deduped union of `creator ∪ participants ∪ group members`** (`Set<userId>`); the equal `share` = `round(amount / contributors.length, 2)` is written to every `ExpenseContribution` row. If `groupPublicId` is given: `404` if the group doesn't exist, `403` if the caller isn't a member, otherwise `Expense.groupId` is set and the group's members are folded into the contributor set. **One group per expense** (matches the singular `Expense.groupId`); extra individuals can still be added alongside. Rounding drift when `amount` isn't divisible by the contributor count is a known `TODO` (see `TODO.md`).
- **`paidBy` is selectable, but constrained to the contributor set.** `paidByPublicId` defaults to the creator; if given, it must resolve to a user *and* be one of the contributors computed above, otherwise `400`. Restricting it that way is a correctness decision, not a UI one: `findMine` selects expenses by `ExpenseContribution`, so a payer with no contribution row would never see the expense they paid and would silently lose the credit in `expense-balances` (see the Balances section). Lifting the constraint — the natural way to record a repayment, "Pippo paid 15 €, I'm the only contributor" — means adding an `OR` on `paidById` to `findMine`'s `where` first.

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

**Navigation shell (`splitFront`) — migration in progress, see [`doc/ToDo_Navigabilita/README.md`](doc/ToDo_Navigabilita/README.md):**
- The old star-graph navigation (everything reachable only from `home`) is being replaced by a **persistent tab shell** in 5 phases. **Phase 1 done (2026-09-06):** `pages/tabs/tabs.page.ts` is an `<ion-tabs>` + bottom `<ion-tab-bar>` with 4 tabs — `activity` (`receipt-outline`), `groups` (`people-outline`), `balances` (`swap-horizontal-outline`), `profile` (`person-circle-outline`), labels under `tabs.*`. `authGuard` sits on the `tabs` parent route, not each child. Routes are now `/login` (outside the shell) + `/tabs/{activity,groups,groups/:publicId,balances,profile}`; old URLs `/home`, `/groups`, `/groups/:publicId` redirect into the shell. `/add-expense` is **still a standalone page** (not under `tabs`) until Phase 2 turns it into a modal — the `activity` FAB and its compat are why it stays routable for now.
- `pages/home/` was renamed to `pages/activity/` (`ActivityPage`, selector `app-activity`) as a **straight move, no redesign** — it still has the Groups card, the header people/logout icons, and a non-tappable expense list. The redesign (drop the Groups card + header icons, tappable expense rows, `ion-refresher`, empty-state CTA) is Phase 3/5.
- `pages/balances/` and `pages/profile/` are **minimal Phase-1 stubs**: `BalancesPage` = `<app-expense-balances>` full-page over `ExpenseService.list()`; `ProfilePage` = current user nick/email + a confirm-dialog logout (`profile.*`). `LanguageService` + the "Salda" per-row action + 401 handling come in Phases 4–5.

**Frontend (`splitFront`):**
- Standalone Angular components/pages under `src/app/pages/` — one folder per page (`activity`, `add-expense`, `login`, `balances`, `profile`, `tabs`), except the groups feature which uses a **feature folder** `pages/groups/` with a subfolder per page: `group-list/` (list + inline create-group form) and `group-detail/` (rename + add/remove members). Shared components live in `src/app/components/`: `select-participant`, `group-expenses` (`<app-group-expenses [groupPublicId]>` — the group's expense list rendered under the members list in `group-detail`; it's a "smart" component, it calls `ExpenseService.listByGroup()` itself and reloads on `ngOnChanges` of the input, consistent with how pages talk to services directly here; its rows mirror the activity expense rows, i18n under `groups.expenses-*`; it also re-emits what it loaded through `(expensesLoaded)` so the containing page can feed `expense-balances` without repeating the HTTP call) and `expense-balances` (see below). Routes are lazy `loadComponent`, `authGuard` on the `tabs` parent.
- `ActivityPage` also loads `GroupService.getMyGroups()` and shows a "Groups" section above the expense list, plus a people-icon button in the header linking to `/tabs/groups` (both slated for removal once the tab bar makes them redundant).
- The `select-participant` modal has a **person / group `ion-segment`**: "Person" mode is the nickname search (`UserService`), "Group" mode lazy-loads `GroupService.getMyGroups()` and lets you pick one. It emits back through `ParticipantSelectionService` — `selectedParticipant$` (a `User`) or `selectedGroup$` (a `Group`), two plain RxJS `Subject`s. `add-expense` subscribes to both: participants become removable chips, the group becomes a single `primary` chip "Name · N members" (one group max, cleared with the ✕). `group-list`/`group-detail` only use `selectedParticipant$` for member selection.
- `add-expense` has a **"Paid by" `ion-select`** (`add-expense.paid-by`) under the creator row. Its options are `payerCandidates` — creator + selected participants + members of the selected group, deduped — i.e. the same contributor set the backend rebuilds, so the picker can never offer a value the API would reject. The list is recomputed by `refreshPayerCandidates()` on every change to participants/group (not a template getter, to avoid rebuilding the array on each change-detection pass); if the chosen payer is no longer among them (participant or group removed) the selection falls back to the creator. **With only the creator as a candidate** (no participant/group added yet — the common starting state), the template swaps the `ion-select` for a disabled hint row (`add-expense.paid-by-need-participant`) instead of rendering an interactive select with a single, unchangeable option.
- `add-expense` has an optional **category picker**: a chip row of presets + own categories (clicking the selected one deselects it), plus a "+ New" chip that reveals an inline input creating a custom category on the fly and selecting it. `activity` shows the category as a chip inside each expense row.
- Cross-cutting state services in `src/app/services/`: `participant-selection-service.ts` (above), `user.service.ts` / `group.service.ts` / `expense.service.ts` / `category.service.ts` talk to the backend. (`data-sharing.ts` was dead legacy code — deleted 2026-08-30.)
- `Group` model: `src/app/models/group.model.ts` (`{ publicId, name, members: User[] }`). `GroupService` mirrors `UserService` (`environment.apiUrl`, `catchError` → `of([])` on reads); the `authInterceptor` attaches the Bearer token.
- Built with `@angular/build:application` (esbuild-based Angular builder), Ionic CSS utilities imported globally in `project.json`, SCSS as the style language.

**Categories (`splitBack/src/app/category/`)** — full analysis in [`doc/funzionalita_In_Corso/categorie_spese`](doc/funzionalita_In_Corso/categorie_spese):
- One `Category` table with a **nullable `ownerId`**: `null` = preset category, visible to everyone; set = that user's own custom category. Query for "categories I can use" is a single `OR: [{ ownerId: null }, { ownerId: user.id }]`.
- Preset categories carry a `slug` (`food`, `transport`, …) and **no `name`** — the display name is produced by the frontend translating `categories.<slug>`, so no Italian/English text is ever stored in the DB. Custom categories carry a free `name` and no slug.
- Uniqueness is enforced by two constraints, since Postgres treats `NULL`s in a unique index as distinct: `@@unique([ownerId, name])` blocks duplicates within one user's own categories, and `slug @unique` blocks duplicate presets. A user *may* create a custom category with the same name as a preset — that's the intended way to "personalize" one, since presets are immutable.
- **Deletion is soft** (`archived Boolean`): the category leaves the picker but historical expenses keep showing it. Re-creating an archived category by the same name **un-archives** it rather than hitting the unique constraint; creating/renaming onto an already-active name returns `409`.
- Endpoints (all `JwtAuthGuard`, keyed by `publicId`): `GET /api/category` (presets + own, presets first then customs alphabetically), `POST /api/category` (`{ name, icon?, color? }`, always owned by the caller), `PATCH /api/category/:publicId`, `DELETE /api/category/:publicId` (archive). `PATCH`/`DELETE` return `403` on someone else's category *and on presets* (`ownerId !== caller`). `CategoryService.assertUsable` is exported and used by `ExpenseService` to validate `categoryPublicId` (`404` unknown/archived, `403` someone else's).
- Presets are seeded by `splitBack/prisma/seed.ts` (upsert by slug, idempotent) — 10 of them, each with an ionicon name. Frontend: `CATEGORY_ICONS` in `splitFront/src/app/models/category.model.ts` maps those icon names to ionicons SVGs and must be passed to `addIcons()` by every page rendering a category (icon names come from the DB, so Ionic can't tree-shake them from the template). **Adding a preset means touching three places**: `seed.ts`, `CATEGORY_ICONS`, and the `categories.<slug>` key in both `en.json` and `it.json`.
- **Scope cut for the alpha:** the category belongs to the *expense*, not to each participant — on a shared/group expense everyone sees the one the creator picked. Per-user categorization for personal stats is in `TODO.md`. The frontend has no rename/archive UI and no icon/color picker yet, though the endpoints and DB columns exist.

**Balances — who owes whom (`splitFront/src/app/components/expense-balances/` + `src/app/utils/balance.ts`):**
- Entirely **frontend, computed from data already loaded** — there is no balances endpoint. The maths lives in `src/app/utils/balance.ts` as pure functions with no Angular/HTTP dependency (`computeBalances`, `toCents`, `formatCents`); the component only renders their output. `utils/` is a new folder introduced for this: `models/` holds interfaces and `services/` holds injectables, and a dependency-free computation module belongs to neither. Keeping the maths out of the component is what makes it unit-testable once a runner exists, and reusable from `data-access/` if the backend ever needs the same numbers.
- `<app-expense-balances [expenses]>` is **purely presentational**: it takes an already-loaded expense list and does no fetching, so any page holding expenses can drop it in. Inputs are signal-based (`input()` + `computed()`, Angular 20) rather than the `@Input()`/`ngOnChanges` pair used by `group-expenses` — the balances are pure derived state, so recomputation should not be manual. Optional inputs: `userPublicId` (point of view, defaults to the logged-in user via `AuthService`), `titleKey` (i18n key, so each page titles it its own way), `currency`, `showTotals`. It accepts any object shaped like `BalanceExpenseInput` (`paidBy` + `expenseContributions[].share/user`), which `ExpenseListItem` satisfies structurally.
- Wired into `activity` (`[expenses]="expenses"`, i18n `balances.title`), the `balances` tab (full-page), and `group-detail` (fed by `(expensesLoaded)` from `app-group-expenses`, titled `groups.balances-title`).
- **Two calculation decisions that matter:**
  1. A payer's credit is the **sum of the other contributors' `share` values**, never `amount - own share`. Each `share` is rounded to 2 decimals individually (`expense.service.ts`), so `sum(shares) != amount` (10 € across 3 people = 3×3.33 = 9.99); only summing the shares makes credits and debts cancel to zero. The odd cent is silently absorbed by whoever paid — the real fix is the rounding TODO on the backend.
  2. All arithmetic is in **integer cents** (`share`/`amount` arrive as strings, Prisma `Decimal` serialized as JSON), never floats, so summing many expenses can't drift.
- **Scope cut for the alpha — me-centric only.** The component shows the caller's balance with each counterpart and deliberately ignores debts between third parties. That's not a display choice, it's a correctness one: `GET /api/expense` returns only expenses where the caller has an `ExpenseContribution`, so any figure about two *other* people would be computed on a partial dataset. The me-centric view stays provably complete because the payer is always also a contributor — `paidBy` is selectable since 2026-09-06 but the backend rejects a payer outside the contributor set for exactly this reason. Allowing one later means adding an `OR` on `paidById` to `findMine`'s `where` in the same change, otherwise an expense the caller paid but did not contribute to drops out of `findMine` and silently loses a credit.
- **Known limit: there are no settlements.** Nothing in the data model records "Pippo paid me back", so balances accumulate forever and can never be cleared. It can't even be worked around by entering the repayment as an expense: `POST /api/expense` always adds the creator as a contributor and splits equally, so a 15 € repayment nets 7.50 instead of 15 — picking the payer doesn't help, since the payer must itself be a contributor. Closing this needs unequal shares (open TODO), a payer outside the contributor set (see the `POST /api/expense` note above), or a dedicated `Settlement` model — see `TODO.md`.

**Auth (alpha shortcut — `splitBack/src/app/auth/`, `splitFront/src/app/services/auth.*`):**
- Login is **email-only**: `POST /api/auth/login` looks up a `User` by email and, if found, returns a JWT — no password, no confirmation code, no real email is sent. The user must already exist (created via the pre-existing `POST /api/user`); login never creates one.
- `JwtAuthGuard` is a small custom `CanActivate` reading `Authorization: Bearer <token>` directly via `@nestjs/jwt`'s `JwtService` — `@nestjs/passport` was deliberately skipped to keep the dependency footprint minimal, consistent with how light the rest of `splitBack` is.
- Tokens are long-lived (30 days), there is no refresh flow — the `User.refreshToken` schema field remains unused.
- **TODO before beta:** this is only safe because the app is handed to a small set of trusted alpha testers. Before any wider release, replace email-only login with real verification (password and/or a sent confirmation code, reusing the existing `ConfirmationCode` model) and add token refresh/expiry handling.

**Localization (i18n):**
- `splitFront` uses `@ngx-translate` with translation files at `src/assets/i18n/en.json` and `src/assets/i18n/it.json`.
- Any user-facing text shown in HTML templates (pages, components) or via pop-ups/alerts/toasts must be added to **both** `en.json` and `it.json` — never hardcode user-facing strings directly in the template or in TS code.
- Sections so far: `add-expense.*`, `select-participant.*`, `login.*`, `home.*` (still used by `activity`), `tabs.*`, `profile.*`, `groups.*`, `categories.*` (the latter holds both UI labels and one key per preset category slug), `balances.*`. Every component is fully translated (the `select-participant` modal's old hardcoded Italian was converted to `select-participant.*` when the person/group toggle landed).


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