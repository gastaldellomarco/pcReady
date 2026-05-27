// @vitest-environment jsdom

import { expect } from "vitest";
import { configureAxe } from "vitest-axe";

// vitest-axe v0.1.0 types incorrectly mark toHaveNoViolations as type-only export.
// We use require() + any cast to bypass the broken type declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toHaveNoViolations } = require("vitest-axe/matchers") as any;

expect.extend({ toHaveNoViolations });

configureAxe();
