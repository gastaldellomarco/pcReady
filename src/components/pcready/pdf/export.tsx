import { pdf } from "@react-pdf/renderer";
import type { ReactElement } from "react";

export async function downloadPdf(document: ReactElement, fileName: string) {
  const blob = await renderPdf(document);
  const url = URL.createObjectURL(blob);
  const anchor = documentRef().createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function previewPdf(document: ReactElement) {
  const blob = await renderPdf(document);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function renderPdf(document: ReactElement) {
  return pdf(document).toBlob();
}

function documentRef() {
  return window.document;
}
