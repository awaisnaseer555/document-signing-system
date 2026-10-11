import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(AuthGuard, RolesGuard)
@Roles('MANAGEMENT')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') action?: string,
    @Query('documentId') documentId?: string,
    @Query('assignmentId') assignmentId?: string,
  ) {
    return this.auditService.list({
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      action,
      documentId,
      assignmentId,
    });
  }
}
