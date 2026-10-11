import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, MinLength } from 'class-validator';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { getMaxPdfBytes } from '../../common/upload-limits';
import { AuthUser } from '../../common/types';
import { DocumentsService } from './documents.service';

class UploadDocumentDto {
  @IsString()
  @MinLength(1)
  title!: string;
}

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(AuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @Roles('MANAGEMENT')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: getMaxPdfBytes() },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
  ) {
    if (!body.title?.trim()) {
      throw new BadRequestException('Title is required');
    }
    return this.documentsService.upload(user, body.title.trim(), file);
  }

  @Get()
  @Roles('MANAGEMENT')
  list() {
    return this.documentsService.list();
  }

  @Get(':id')
  @Roles('MANAGEMENT')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.getById(id);
  }
}
