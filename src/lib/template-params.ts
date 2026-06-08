/**
 * Replaces `{{paramName}}` placeholders in a template string with values
 * from the provided map. Unknown parameters are left unchanged.
 *
 * @example
 *   substituteParams("Hello {{name}}!", { name: "World" })
 *   // => "Hello World!"
 *
 * @example
 *   substituteParams("{{a}} + {{b}}", { a: "1" })
 *   // => "1 + {{b}}"
 */
export function substituteParams(code: string, values: Record<string, string>): string {
  return code.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name) => {
    return values[name] ?? `{{${name}}}`;
  });
}
