import { BadRequestException } from '@nestjs/common';
import { getMaxPdfBytes, getMaxPdfLabel } from './upload-limits';

const PDF_MAGIC = Buffer.from('%PDF');

export function assertStrictPdf(file: Express.Multer.File) {
  if (!file) {
    throw new BadRequestException('PDF file is required');
  }

  const maxBytes = getMaxPdfBytes();
  if (file.size > maxBytes) {
    throw new BadRequestException(`PDF exceeds ${getMaxPdfLabel()} limit`);
  }

  const name = file.originalname?.toLowerCase() ?? '';
  if (!name.endsWith('.pdf')) {
    throw new BadRequestException('Only .pdf file extensions are allowed');
  }

  const mime = (file.mimetype ?? '').toLowerCase();
  if (mime && mime !== 'application/pdf' && mime !== 'application/x-pdf') {
    throw new BadRequestException('Only PDF MIME type is allowed');
  }

  if (!file.buffer || file.buffer.length < 5) {
    throw new BadRequestException('Invalid or empty PDF file');
  }

  // Reject renamed non-PDFs (magic-byte check)
  if (!file.buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new BadRequestException(
      'File content is not a valid PDF (must start with %PDF)',
    );
  }
}

/** Multer fileFilter — reject non-PDFs before accepting the upload. */
export function pdfFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  const name = file.originalname?.toLowerCase() ?? '';
  const mime = (file.mimetype ?? '').toLowerCase();
  const mimeOk =
    !mime || mime === 'application/pdf' || mime === 'application/x-pdf';
  if (!name.endsWith('.pdf') || !mimeOk) {
    cb(new BadRequestException('Only PDF files are allowed'), false);
    return;
  }
  cb(null, true);
}
