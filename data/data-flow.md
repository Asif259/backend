# Data Flow

## 1. Overview

Data flows through a standard SPA architecture:

1. **Frontend** (Next.js App Router, client-side React) — user interaction, form state, API calls.
2. **API Client** (`apiClient` fetch wrapper) — attaches JWT Bearer token, sends JSON to the backend.
3. **Backend** (NestJS REST API) — validates input via DTOs, authenticates via JWT guard, performs business logic, queries/mutates the database.
4. **Database** (PostgreSQL via TypeORM) — persists users, links, and clicks.
5. **Response** — JSON flows back through the same chain to the UI.

There are no WebSocket connections, no server-sent events, no background jobs, no message queues, and no external third-party service integrations in the current implementation.

---

## 2. System-Level Data Flow

```mermaid
flowchart TD
    A["User (Browser)"] -->|"Interact"| B["Next.js Frontend\n(React, port 3001)"]
    B -->|"State"| C["Zustand Store\n(auth.store.ts)"]
    C -->|"JWT from localStorage"| D["apiClient\n(fetch wrapper)"]
    D -->|"HTTP + Bearer JWT"| E["NestJS API\n(port 3000)"]
    E -->|"ValidationPipe"| F["DTOs\n(class-validator)"]
    F -->|"JwtAuthGuard"| G["JwtStrategy\n(passport-jwt)"]
    G -->|"findById(sub)"| H["UsersService"]
    H -->|"TypeORM query"| I["PostgreSQL\n(port 5433)"]
    E -->|"Service layer"| J["LinksService /\nAnalyticsService"]
    J -->|"TypeORM query"| I
    I -->|"Query result"| J
    J -->|"JSON response"| E
    E -->|"HTTP response"| D
    D -->|"Parsed JSON"| B
    B -->|"Re-render"| A

    K["Visitor"] -->|"GET /:shortCode"| E
    E -->|"findByShortCode"| J
    J -->|"TypeORM query"| I
    I -->|"Link row"| J
    J -->|"302 Redirect"| K
```

---

## 3. Authentication Flow

### Registration

```mermaid
flowchart TD
    A["Register Page\n(/register)"] -->|"name, email, password"| B["useAuthStore.register()"]
    B -->|"POST /auth/register\n{name, email, password}"| C["AuthController.register()"]
    C -->|"RegisterDto validation\n(name ≥2 chars, valid email,\npassword ≥8 chars,\nemail trimmed+lowercased)"| D["AuthService.register()"]
    D -->|"findByEmail(email)"| E["UsersService"]
    E -->|"SELECT ... WHERE email = ?"| F["PostgreSQL"]
    F -->|"null (no existing user)"| D
    D -->|"bcrypt.hash(password, 10)"| D
    D -->|"createUser({name, email, passwordHash})"| E
    E -->|"INSERT INTO users"| F
    F -->|"New user row"| D
    D -->|"{ message, user: {id, name, email} }"| C
    C -->|"201 Created"| B

    B -->|"Auto-login after register"| G["useAuthStore.login()"]
    G -->|"POST /auth/login\n{email, password}"| H["AuthService.login()"]
    H -->|"bcrypt.compare → JWT sign"| I["{ accessToken, user }"]
    I -->|"200 OK"| G
    G -->|"Set Zustand state:\nuser, accessToken,\nisAuthenticated=true"| J["Persist to localStorage\n(key: linkly-auth)"]
    J -->|"router.replace('/dashboard')"| K["Dashboard"]
```

**Source:** [`frontend/src/app/register/page.tsx`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/frontend/src/app/register/page.tsx) lines 26–37

### Login

```mermaid
flowchart TD
    A["Login Page\n(/login)"] -->|"email, password"| B["useAuthStore.login()"]
    B -->|"POST /auth/login\n{email, password}"| C["AuthController.login()"]
    C -->|"LoginDto validation\n(email trimmed+lowercased)"| D["AuthService.login()"]
    D -->|"findByEmail(email)"| E["UsersService"]
    E -->|"SELECT ... WHERE email = ?"| F["PostgreSQL"]
    F -->|"User row or null"| D
    D -->|"bcrypt.compare(password, hash)"| D
    D -->|"jwtService.signAsync({sub: user.id})"| D
    D -->|"{ accessToken, user: {id, name, email} }"| C
    C -->|"200 OK"| B
    B -->|"Zustand setState:\nuser, accessToken,\nisAuthenticated=true"| G["Persist to localStorage"]
    G -->|"router.replace('/dashboard')"| H["Dashboard"]
```

