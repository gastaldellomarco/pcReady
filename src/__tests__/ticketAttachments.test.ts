import { describe, expect, it } from "vitest";
import { validateTicketAttachmentFile } from "@/lib/queries/ticketAttachments";

function testFile(name: string, bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new File([buffer], name);
}

describe("ticket attachment validation", () => {
  it("accepts a valid PNG file", async () => {
    const file = testFile(
      "image.png",
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    await expect(validateTicketAttachmentFile(file)).resolves.toBe("image/png");
  });

  it("rejects disallowed extension .svg", async () => {
    const file = testFile("malware.svg", new TextEncoder().encode("<svg></svg>"));

    await expect(validateTicketAttachmentFile(file)).rejects.toThrow(
      "Estensione file non consentita",
    );
  });

  it("rejects a mismatched extension and file header", async () => {
    const file = testFile(
      "document.pdf",
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    await expect(validateTicketAttachmentFile(file)).rejects.toThrow(
      "Tipo file non valido in base all'intestazione del file",
    );
  });

  it("accepts plain text .txt files", async () => {
    const file = testFile("notes.txt", new TextEncoder().encode("Hello world\nThis is text."));

    await expect(validateTicketAttachmentFile(file)).resolves.toBe("text/plain");
  });
});
