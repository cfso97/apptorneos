import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LinkGuardianDto } from './dto/link-guardian.dto';
import { GuardianAccessGuard } from './guardian-access.guard';
import { GuardiansService } from './guardians.service';

@ApiTags('guardians')
@ApiBearerAuth()
@Controller('users/:userId/guardians')
@UseGuards(GuardianAccessGuard)
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Get()
  findAll(@Param('userId') userId: string) {
    return this.guardiansService.findAll(userId);
  }

  @Post()
  link(@Param('userId') userId: string, @Body() dto: LinkGuardianDto) {
    return this.guardiansService.link(userId, dto);
  }

  @Delete(':guardianId')
  unlink(@Param('userId') userId: string, @Param('guardianId') guardianId: string) {
    return this.guardiansService.unlink(userId, guardianId);
  }
}