**Source:** [`frontend/src/app/login/page.tsx`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/frontend/src/app/login/page.tsx) lines 25–34

### JWT Validation (per protected request)

```
1. apiClient reads accessToken from localStorage['linkly-auth'].state.accessToken
2. Attaches header: Authorization: Bearer <token>
3. NestJS JwtAuthGuard triggers JwtStrategy
4. JwtStrategy extracts + verifies JWT (HS256, checks expiry)
5. JwtStrategy.validate() calls UsersService.findById(payload.sub)
6. If user exists → sets request.user = safeUser (without passwordHash)
7. If user not found → throws UnauthorizedException
```

### Logout

```
1. User clicks logout (in Sidebar component)
2. useAuthStore.logout() → clears user, accessToken, isAuthenticated
3. Zustand persist removes token from localStorage
4. DashboardLayout detects isAuthenticated=false → router.replace('/login')
```

No server-side logout. No token invalidation.

---

## 4. Create Data Flow

### Create Short Link

```mermaid
flowchart TD
    A["CreateLinkDialog\n(frontend component)"] -->|"originalUrl, shortCode?"| B["createLink()\n(lib/api/links.ts)"]
    B -->|"POST /links\n{originalUrl, shortCode?}"| C["LinksController.create()"]
    C -->|"@UseGuards(JwtAuthGuard)\n@CurrentUser() → user.id"| D["LinksService.create(userId, dto)"]

    D -->|"Custom code provided?"| E{shortCode?}
    E -->|"Yes"| F["findOne({shortCode})\nCheck uniqueness"]
    E -->|"No"| G["generateShortCode()\n7-char random, retry ≤10"]

    F -->|"Conflict"| H["409 ConflictException"]
    F -->|"Available"| I["repository.create({userId, shortCode, originalUrl})"]
    G -->|"Generated"| I

    I -->|"repository.save(link)"| J["INSERT INTO links"]
    J -->|"Saved row"| K["toResponse(link, 0, 'active')"]
    K -->|"201 { id, userId, shortCode,\noriginalUrl, clickCount: 0,\nstatus: 'active', ... }"| C
    C -->|"Response"| B
    B -->|"New link object"| A
    A -->|"Prepend to local links state"| L["UI updated"]
```

**Source:** [`links.service.ts`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/backend/src/links/links.service.ts) lines 43–69, [`CreateLinkDialog.tsx`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/frontend/src/components/dashboard/CreateLinkDialog.tsx)

### Create Click (NOT IMPLEMENTED)

The `RedirectController.redirect()` at [`redirect.controller.ts`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/backend/src/links/redirect.controller.ts) performs a `302` redirect but **does not** create a `Click` record. The `clicks` table is never written to by any current code path. This means all analytics data will be empty.

---

## 5. Read Data Flow

### List Links (Links Page)

```mermaid
flowchart TD
    A["LinksPage\n(/dashboard/links)"] -->|"On mount + search/filter change"| B["getLinks({search, status, sort})\n(lib/api/links.ts)"]
    B -->|"GET /links?search=...&sort=..."| C["LinksController.findAll()"]
    C -->|"JwtAuthGuard → user.id"| D["LinksService.findAllByUser(userId, params)"]
    D -->|"QueryBuilder:\nLEFT JOIN clicks\nSELECT COUNT(click.id) as clickCount\nWHERE user_id = :userId\nGROUP BY link.id\nORDER BY (sort)\nLIMIT/OFFSET"| E["PostgreSQL"]
    E -->|"Raw + Entity results"| D
    D -->|"Map to LinkWithClickCount[]\n(clickCount + status:'active')"| C
    C -->|"JSON array"| B
    B -->|"setLinks(data)"| A
    A -->|"Client-side status filter\n(status not persisted)"| F["Render LinksTableRow[]"]
```

