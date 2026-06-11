import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/export-data";

describe("toCsv", () => {
  it("returns empty string for empty rows", () => {
    expect(toCsv([])).toBe("");
  });

  it("outputs header row with column names for a single row", () => {
    const result = toCsv([{ name: "Marco", age: 30 }]);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    // header order is column-discovery order
    expect(lines[0]).toMatch(/^name,age$/);
    expect(lines[1]).toMatch(/^Marco,30$/);
  });

  it("handles multiple rows with consistent columns", () => {
    const rows = [
      { name: "Marco", age: 30 },
      { name: "Anna", age: 25 },
    ];
    const result = toCsv(rows);
    const lines = result.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("name,age");
    expect(lines[1]).toBe("Marco,30");
    expect(lines[2]).toBe("Anna,25");
  });

  it("discovers columns from all rows (heterogeneous keys)", () => {
    const rows = [
      { name: "Marco" },
      { name: "Anna", age: 25 },
      { city: "Roma" },
    ];
    const result = toCsv(rows);
    const lines = result.split("\n");
    expect(lines).toHaveLength(4);
    // all keys found: name, age, city
    expect(lines[0]).toMatch(/name/);
    expect(lines[0]).toMatch(/age/);
    expect(lines[0]).toMatch(/city/);
    // missing columns become empty cells
    const nameIndex = lines[0].split(",").indexOf("name");
    const ageIndex = lines[0].split(",").indexOf("age");
    const cityIndex = lines[0].split(",").indexOf("city");
    // row 1: Marco, , 
    expect(lines[1].split(",")[nameIndex]).toBe("Marco");
    expect(lines[1].split(",")[ageIndex]).toBe("");
    expect(lines[1].split(",")[cityIndex]).toBe("");
    // row 3: name empty, age empty, city=Roma
    expect(lines[3].split(",")[nameIndex]).toBe("");
    expect(lines[3].split(",")[ageIndex]).toBe("");
    expect(lines[3].split(",")[cityIndex]).toBe("Roma");
  });

  it("converts null/undefined values to empty string", () => {
    const rows = [{ a: null, b: undefined, c: "ok" }];
    const result = toCsv(rows);
    const lines = result.split("\n");
    // a=null→"", b=undefined→"", c="ok"
    expect(lines[1]).toMatch(/^,,ok$/);
  });

  it("stringifies object values via JSON.stringify (CSV-escaped)", () => {
    const rows = [{ tags: { key: "value" }, plain: "text" }];
    const result = toCsv(rows);
    const lines = result.split("\n");
    // tags is JSON.stringify → {"key":"value"}, then CSV-escaped because it contains "
    // csvCell output: "{""key"":""value""}"
    expect(lines[1]).toContain('"{""key"":""value""}"');
    expect(lines[1]).toContain(",text");
  });

  it("quotes values containing commas", () => {
    const rows = [{ note: "hello, world", other: "safe" }];
    const result = toCsv(rows);
    const lines = result.split("\n");
    expect(lines[1]).toContain('"hello, world"');
  });

  it("escapes double-quotes inside quoted values", () => {
    const rows = [{ message: 'He said "hello"' }];
    const result = toCsv(rows);
    const lines = result.split("\n");
    // should become: "He said ""hello"""
    expect(lines[1]).toBe('"He said ""hello"""');
  });

  it("quotes values containing newlines", () => {
    const rows = [{ desc: "line1\nline2" }];
    const result = toCsv(rows);
    // Cell with newline is quoted, so the CSV row is: desc\n"line1\nline2"
    expect(result).toBe('desc\n"line1\nline2"');
  });

  it("handles numeric and boolean values without quoting", () => {
    const rows = [{ count: 42, active: true, price: 9.99 }];
    const result = toCsv(rows);
    const lines = result.split("\n");
    expect(lines[1]).toBe("42,true,9.99");
  });
});
