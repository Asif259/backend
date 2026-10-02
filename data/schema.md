# Data Schema

## 1. Overview

Linkly is a URL shortener with an analytics dashboard. The data architecture consists of three core entities stored in a PostgreSQL database: **users**, **links**, and **clicks**. Users authenticate with email/password (JWT), create short links, and view click analytics per link. The backend (NestJS + TypeORM) exposes a REST API consumed by a Next.js frontend.

The database schema is managed via TypeORM migrations with `synchronize: false`.

---

## 2. Data Storage Technology

| Technology | Purpose | Version |
|-----------|---------|---------|
| PostgreSQL | Primary relational database | 17 (Docker image: `postgres:17`) |
| TypeORM | ORM and migration management | ^1.1.1 |
| Docker Compose | Database container orchestration | — |
| localStorage (browser) | JWT token persistence (Zustand persist, key: `linkly-auth`) | — |

**Connection details (local dev):**
- Host: `localhost`
- Port: `5433` (Docker maps host 5433 → container 5432)
- Database: `link_shortener`
- User: `postgres` / Password: `postgres`

Source: [`backend/.env`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/backend/.env), [`docker-compose.yml`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/docker-compose.yml)

---

## 3. Entities / Tables

### users

**Purpose:** Stores registered user accounts with hashed passwords.

**Source:** [`backend/src/users/entities/user.entity.ts`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/backend/src/users/entities/user.entity.ts)

**Fields:**

| Field | DB Column | Type | Required | Default | Description |
|-------|-----------|------|----------|---------|-------------|
| `id` | `id` | `uuid` | Yes | `uuid_generate_v4()` | Primary key |
| `name` | `name` | `varchar(255)` | Yes | — | User's display name |
| `email` | `email` | `varchar(255)` | Yes | — | User's email address (login credential) |
| `passwordHash` | `password_hash` | `varchar(255)` | Yes | — | bcrypt-hashed password (10 salt rounds) |
| `createdAt` | `created_at` | `timestamptz` | Yes | `now()` | Account creation timestamp |
| `updatedAt` | `updated_at` | `timestamptz` | Yes | `now()` | Last update timestamp |

**Primary Key:** `id` (uuid)

**Foreign Keys:** None (root entity)

**Unique Constraints:**
- `email` — `CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`

**Indexes:** None beyond the PK and unique constraint (verified from migration).

**Relations:**
- `links` — `@OneToMany('Link', (link) => link.user)` — one user has many links

**Security / Access Notes:**
- `passwordHash` is **never** returned in API responses. `JwtStrategy.validate()` strips it via destructuring (`const { passwordHash: _, ...safeUser } = user`).
- The `CurrentUser` decorator returns `Omit<User, 'passwordHash'>`.

---

### links

**Purpose:** Stores shortened URL mappings owned by individual users.

**Source:** [`backend/src/links/entities/link.entity.ts`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/backend/src/links/entities/link.entity.ts)

**Fields:**

| Field | DB Column | Type | Required | Default | Description |
|-------|-----------|------|----------|---------|-------------|
| `id` | `id` | `uuid` | Yes | `uuid_generate_v4()` | Primary key |
| `userId` | `user_id` | `uuid` | Yes | — | Owner of the link |
| `shortCode` | `short_code` | `varchar(50)` | Yes | — | The unique short URL slug (e.g., `abc1234`) |
| `originalUrl` | `original_url` | `text` | Yes | — | The destination URL to redirect to |
| `createdAt` | `created_at` | `timestamptz` | Yes | `now()` | Link creation timestamp |
| `updatedAt` | `updated_at` | `timestamptz` | Yes | `now()` | Last update timestamp |

**Primary Key:** `id` (uuid)

**Foreign Keys:**
- `user_id` → `users(id)` — `ON DELETE CASCADE`, `ON UPDATE NO ACTION`
  - Constraint: `FK_9f8dea86e48a7216c4f5369c1e4`

**Unique Constraints:**
- `short_code` — `CONSTRAINT "UQ_e310b9137c352dac8806d5ccbd7" UNIQUE ("short_code")`

**Indexes:**
- `idx_links_short_code` — unique index on `short_code` (for fast redirect lookup)
- `idx_links_user_id` — index on `user_id` (for fast per-user listing)

**Relations:**
- `user` — `@ManyToOne('User', (user) => user.links, { onDelete: 'CASCADE' })` — belongs to one user
- `clicks` — `@OneToMany('Click', (click) => click.link)` — one link has many clicks

**Important notes:**
- Short codes are 7-character alphanumeric strings by default, generated via `Math.random()`.
- Custom short codes are allowed (3–50 chars, pattern: `[a-zA-Z0-9_-]+`).
- There is **no `status` column** in the database. The `UpdateLinkDto` accepts a `status` field (`'active' | 'disabled'`) but it is not persisted. The service always returns `status: 'active'` as a virtual field.

---

### clicks

**Purpose:** Records individual click events on short links for analytics.

**Source:** [`backend/src/analytics/entities/click.entity.ts`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/backend/src/analytics/entities/click.entity.ts)

**Fields:**

| Field | DB Column | Type | Required | Default | Description |
|-------|-----------|------|----------|---------|-------------|
| `id` | `id` | `uuid` | Yes | `uuid_generate_v4()` | Primary key |
| `linkId` | `link_id` | `uuid` | Yes | — | The link that was clicked |
| `timestamp` | `timestamp` | `timestamptz` | Yes | `now()` | When the click occurred |
| `ipAddress` | `ip_address` | `varchar(45)` | No | `null` | Visitor's IP address |
| `userAgent` | `user_agent` | `text` | No | `null` | Raw user-agent string |
| `referrer` | `referrer` | `text` | No | `null` | HTTP referrer |
| `device` | `device` | `varchar(50)` | No | `null` | Parsed device type (e.g., "Mobile", "Desktop") |
| `browser` | `browser` | `varchar(50)` | No | `null` | Parsed browser name (e.g., "Chrome", "Safari") |
| `country` | `country` | `varchar(100)` | No | `null` | Visitor's country |

