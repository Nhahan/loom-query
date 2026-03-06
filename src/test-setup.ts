import "@testing-library/jest-dom/vitest";

// Required for React 19 concurrent mode in test environments
// Without this, hooks that update state outside of act() throw errors
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
