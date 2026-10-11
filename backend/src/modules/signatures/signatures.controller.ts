import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/types';
import { SubmitSignatureDto } from './dto/submit-signature.dto';
import { SignaturesService } from './signatures.service';

@ApiTags('signatures')
@ApiBearerAuth()
@Controller('assignments/:assignmentId/signatures')
@UseGuards(AuthGuard, RolesGuard)
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  @Post()
  @Roles('EMPLOYEE')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: SubmitSignatureDto,
  ) {
    return this.signaturesService.submit(
      user,
      assignmentId,
      dto.signatureDataUrl,
    );
  }
}
