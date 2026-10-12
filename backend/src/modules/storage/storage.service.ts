import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { assertStrictPdf } from '../../common/pdf-validation';
import { SupabaseService } from '../supabase/supabase.service';

const SIGNED_URL_TTL_SECONDS = 180;

@Injectable()
export class StorageService {
  constructor(private readonly supabase: SupabaseService) {}

  async uploadOriginalPdf(documentId: string, file: Express.Multer.File) {
    assertStrictPdf(file);
    const path = `originals/${documentId}/${Date.now()}.pdf`;
    const { error } = await this.supabase.admin.storage
      .from('documents')
      .upload(path, file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload PDF: ${error.message}`,
      );
    }
    return path;
  }

  async uploadSignaturePng(assignmentId: string, pngBuffer: Buffer) {
    const path = `signatures/${assignmentId}/${Date.now()}.png`;
    const { error } = await this.supabase.admin.storage
      .from('signatures')
      .upload(path, pngBuffer, {
        contentType: 'image/png',
        upsert: false,
      });
    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload signature: ${error.message}`,
      );
    }
    return path;
  }

  async uploadSignedPdf(assignmentId: string, pdfBuffer: Buffer) {
    const path = `signed/${assignmentId}/${Date.now()}.pdf`;
    const { error } = await this.supabase.admin.storage
      .from('signatures')
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload signed PDF: ${error.message}`,
      );
    }
    return path;
  }

  async download(bucket: 'documents' | 'signatures', path: string) {
    const { data, error } = await this.supabase.admin.storage
      .from(bucket)
      .download(path);
    if (error || !data) {
      throw new InternalServerErrorException(
        `Failed to download file: ${error?.message ?? 'unknown'}`,
      );
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async createSignedUrl(bucket: 'documents' | 'signatures', path: string) {
    const { data, error } = await this.supabase.admin.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException(
        `Failed to create signed URL: ${error?.message ?? 'unknown'}`,
      );
    }
    return {
      url: data.signedUrl,
      expiresIn: SIGNED_URL_TTL_SECONDS,
    };
  }
}
