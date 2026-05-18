import { describe, expect, it } from "vitest";
import { validateTicketAttachmentFile } from "@/lib/queries/ticketAttachments";

describe("ticket attachment validation", () => {
  it("accepts a valid PNG file", async () => {
    const file = {
      name: "image.png",
      size: 8,
      async arrayBuffer() {
        return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
      },
    } as unknown as File;

    await expect(validateTicketAttachmentFile(file)).resolves.toBe("image/png");
  });

  it("rejects disallowed extension .svg", async () => {
    const file = {
      name: "malware.svg",
      size: 20,
      async arrayBuffer() {
        return new TextEncoder().encode("<svg></svg>").buffer;
      },
    } as unknown as File;

    await expect(validateTicketAttachmentFile(file)).rejects.toThrow("Estensione file non consentita");
  });

  it("rejects a mismatched extension and file header", async () => {
    const file = {
      name: "document.pdf",
      size: 8,
      async arrayBuffer() {
        return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
      },
    } as unknown as File;

    await expect(validateTicketAttachmentFile(file)).rejects.toThrow("Tipo file non valido in base all'intestazione del file");
  });

  it("accepts plain text .txt files", async () => {
    const file = {
      name: "notes.txt",
      size: 20,
      async arrayBuffer() {
        return new TextEncoder().encode("Hello world\nThis is text.").buffer;
      },
    } as unknown as File;

    await expect(validateTicketAttachmentFile(file)).resolves.toBe("text/plain");
  });
});
