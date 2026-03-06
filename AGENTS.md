# LoomQuery Agent Instructions

## Project Context
LoomQuery is a privacy-first local RAG knowledge management service.
Primary users: non-developers (knowledge managers, team leaders).
Tech: Next.js 15 App Router + Mastra + ChromaDB + Redis + BullMQ.

## Agent-Specific Rules

### executor / deep-executor
- Always generate TypeScript with strict types
- Follow Vertical Slice Architecture: `src/features/{name}/`
- Use Zod schemas as single source of truth for data shapes
- Check `src/lib/` for existing singletons before creating new ones
- Max 300 lines per file

### test-engineer
- Write tests through public interfaces, not implementation details
- Integration tests > unit tests for API routes
- Use Vitest for sync components, Playwright for async Server Components
- Test file naming: `{feature}.test.ts` or `{feature}.spec.ts`

### verifier
- Run `pnpm build && pnpm test` and capture output as evidence
- Check for TypeScript errors: `pnpm typecheck`
- Verify Zod schemas match API responses
- Check that no `any` types exist in changed files

### designer
- Use shadcn/ui components exclusively
- Follow plan.md screen specifications
- Korean UI text with i18n key structure
- Dark mode support via TailwindCSS `dark:` classes
- Accessibility: WCAG 2.1 AA compliance

### build-fixer
- Fix TypeScript strict mode errors without relaxing strictness
- Never add `@ts-ignore` or `@ts-expect-error`
- Never change `strict: true` to `false`

### security-reviewer
- Check all API routes for authentication
- Verify Zod validation on all external inputs
- Check for SQL/NoSQL injection in ChromaDB queries
- Verify API key handling (no plaintext storage)
