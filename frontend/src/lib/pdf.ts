/** Client-side PDF checks before upload (server still re-validates). */
export async function assertClientPdf(file: File): Promise<void> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf")) {
    throw new Error("Only .pdf files are allowed");
  }
  const type = (file.type || "").toLowerCase();
  if (type && type !== "application/pdf" && type !== "application/x-pdf") {
    throw new Error("Only PDF files are allowed");
  }

  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const magic = String.fromCharCode(...header.slice(0, 4));
  if (magic !== "%PDF") {
    throw new Error("File is not a valid PDF");
  }
}
