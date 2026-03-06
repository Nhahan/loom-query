# LoomQuery Development Rules

## Tech Stack
- Next.js 15 (App Router only, NO Pages Router)
- TypeScript strict mode
- TailwindCSS + shadcn/ui
- Mastra (`@mastra/rag`) for RAG
- ChromaDB (embedded) for vector storage
- BullMQ + Redis for job queue
- Vercel AI SDK (`ai`) for LLM streaming
- Vitest + React Testing Library (unit/integration)
- Playwright (E2E)

## Architecture: Vertical Slice
- Organize code by feature, NOT by layer
- Each feature: `src/features/{name}/` with components, actions, api, schema, __tests__
- Shared utilities: `src/lib/` (mastra.ts, chroma.ts, redis.ts)
- Shared UI components: `src/components/ui/` (shadcn/ui)

## TDD (Mandatory)
- ALWAYS write tests BEFORE implementation
- NEVER write production code without a failing test first
- Red-Green-Refactor cycle for every feature
- Run `pnpm test` after every implementation change
- Run `pnpm build` to verify TypeScript compilation

## Type Safety
- TypeScript strict mode is non-negotiable
- All external data validated with Zod schemas
- Define Zod schemas BEFORE implementing functions
- Infer TypeScript types from Zod: `z.infer<typeof Schema>`
- Never use `any` type

## Testing Strategy
- Sync Server Components + Client Components → Vitest + RTL
- Async Server Components → Playwright E2E only
- API Route Handlers → Vitest integration tests
- Server Actions → Vitest integration + Playwright E2E
- Target 80%+ meaningful coverage

## Singletons
- Mastra client: `src/lib/mastra.ts` (singleton, do NOT re-initialize)
- ChromaDB client: `src/lib/chroma.ts` (singleton)
- Redis connection: `src/lib/redis.ts` (singleton)

## Code Style
- Max file size: 300 lines (split if larger)
- Korean UI text: use i18n message keys from day one
- No console.log in production code (use structured logger)
- Prefer Server Components by default, Client Components only when needed

## Commands
- `pnpm dev` - development server
- `pnpm build` - production build
- `pnpm test` - run Vitest tests
- `pnpm test:e2e` - run Playwright E2E tests
- `pnpm lint` - ESLint
- `pnpm typecheck` - tsc --noEmit
