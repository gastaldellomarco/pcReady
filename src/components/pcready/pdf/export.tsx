import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { downloadBlob, openBlobPreview } from "@/lib/downloads";
import type { ReactElement } from "react";

/**
 *
 */
export async function downloadPdf(document: ReactElement<DocumentProps>, fileName: string) {
  const blob = await renderPdf(document);
  downloadBlob(blob, fileName);
}

/**
 *
 */
export async function previewPdf(document: ReactElement<DocumentProps>) {
  const blob = await renderPdf(document);
  openBlobPreview(blob);
}

async function renderPdf(document: ReactElement<DocumentProps>) {
  return pdf(document).toBlob();
}
