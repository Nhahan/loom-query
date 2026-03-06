# LoomQuery Architecture

## 1. Overview

LoomQuery is a privacy-first, local AI document search and knowledge management service built with Next.js 15 (App Router). It follows a **Vertical Slice Architecture** where code is organized by feature rather than by layer, ensuring high cohesion and minimal coupling between features.

**Tech Stack:**
- **Frontend:** Next.js 15 (App Router), React 19, TailwindCSS, shadcn/ui
- **State Management:** Zustand (persisted stores with SSR-safe rehydration)
- **Database:** SQLite via better-sqlite3 (WAL mode, singleton)
- **Vector Store:** ChromaDB (embedded, singleton)
- **Job Queue:** BullMQ + Redis (singleton)
- **AI/RAG:** Mastra (`@mastra/rag`), Vercel AI SDK
- **Testing:** Vitest + React Testing Library (unit/integration), Playwright (E2E)

## 2. Directory Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (Sidebar, Breadcrumb, ErrorBoundary, ToastProvider)
│   ├── page.tsx                  # Dashboard
│   ├── library/                  # Document library feature
│   │   ├── page.tsx
│   │   └── [documentId]/page.tsx
│   ├── uploads/page.tsx          # Upload feature
│   ├── chat/page.tsx             # AI chat feature
│   ├── api-portal/page.tsx       # API portal feature
│   ├── activity/page.tsx         # Activity log feature
│   └── settings/page.tsx         # Settings feature
├── components/
│   ├── ui/                       # shadcn/ui primitives (Button, Card, Dialog, etc.)
│   ├── layout/                   # Layout components (Sidebar, Breadcrumb)
│   │   └── __tests__/            # Co-located layout tests
│   ├── feedback/                 # Feedback components (ErrorBoundary, ErrorDisplay, ProgressBar, ToastProvider)
│   ├── __tests__/                # Co-located component tests
│   ├── EmptyState.tsx            # Shared empty state component
│   └── ClientCTA.tsx             # Client-side CTA button
├── lib/
│   ├── db/
│   │   ├── client.ts             # SQLite singleton (getDb/closeDb)
│   │   ├── schema.ts             # SQL migrations (runMigrations)
│   │   ├── schemas.ts            # Zod schemas + inferred TypeScript types
│   │   ├── repositories/         # Data access layer ({entity}.repo.ts)
│   │   │   ├── document.repo.ts
│   │   │   ├── api-key.repo.ts
│   │   │   ├── activity.repo.ts
│   │   │   ├── feedback.repo.ts
│   │   │   └── settings.repo.ts
│   │   └── __tests__/            # Co-located repository tests
│   ├── mastra.ts                 # Mastra RAG client singleton
│   ├── chroma.ts                 # ChromaDB client singleton
│   ├── redis.ts                  # Redis client singleton (ioredis)
│   ├── redis-config.ts           # Redis configuration (URL parsing, BullMQ ConnectionOptions)
│   ├── queue.ts                  # BullMQ queue/worker factory
│   ├── errors.ts                 # Error codes and AppError class
│   ├── logger.ts                 # Structured JSON logger (stdout)
│   ├── i18n.ts                   # Internationalization (Korean locale)
│   ├── activity-logger.ts        # High-level activity logging facade
│   ├── constants.ts              # Application constants
│   ├── utils.ts                  # Utility functions (cn for classnames)
│   └── __tests__/                # Co-located lib tests
├── store/
│   └── index.ts                  # Zustand stores (useSidebarStore, useThemeStore)
├── messages/
│   └── ko.json                   # Korean i18n messages
├── instrumentation.ts            # Next.js instrumentation (graceful shutdown)
└── test-setup.ts                 # Vitest setup (jest-dom, React act environment)
```

## 3. Key Architectural Patterns

### Singleton Services
All external service clients (SQLite, Redis, ChromaDB, Mastra) use the singleton pattern with lazy initialization. Each singleton module exports:
- `get{Service}()` — returns or creates the singleton instance
- `close{Service}()` — tears down the instance for graceful shutdown

Graceful shutdown is wired via `src/instrumentation.ts` using Next.js instrumentation hooks.

### Repository Pattern
Database access is encapsulated in repository files (`src/lib/db/repositories/{entity}.repo.ts`). Each repository:
- Imports `getDb()` from the singleton client
- Validates input/output with Zod schemas from `schemas.ts`
- Exports functions following `create/get/list/update/delete` naming

### Zod-First Type Safety
All external data is validated with Zod schemas defined in `src/lib/db/schemas.ts`. TypeScript types are inferred from schemas using `z.infer<typeof Schema>`, ensuring runtime validation and compile-time type safety are always in sync.

### Error Handling
- `AppError` class with typed `ErrorCode` enum
- `ErrorBoundary` component for React error recovery
- `ErrorDisplay` component for structured error presentation
- Structured JSON logging via `logger.ts`

### State Management
Zustand stores with `persist` middleware and `skipHydration: true` for SSR-safe rehydration. Stores are rehydrated once on client mount in the Sidebar component.

## 4. Testing Strategy

| Layer                    | Tool                        | Location                           |
|--------------------------|-----------------------------|------------------------------------|
| Sync Components          | Vitest + RTL                | `src/components/__tests__/`        |
| Layout Components        | Vitest + RTL                | `src/components/layout/__tests__/` |
| Repository Functions     | Vitest (in-memory SQLite)   | `src/lib/db/__tests__/`            |
| Singleton Lifecycle      | Vitest                      | `src/lib/__tests__/`               |
| E2E User Flows           | Playwright                  | `tests/e2e/`                       |

Tests are co-located with their source in `__tests__/` directories. Repository tests use in-memory SQLite databases to avoid filesystem dependencies.

## 5. Deployment

LoomQuery is designed for Docker Compose-based self-hosting (local/on-premises). All data stays on the user's infrastructure -- no cloud data transmission.

Required services:
- **Redis** — job queue backend (BullMQ)
- **ChromaDB** — vector storage for RAG
- **SQLite** — application database (file-based, WAL mode)

Configuration is via environment variables:
- `REDIS_URL` (default: `redis://localhost:6379`)
- `CHROMA_URL` (default: `http://localhost:8000`)
