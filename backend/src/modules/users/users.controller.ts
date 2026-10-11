import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { InviteUserDto } from './dto/invite-user.dto';
import { UsersService } from './users.service';

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
  invite(@Body() dto: InviteUserDto) {
    return this.usersService.invite(dto);
  }
}
