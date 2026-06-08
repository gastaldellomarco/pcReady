/** Legacy clipboard fallback for non-HTTPS contexts or older browsers. */
function execCommandCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  return ok;
}

/**
 * Copies text to the clipboard.
 * Tries the modern Clipboard API first, then falls back to execCommand.
 * Returns true on success, false if all methods failed.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API failed – try legacy fallback
    }
  }
  return execCommandCopy(text);
}
