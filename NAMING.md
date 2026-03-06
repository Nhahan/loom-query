# LoomQuery Naming Conventions

This document describes the naming conventions used throughout the LoomQuery codebase. All contributors should follow these rules to maintain consistency.

## 1. Files & Directories

| Category          | Convention                  | Example                        |
|-------------------|-----------------------------|--------------------------------|
| Components        | PascalCase                  | `EmptyState.tsx`, `Sidebar.tsx`|
| UI primitives     | PascalCase                  | `Button.tsx`, `Card.tsx`       |
| Repositories      | kebab-case + `.repo.ts`     | `document.repo.ts`             |
| Lib modules       | kebab-case                  | `redis-config.ts`, `activity-logger.ts` |
| Test files        | kebab-case + `.test.tsx`    | `error-boundary.test.tsx`      |
| E2E tests         | kebab-case + `.spec.ts`     | `sidebar-hydration.spec.ts`    |
| Zod schemas       | `schemas.ts` (centralized)  | `src/lib/db/schemas.ts`        |
| SQL migrations    | `schema.ts`                 | `src/lib/db/schema.ts`         |

## 2. Types & Interfaces

### Rules
- **No I-prefix** for interfaces: `SidebarState`, not `ISidebarState`
- **Descriptive union type names**: `DocumentStatus`, not `DocStatus`
- **Zod schema names match type names**: `DocumentSchema` -> `Document`
- **Create variants prefixed with `Create`**: `CreateDocumentSchema` -> `CreateDocument`
- **Props interfaces suffixed with `Props`**: `EmptyStateProps`, `ErrorDisplayProps`

### Examples

```typescript
// Zod schema + inferred type (always in sync)
export const DocumentStatusSchema = z.enum(['waiting', 'processing', 'done', 'failed']);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentSchema = z.object({ /* ... */ });
export type Document = z.infer<typeof DocumentSchema>;

// Component props
interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
}

// State interfaces
interface SidebarState {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
}
```

## 3. Functions

| Category              | Pattern                           | Example                            |
|-----------------------|-----------------------------------|------------------------------------|
| Singleton getter      | `get{Service}()`                  | `getDb()`, `getRedisClient()`      |
| Singleton cleanup     | `close{Service}()`               | `closeDb()`, `closeRedis()`        |
| Repository create     | `create{Entity}()`               | `createDocument()`, `createApiKey()`|
| Repository read one   | `get{Entity}()`                  | `getDocument()`, `getApiKey()`      |
| Repository read many  | `list{Entity}s()` / `list{Entity}()` | `listDocuments()`, `listFeedback()` |
| Repository update     | `update{Entity}{Field}()`        | `updateDocumentStatus()`            |
| Repository delete     | `delete{Entity}()`               | `deleteDocument()`                  |
| Repository revoke     | `revoke{Entity}()`               | `revokeApiKey()`                    |
| Activity logging      | `log{Action}()`                  | `logActivity()`, `logUserAction()`  |
| Config getter         | `get{Config}()`                  | `getRedisUrl()`, `getRedisConfig()` |
| Utility               | descriptive verb                  | `cn()`, `runMigrations()`           |
| i18n                  | `t(key)`                         | `t('nav.dashboard')`                |

## 4. Zustand Stores

| Rule                    | Convention                  | Example                      |
|-------------------------|-----------------------------|------------------------------|
| Store hook              | `use{Domain}Store`          | `useSidebarStore`            |
| Store state interface   | `{Domain}State`             | `SidebarState`, `ThemeState` |
| Boolean state           | `is{Adjective}`             | `isCollapsed`, `isDark`      |
| Toggle action           | `toggle{Property}`          | `toggleCollapsed`, `toggleTheme` |
| Set action              | `set{Property}`             | `setCollapsed`               |
| Persistence key         | `loomquery-{domain}`        | `loomquery-sidebar`          |

## 5. Error Handling

| Rule                  | Convention                    | Example                        |
|-----------------------|-------------------------------|--------------------------------|
| Error class           | Extends `AppError`            | `new AppError({ code, message })` |
| Error codes           | `SCREAMING_SNAKE_CASE` enum   | `ErrorCode.PARSE_FAILED`       |
| Error code naming     | `{DOMAIN}_{ACTION}`           | `SEARCH_FAILED`, `LLM_TIMEOUT` |

## 6. Database

| Rule                  | Convention                    | Example                        |
|-----------------------|-------------------------------|--------------------------------|
| Table names           | snake_case, plural            | `documents`, `api_keys`        |
| Column names          | snake_case                    | `created_at`, `entity_type`    |
| Primary keys          | `id` (TEXT, UUID)             | `id TEXT PRIMARY KEY`          |
| Timestamps            | ISO 8601 strings              | `created_at TEXT NOT NULL`     |
| Foreign keys          | `{entity}_id`                 | `document_id`, `message_id`    |

## 7. Imports

| Rule                            | Convention                           |
|---------------------------------|--------------------------------------|
| Cross-directory imports         | Always use `@/` alias                |
| Same-module relative imports    | Use `./` or `../`                    |
| No circular imports             | Enforced by architecture             |
| Type-only imports               | Use `import type { ... }`           |

## 8. `any` Type Policy

- `any` is forbidden except at necessary type boundaries
- Justified uses require `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment
- Currently 2 justified uses in `src/lib/queue.ts` (BullMQ generic defaults)

## 9. Test Naming

| Rule                    | Convention                            | Example                              |
|-------------------------|---------------------------------------|--------------------------------------|
| Test file               | `{source-file}.test.tsx`              | `error-boundary.test.tsx`            |
| E2E test file           | `{feature}.spec.ts`                   | `sidebar-hydration.spec.ts`          |
| Test suite              | `describe('{module}', ...)`           | `describe('ErrorBoundary', ...)`     |
| Test case               | `it('{action} {expected result}', ...)` | `it('renders the title', ...)`     |
| Test data factory       | `make{Entity}(overrides?)`            | `makeDoc()`, `makeEntry()`           |
