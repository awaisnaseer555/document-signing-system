import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  /** Accepted for backward compatibility; server always creates EMPLOYEE. */
  @IsOptional()
  @IsEnum(['EMPLOYEE'] as const)
  role?: 'EMPLOYEE';

  @IsString()
  @MinLength(1)
  temporaryPassword!: string;
}
