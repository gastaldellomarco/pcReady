// @vitest-environment jsdom

import { expect, vi } from "vitest";
import { configureAxe } from "vitest-axe";

// jsdom doesn't implement matchMedia — provide a stub for tests that
// render components using useIsMobile() or any media-query logic.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// vitest-axe v0.1.0 types incorrectly mark toHaveNoViolations as type-only export.
// We use require() + any cast to bypass the broken type declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toHaveNoViolations } = require("vitest-axe/matchers") as any;

expect.extend({ toHaveNoViolations });

configureAxe();
