import { IsString, Matches, MinLength } from 'class-validator';

export class SubmitSignatureDto {
  /** PNG data URL from signature pad */
  @IsString()
  @MinLength(32)
  @Matches(/^data:image\/png;base64,/, {
    message: 'signatureDataUrl must be a PNG data URL',
  })
  signatureDataUrl!: string;
}