**Source:** [`links/page.tsx`](file:///Users/ashrafulasif/My%20projects/Link-Shortner/frontend/src/app/dashboard/links/page.tsx) lines 31–47

### Dashboard Analytics (MOCK DATA)

The main dashboard page (`/dashboard/page.tsx`) imports `mockDashboardData` from `frontend/src/lib/mock-dashboard-data.ts` and passes it directly to all chart/stat components. **No API calls are made.** The analytics API endpoints exist in the backend and the frontend API layer (`lib/api/analytics.ts`) but they are not used on the dashboard page.

### Analytics API Endpoints (Backend implemented, not wired to dashboard UI)

```
GET /links/:id/analytics           → AnalyticsService.getSummary()
GET /links/:id/analytics/timeline  → AnalyticsService.getTimeline()
GET /links/:id/analytics/devices   → AnalyticsService.getDevices()
GET /links/:id/analytics/browsers  → AnalyticsService.getBrowsers()
GET /links/:id/analytics/referrers → AnalyticsService.getReferrers()
GET /links/:id/analytics/countries → AnalyticsService.getCountries()
```

Each endpoint validates link ownership then runs aggregate queries against the `clicks` table.

---

## 6. Update Data Flow

### Update Link

```mermaid
flowchart TD
    A["EditLinkDialog\n(frontend component)"] -->|"originalUrl?, shortCode?"| B["updateLink(id, data)\n(lib/api/links.ts)"]
    B -->|"PATCH /links/:id\n{originalUrl?, shortCode?, status?}"| C["LinksController.update()"]
    C -->|"JwtAuthGuard → user.id"| D["LinksService.update(id, userId, dto)"]
    D -->|"findOne({id})"| E["PostgreSQL"]
    E -->|"Link row"| D
    D -->|"Ownership check:\nlink.userId !== userId?"| F{Authorized?}
    F -->|"No"| G["403 ForbiddenException"]
    F -->|"Yes"| H["Apply changes:\nshortCode? → uniqueness check\noriginalUrl? → update field"]
    H -->|"repository.save(link)"| I["UPDATE links SET ..."]
    I -->|"Fresh clickCount query"| J["SELECT COUNT(click.id)"]
    J -->|"toResponse(link, count, status)"| C
    C -->|"Updated link JSON"| B
    B -->|"Replace in local state"| A
```

**Note on `status`:** The `UpdateLinkDto` accepts `status: 'active' | 'disabled'` and the service passes it to `toResponse()`, but `status` is **not persisted** — there is no `status` column in the `links` table. The returned status is whatever was passed in the DTO (or defaults to `'active'`).

---

## 7. Delete Flow

### Delete Link

```mermaid
flowchart TD
    A["LinksPage"] -->|"First click: set deleteConfirm"| B["Toast: 'Click delete again to confirm'"]
    B -->|"Second click within 3s"| C["deleteLink(id)\n(lib/api/links.ts)"]
    C -->|"DELETE /links/:id"| D["LinksController.remove()"]
    D -->|"JwtAuthGuard → user.id"| E["LinksService.remove(id, userId)"]
    E -->|"findOne({id})"| F["PostgreSQL"]
    F -->|"Link row"| E
    E -->|"Ownership check"| G{Authorized?}
    G -->|"No"| H["403 ForbiddenException"]
    G -->|"Yes"| I["repository.remove(link)"]
    I -->|"DELETE FROM links WHERE id = ?\n(CASCADE → deletes all clicks)"| F
    I -->|"{ success: true }"| D
    D -->|"200 OK"| C
    C -->|"Filter out from local state"| A
```

**Hard delete only.** No soft-delete, no trash, no recovery.

---

## 8. External Services

No external service integrations were verified. Specifically:

- No email service (no verification emails, no password reset emails).
- No analytics services (e.g., Google Analytics, Mixpanel).
- No payment/billing services.
- No IP geolocation API (the `country` field on `clicks` is defined but never populated).
- No user-agent parsing library (the `device`, `browser` fields on `clicks` are defined but never populated).

---

## 9. File / Storage Flow

No file upload, download, or object storage flows exist in this project. All data is text-based and stored in PostgreSQL.

---

## 10. Realtime / Background Flow

No realtime or background processing mechanisms were found:

- No WebSocket connections.
- No Server-Sent Events.
- No message queues (Bull, RabbitMQ, etc.).
- No cron jobs or scheduled tasks.
- No background workers.
- No webhooks (inbound or outbound).

All operations are synchronous request-response.

---

## 11. Security Boundaries

```mermaid
flowchart TD
    subgraph Public["Public (no auth)"]
        P1["POST /auth/register"]
        P2["POST /auth/login"]
        P3["GET /:shortCode (redirect)"]
    end

    subgraph Protected["JWT Protected"]
        A1["GET /links"]
        A2["POST /links"]
        A3["GET /links/:id"]
        A4["PATCH /links/:id"]
        A5["DELETE /links/:id"]
        A6["GET /links/:id/analytics"]
        A7["GET /links/:id/analytics/timeline"]
        A8["GET /links/:id/analytics/devices"]
        A9["GET /links/:id/analytics/browsers"]
        A10["GET /links/:id/analytics/referrers"]
        A11["GET /links/:id/analytics/countries"]
    end

    subgraph OwnershipCheck["+ Ownership Verification"]
        A3
        A4
        A5
        A6
        A7
        A8
        A9
        A10
        A11
    end
```

**Boundary details:**

| Boundary | Where applied | Mechanism |
|----------|--------------|-----------|
| CORS | `main.ts` | `app.enableCors({ origin: FRONTEND_URL, credentials: true })` |
| Input validation | Global | `ValidationPipe` (whitelist, forbidNonWhitelisted, transform) |
| Authentication | Controller-level | `@UseGuards(JwtAuthGuard)` on LinksController, AnalyticsController |
| Authorization (ownership) | Service-level | `link.userId !== userId` → `ForbiddenException` |
| Password stripping | Strategy-level | `JwtStrategy.validate()` removes `passwordHash` |

**No rate limiting** is applied at any boundary.

---

## 12. Important Data Transformations

### Backend input transformations

| Transform | Location | Detail |
|-----------|----------|--------|
| Email normalization | `RegisterDto`, `LoginDto` | `@Transform` trims whitespace and lowercases email |
| Password hashing | `AuthService.register()` | `bcrypt.hash(password, 10)` before storage |
| Short code generation | `LinksService.create()` | Auto-generates 7-char alphanumeric if not provided |

### Backend output transformations

| Transform | Location | Detail |
|-----------|----------|--------|
| Password stripping | `JwtStrategy.validate()` | `const { passwordHash: _, ...safeUser } = user` |
| Click count computation | `LinksService.findAllByUser()`, `findOne()` | `LEFT JOIN clicks` + `COUNT(click.id)::int as clickCount` |
| Virtual status field | `LinksService.toResponse()` | Always adds `status: 'active'` (not from DB) |
| Analytics grouping | `AnalyticsService.*()` | `GROUP BY` with `COALESCE(..., 'Unknown')` for null handling |
| Date formatting | `AnalyticsService.getTimeline()` | `TO_CHAR(timestamp, 'YYYY-MM-DD')` for daily grouping |
| Cast to int | Various analytics queries | `COUNT(*)::int` to ensure numeric (not bigint string) return |

### Frontend input transformations

| Transform | Location | Detail |
|-----------|----------|--------|
| User initials | `Header.tsx` | Splits `user.name`, takes first letter of each word, uppercased, max 2 chars |
| Display name | `Header.tsx` | First word of `user.name`, or email prefix before `@` |

### Frontend output transformations

| Transform | Location | Detail |
|-----------|----------|--------|
| Short URL display | `LinksPage`, `LinksTableRow` | Concatenates `NEXT_PUBLIC_SHORT_URL` + `/${link.shortCode}` |
| Search debounce | `LinksPage` | 300ms `setTimeout` before firing search API call |

---

## 13. Unknown / Unverified Flows

1. **Click recording on redirect** — not implemented. `RedirectController` does not create `Click` records. The entire write path to the `clicks` table is absent.
2. **`POST /links/:id/disable`** — called by `frontend/src/lib/api/links.ts` `disableLink()` function, but this backend endpoint does not exist. The function appears to be dead code; the LinksPage uses `updateLink()` with `{ status }` instead.
3. **Analytics dashboard wiring** — `frontend/src/lib/api/analytics.ts` defines all API call functions, but the dashboard page (`/dashboard/page.tsx`) uses `mockDashboardData` instead. The real analytics API is not consumed by the UI.
4. **User-agent parsing** — the `clicks` entity has `device` and `browser` fields, but no user-agent parsing library (e.g., `ua-parser-js`) is installed or used anywhere.
5. **IP geolocation** — the `clicks` entity has a `country` field, but no geolocation service or library is installed or used.
6. **Logout data flow** — the Sidebar component triggers logout, but the Sidebar component's source was not inspected in detail. The store's `logout()` method clears state; the `DashboardLayout` redirect on `isAuthenticated=false` was verified.
7. **Password reset flow** — does not exist.