**Primary Key:** `id` (uuid)

**Foreign Keys:**
- `link_id` → `links(id)` — `ON DELETE CASCADE`, `ON UPDATE NO ACTION`
  - Constraint: `FK_3e477bfbdf3a572363b65bc4525`

**Unique Constraints:** None

**Indexes:**
- `idx_clicks_link_id` — index on `link_id`
- `idx_clicks_link_id_timestamp` — composite index on `(link_id, timestamp)` for time-range analytics queries

**Relations:**
- `link` — `@ManyToOne('Link', (link) => link.clicks, { onDelete: 'CASCADE' })` — belongs to one link

**Important schema discrepancy:**
The initial migration (`1790786897488-CreateInitialEntities.ts`) creates the `clicks` table with only: `id`, `link_id`, `timestamp`, `ip_address`, `user_agent`, `referrer`. The columns `device`, `browser`, and `country` exist in the TypeORM entity definition but are **absent from the migration SQL**. If migrations are the only schema source (as `synchronize: false` enforces), these three columns do not exist in the actual database.

---

## 4. Authentication Data

| Aspect | Implementation |
|--------|---------------|
| **Identity** | Email + password stored in `users` table |
| **Password storage** | bcrypt hash (10 salt rounds) in `users.password_hash` |
| **Token type** | JWT (HS256) |
| **Token payload** | `{ sub: user.id }` (only the user UUID) |
| **Token lifetime** | Configurable via `JWT_EXPIRES_IN` env var (default: `1d`) |
| **Token transport** | `Authorization: Bearer <token>` header |
| **Client storage** | Browser `localStorage` under key `linkly-auth` (Zustand persist) |
| **Refresh tokens** | Not implemented |
| **Email verification** | Not implemented |

**Source files:**
- [`backend/src/auth/auth.service.ts`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/backend/src/auth/auth.service.ts)
- [`backend/src/auth/strategies/jwt.strategy.ts`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/backend/src/auth/strategies/jwt.strategy.ts)
- [`frontend/src/lib/stores/auth.store.ts`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/frontend/src/lib/stores/auth.store.ts)

---

## 5. Security

### Backend validation
- Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true` strips unknown fields from all request bodies.
- DTOs use `class-validator` decorators for input validation.
- Source: [`backend/src/main.ts`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/backend/src/main.ts)

### Route protection
- `JwtAuthGuard` (Passport `AuthGuard('jwt')`) protects all `/links` and `/links/:id/analytics/**` endpoints.
- Public endpoints: `POST /auth/register`, `POST /auth/login`, `GET /:shortCode` (redirect).

### Resource-level authorization
- Ownership checks are performed in service methods, not guards.
- `LinksService`: every method compares `link.userId !== userId` and throws `ForbiddenException` on mismatch.
- `AnalyticsService.validateLinkOwnership()`: verifies link exists and belongs to the requesting user.

### CORS
- Configured in `main.ts`: `origin: process.env.FRONTEND_URL || 'http://localhost:3001'`, `credentials: true`.

### No RLS
- PostgreSQL Row-Level Security is **not configured**. Authorization is application-level only.

### No rate limiting
- No throttling middleware is configured on any endpoint.

---

## 6. Storage / Files

No file storage, object storage, or bucket configuration was found in this project. All data is stored in PostgreSQL.

---

## 7. Database Functions / Triggers

No custom PostgreSQL functions, triggers, or stored procedures were found. The project uses only TypeORM entities and query builder for all data operations.

The `uuid_generate_v4()` function is used for primary key generation (requires the `uuid-ossp` PostgreSQL extension or built-in `gen_random_uuid()` depending on the PostgreSQL version).

---

## 8. Important Constraints

1. **Email uniqueness** — enforced at the database level via unique constraint on `users.email`.
2. **Short code uniqueness** — enforced at the database level via unique constraint + unique index on `links.short_code`.
3. **Cascade deletes:**
   - Deleting a user cascades to all their links.
   - Deleting a link cascades to all its clicks.
4. **No soft deletes** — all deletions are hard deletes via `repository.remove()`.
5. **Password minimum length** — enforced by `RegisterDto`: `@MinLength(8)` (backend). The frontend register form UI label says "min 6 chars" and uses `minLength={6}`, creating a discrepancy with the backend's 8-character minimum.
6. **Email normalization** — `RegisterDto` and `LoginDto` both `@Transform` email to `trim().toLowerCase()`.
7. **Short code format** — must match `^[a-zA-Z0-9_-]+$`, length 3–50 characters (enforced by `CreateLinkDto` and `UpdateLinkDto`).

---

## 9. Unknown / Unverified Information

1. **`device`, `browser`, `country` columns in `clicks`** — defined in the TypeORM entity but absent from the migration SQL. Whether these columns actually exist in any running database instance cannot be verified from source alone.
2. **`typeorm_metadata` table** — TypeORM may create this automatically; not documented or migration-controlled.
3. **Node.js engine version** — not specified in either `package.json`.
4. **Whether the `uuid-ossp` PostgreSQL extension is pre-installed** — `uuid_generate_v4()` is used in migrations; this may rely on PostgreSQL 13+ built-in support or a manually-enabled extension. Not verified.
5. **E2E test data setup** — `backend/test/` directory exists but contents were not inspected.
