import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthUser } from '../../common/types';

@Controller('auth')
@UseGuards(AuthGuard)
export class AuthController {
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
