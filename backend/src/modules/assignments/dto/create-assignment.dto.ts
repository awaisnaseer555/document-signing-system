import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  documentId!: string;

  @IsUUID()
  assigneeId!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
