import "vitest";

/**
 * Augmentazione locale per il matcher toHaveNoViolations di vitest-axe.
 * Il package vitest-axe v0.1.0 ha tipi rotti (extend-expect.d.ts importa
 * file inesistenti), quindi dichiariamo manualmente il matcher.
 */
interface AxeMatchers<R = void> {
  toHaveNoViolations(): R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Assertion<T = any> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
