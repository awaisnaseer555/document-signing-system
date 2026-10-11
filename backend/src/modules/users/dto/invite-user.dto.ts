import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsEnum(['EMPLOYEE', 'MANAGEMENT'] as const)
  role!: 'EMPLOYEE' | 'MANAGEMENT';

  @IsString()
  @MinLength(8)
  temporaryPassword!: string;
}
