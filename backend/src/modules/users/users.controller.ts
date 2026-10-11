import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { InviteUserDto } from './dto/invite-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('employees')
  @Roles('MANAGEMENT')
  listEmployees() {
    return this.usersService.listEmployees();
  }

  @Post('invite')
  @Roles('MANAGEMENT')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  invite(@Body() dto: InviteUserDto) {
    return this.usersService.invite(dto);
  }
}
