# AGENTS.md — Codebase Guide for Agentic Coding Agents

## Project Overview

Backend API + Telegram bot for a birthday reminder app. Built with:
- **Runtime**: Node.js 20, pure ESM (`"type": "module"` in `package.json`)
- **HTTP framework**: [Hono](https://hono.dev/) with `@hono/node-server`
- **Database**: PostgreSQL 13 via [Kysely](https://kysely.dev/) (type-safe query builder)
- **Validation**: Zod (env config + request validation)
- **Telegram**: grammY bot framework
- **Logging**: Pino + pino-pretty
- **Package manager**: pnpm

---

## Build / Lint / Test Commands

All commands use `pnpm`.

```bash
# Development
pnpm run dev              # Start dev server with hot-reload (tsx watch)
pnpm run build            # Compile TypeScript to ./dist
pnpm run start            # Run compiled app

# Code quality (Biome handles both lint and format)
pnpm run lint             # Lint and auto-fix with Biome
pnpm run format           # Format all files with Biome

# Testing
pnpm run test             # Run all tests (unit + integration, in sequence)
pnpm run test:unit        # Unit tests only (no DB required): vitest run ./src/**
pnpm run test:i           # Integration tests (spins up Docker Postgres automatically)

# Run a single test file
pnpm exec vitest run src/utils/assert.test.ts

# Run a single test by name
pnpm exec vitest run --reporter=verbose -t "your test name here"

# Database
pnpm run db:up            # Start dev Postgres in Docker (port 5666)
pnpm run db:down          # Stop dev Postgres containers
pnpm run db:migrate       # Apply pending migrations
pnpm run db:seed          # Run seeds
pnpm run db:codegen       # Regenerate src/db/types.ts from live DB schema
```

**Integration test lifecycle is automated**: `pretest:i` starts Docker DB + runs migrations + seeds; `posttest:i` tears it down. Requires Docker to be running.

---

## Project Structure

```
src/
  index.ts                # App entry: Hono setup, graceful shutdown
  env.ts                  # Zod-validated env config (single source of truth)
  logger.ts               # Pino logger singleton
  types.ts                # Reserved for global types
  db/
    index.ts              # Kysely DB singleton
    types.ts              # AUTO-GENERATED — do not edit manually
    migrations/           # SQL migrations (NNN_verb_noun.ts)
    repos/                # Raw DB query layer (Kysely queries only)
    seeds/                # Test/dev seed data
    utils/                # DB utility helpers
  middlewares/            # Hono middleware (logger, session, zod validator)
  routers/
    index.ts              # Barrel re-export
    *.route.ts            # Route handlers
  services/               # Business logic layer (calls repos, returns typed results)
  schemas/                # Reserved for Zod schemas
  utils/                  # Generic utilities (assert.ts, etc.)
tests/
  integration/
    setup.ts              # Vitest beforeEach/afterAll lifecycle hooks
```

**Architecture**: `router → service → repo` layered pattern. Keep DB queries in `repos/`, business logic in `services/`.

---

## TypeScript Configuration

- **Target**: ESNext, `moduleResolution: bundler`
- **Path aliases** (use these, not relative paths across layers):
  - `@/*` → `./src/*`
  - `@core/*` → `./src/core/*`
  - `@infra/*` → `./src/infra/*`
- `any` is **banned** by linter — use proper types or `unknown`
- `var` is banned — use `const` (preferred) or `let`
- CommonJS `require()` is banned — use ESM `import`
- TypeScript namespaces are banned

---

## Code Style (enforced by Biome)

**Formatter**:
- 2-space indentation in JS/TS files
- 100-character line width

Run `pnpm run lint` and `pnpm run format` before committing. Biome auto-fixes most issues.

---

## Import Conventions

Order (Biome `organizeImports` auto-sorts within groups):

1. Side-effect imports: `import "dotenv/config"`
2. Node built-ins: `import { readFile } from "node:fs"`
3. Third-party packages: `import { Hono } from "hono"`
4. Internal path-aliased imports: `import { db } from "@/db"`

Use `import type` for type-only imports:
```ts
import type { MiddlewareHandler } from "hono";
import type { DB } from "./types";
```

---

## Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Files | `kebab-case` + descriptive suffix | `health.service.ts`, `logger.middleware.ts` |
| Migration files | `NNN_verb_noun.ts` | `001_create_users.ts` |
| Variables / functions | `camelCase` | `getHealthStatus`, `loggerMiddleware` |
| Types / Interfaces | `PascalCase` | `HealthStatus`, `DB` |
| Singleton exports | `camelCase` | `db`, `logger`, `env` |
| Zod schemas | `camelCase` + `Schema` suffix | `envSchema`, `createUserSchema` |
| Environment variables | `SCREAMING_SNAKE_CASE` | `DB_USER`, `TG_BOT_TOKEN` |
| Database columns | `snake_case` | `birth_day`, `user_id` |

---

## Error Handling Patterns

**Service layer** — return typed result objects, catch and map errors:
```ts
export async function getHealthStatus(): Promise<HealthStatus> {
  try {
    await fetchSomeTable();
    return { status: "ok", db: "ok" };
  } catch {
    return { status: "error", db: "error" };
  }
}
```
Omit the catch binding (`catch` not `catch(e)`) when the error is intentionally ignored.

**Middleware / route layer** — throw `HTTPException` for HTTP errors:
```ts
throw new HTTPException(401, { message: "Unauthorized" });
```

**Global handler** in `src/index.ts` — logs the error with Pino and delegates to `stoker/middlewares`'s `onError`. Do not add per-route try/catch for unhandled exceptions.

**Validation** — use the `zodValidator` middleware wrapper (`src/middlewares/zodValidator.middleware.ts`) for consistent 400 error shapes:
```ts
{ success: false, errors: [{ field: "fieldName", message: "..." }] }
```

**Assertion utility** — use `assert()` from `@/utils/assert` for type-narrowing guards:
```ts
import { assert } from "@/utils/assert";
assert(value !== null, "value must not be null");
```

---

## Type Usage Guidelines

- Define explicit interfaces for all service return types
- Use union string literals for enums: `"ok" | "error"` not `enum`
- Validate env with Zod in `src/env.ts` — never access `process.env` directly in business logic; import `env` from `@/env`
- **Never hand-edit `src/db/types.ts`** — regenerate with `pnpm run db:codegen` after schema changes
- DB types come from `kysely-codegen` auto-generation; always keep them in sync with migrations

---

## Database / Migration Conventions

- Migrations live in `src/db/migrations/` as `NNN_verb_noun.ts`
- Each migration exports `up(db: Kysely<any>)` and `down(db: Kysely<any>)`
- Use Kysely's `sql` tagged template for raw DDL:
```ts
import { sql } from "kysely";
import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE TABLE ...`.execute(db);
}
export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS ...`.execute(db);
}
```
- After adding a migration: `pnpm run db:migrate` then `pnpm run db:codegen`

---

## Singleton Patterns

Shared resources are instantiated once and exported as named singletons. Do not instantiate `Kysely`, `pino`, or env parsing inside functions:

```ts
// db/index.ts
export const db = new Kysely<DB>({ dialect });

// logger.ts
export const logger = pino({ ... });

// env.ts — throws at startup if required vars are missing
export const env = envSchema.parse(process.env);
```

---

## Middleware Pattern

Middlewares are typed with Hono's `MiddlewareHandler` and follow `async (c, next) => { ... await next(); ... }`:

```ts
import type { MiddlewareHandler } from "hono";

export const myMiddleware: MiddlewareHandler = async (c, next) => {
  // before
  await next();
  // after
};
```

Register middlewares and routes by chaining on the Hono app in `src/index.ts`.

---

## Graceful Shutdown

Register cleanup logic in `src/index.ts` against `SIGTERM` and `SIGINT`. Always close the HTTP server before destroying the DB pool:

```ts
const shutdown = async (signal: string) => {
  server.close();
  await db.destroy();
  process.exit(0);
};
```

---

## Testing Guidelines

- **Unit tests**: Co-locate with source files as `*.test.ts` inside `src/`. No DB or Docker required.
- **Integration tests**: Place in `tests/integration/`. Docker must be running. Use the shared `setup.ts` lifecycle hooks — do not add your own `afterAll(db.destroy)`.
- Integration test setup truncates all non-migration tables and re-seeds before each test (clean slate).
- Do not use `@ts-ignore` except in test seed helpers where `Kysely<any>` is unavoidable.
- Prefer `pnpm exec vitest run <file>` to run a specific test file during development.
