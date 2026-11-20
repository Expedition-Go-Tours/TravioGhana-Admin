/**
 * Save a blob the browser already holds (typically a PDF the API generated)
 * under a filename we choose.
 *
 * The object URL is revoked on a later tick: revoking immediately cancels the
 * download in Safari, which starts reading the URL after the click handler
 * returns.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Filename-safe booking reference (`TRG-…` already is, but be defensive). */
export function safeFilenamePart(value: string): string {
  return String(value || "booking").replace(/[^A-Za-z0-9._-]+/g, "_");
}
