import { z } from "zod";

export const trimmedString = () => z.string().transform((s) => s.trim());

export const optionalTrimmed = () =>
  z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .nullable();

export const parseIntSafe = (val: unknown) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
};
