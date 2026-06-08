import { describe, expect, it } from "vitest";
import { substituteParams } from "@/lib/template-params";

describe("substituteParams", () => {
  it("replaces a single parameter", () => {
    expect(substituteParams("Hello {{name}}", { name: "World" })).toBe(
      "Hello World",
    );
  });

  it("replaces multiple parameters", () => {
    expect(
      substituteParams("{{greeting}} {{name}}!", {
        greeting: "Ciao",
        name: "Marco",
      }),
    ).toBe("Ciao Marco!");
  });

  it("leaves unknown parameters unchanged", () => {
    expect(substituteParams("{{a}} + {{b}}", { a: "1" })).toBe("1 + {{b}}");
  });

  it("handles whitespace inside braces", () => {
    expect(substituteParams("{{  key  }}", { key: "val" })).toBe("val");
  });

  it("returns the string unchanged when no braces are present", () => {
    const input = "No placeholders here.";
    expect(substituteParams(input, { anything: "ignored" })).toBe(input);
  });

  it("returns the string unchanged when values map is empty", () => {
    expect(substituteParams("{{a}} and {{b}}", {})).toBe("{{a}} and {{b}}");
  });

  it("handles parameters with underscores and digits", () => {
    expect(
      substituteParams("v_{{version_1}}", { version_1: "2.0" }),
    ).toBe("v_2.0");
  });

  it("does not match parameter-like tokens without alphanumeric content", () => {
    const input = "{{}} and {{ }}";
    expect(substituteParams(input, { "": "oops" })).toBe(input);
  });

  it("replaces multiple occurrences of the same parameter", () => {
    expect(
      substituteParams("{{x}} then {{x}} again", { x: "me" }),
    ).toBe("me then me again");
  });

  it("handles real-world script template", () => {
    const script = `# Reset {{hostname}}
Write-Host "Resetting {{hostname}}..."
Restart-Computer -ComputerName {{hostname}} -Force`;
    expect(
      substituteParams(script, { hostname: "PC-01" }),
    ).toBe(`# Reset PC-01
Write-Host "Resetting PC-01..."
Restart-Computer -ComputerName PC-01 -Force`);
  });
});
