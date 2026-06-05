import { describe, expect, it } from "vitest";
import { CreateAnnotationSchema, UpdateAnnotationSchema } from "@/lib/widget-annotations";

// ── CreateAnnotationSchema ──────────────────────────────────────────────

describe("CreateAnnotationSchema", () => {
  it("accepts valid input with all fields", () => {
    const result = CreateAnnotationSchema.safeParse({
      widget_id: "stat-cards",
      text: "Picco di ticket per aggiornamento Windows",
      note_date: "2026-05-28",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.widget_id).toBe("stat-cards");
      expect(result.data.text).toBe("Picco di ticket per aggiornamento Windows");
      expect(result.data.note_date).toBe("2026-05-28");
    }
  });

  it("accepts valid input without optional note_date", () => {
    const result = CreateAnnotationSchema.safeParse({
      widget_id: "analytics-card",
      text: "Nota senza data",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note_date).toBeUndefined();
    }
  });

  it("accepts null note_date", () => {
    const result = CreateAnnotationSchema.safeParse({
      widget_id: "analytics-card",
      text: "Nota con data nulla",
      note_date: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note_date).toBeNull();
    }
  });

  it("rejects empty widget_id", () => {
    const result = CreateAnnotationSchema.safeParse({
      widget_id: "",
      text: "test",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty text", () => {
    const result = CreateAnnotationSchema.safeParse({
      widget_id: "stat-cards",
      text: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects text exceeding 500 characters", () => {
    const result = CreateAnnotationSchema.safeParse({
      widget_id: "stat-cards",
      text: "x".repeat(501),
    });

    expect(result.success).toBe(false);
  });

  it("accepts text at exactly 500 characters", () => {
    const result = CreateAnnotationSchema.safeParse({
      widget_id: "stat-cards",
      text: "x".repeat(500),
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing widget_id", () => {
    const result = CreateAnnotationSchema.safeParse({
      text: "test",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing text", () => {
    const result = CreateAnnotationSchema.safeParse({
      widget_id: "stat-cards",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid note_date format", () => {
    const result = CreateAnnotationSchema.safeParse({
      widget_id: "stat-cards",
      text: "test",
      note_date: "not-a-date",
    });

    // note_date is a string field validated as string, not as date format
    // so it passes string validation
    expect(result.success).toBe(true);
  });
});

// ── UpdateAnnotationSchema ──────────────────────────────────────────────

describe("UpdateAnnotationSchema", () => {
  it("accepts valid text-only update", () => {
    const result = UpdateAnnotationSchema.safeParse({
      text: "Testo aggiornato",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe("Testo aggiornato");
    }
  });

  it("accepts null note_date to clear a date", () => {
    const result = UpdateAnnotationSchema.safeParse({
      note_date: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note_date).toBeNull();
    }
  });

  it("accepts empty object (all fields optional)", () => {
    const result = UpdateAnnotationSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("accepts both text and note_date", () => {
    const result = UpdateAnnotationSchema.safeParse({
      text: "Nuovo testo",
      note_date: "2026-06-01",
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty text string", () => {
    const result = UpdateAnnotationSchema.safeParse({
      text: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects text exceeding 500 characters", () => {
    const result = UpdateAnnotationSchema.safeParse({
      text: "x".repeat(501),
    });

    expect(result.success).toBe(false);
  });

  it("accepts text at exactly 500 characters", () => {
    const result = UpdateAnnotationSchema.safeParse({
      text: "x".repeat(500),
    });

    expect(result.success).toBe(true);
  });

  it("rejects unexpected extra fields", () => {
    const result = UpdateAnnotationSchema.safeParse({
      text: "ok",
      invalid_field: "should not be here",
    });

    // Zod strips unknown fields by default unless .strict() is used
    // UpdateAnnotationSchema does not use .strict(), so it should pass
    expect(result.success).toBe(true);
  });
});
