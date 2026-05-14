import { describe, expect, it } from "vitest";
import { getTemplates, renderTemplate } from "@/lib/email-templates";

describe("email templates", () => {
  it("returns available templates", () => {
    expect(getTemplates().map((template) => template.id)).toContain("ticket-assigned");
  });

  it("renders placeholders with provided variables", () => {
    const template = getTemplates().find((item) => item.id === "ticket-assigned");

    expect(
      renderTemplate(template!, {
        ticket_code: "PC-100",
        assignee_name: "Marco",
        client_name: "ACME",
      }),
    ).toEqual({
      subject: "Ticket PC-100 assegnato",
      body: "Ciao Marco, il ticket PC-100 per ACME ti e' stato assegnato.",
    });
  });

  it("renderTemplate supports raw string templates", () => {
    expect(renderTemplate("Ciao {{name}}", { name: "Mondo" })).toBe("Ciao Mondo");
  });

  it("renderTemplate leaves unknown placeholders unchanged", () => {
    expect(renderTemplate("{{missing}}", {})).toBe("{{missing}}");
  });
});
