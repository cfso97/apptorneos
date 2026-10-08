import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator';
import { SkipMembershipCheck } from '../../common/decorators/skip-membership-check.decorator';
import { TenantCtx } from '../../common/decorators/tenant-ctx.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { InviteMembershipDto } from './dto/invite-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('memberships')
@ApiBearerAuth()
@Controller('organizations/:orgId/memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @RequierePermiso('gestionar_membresias')
  @Post('invite')
  invite(@TenantCtx() ctx: TenantContext, @Param('orgId') orgId: string, @Body() dto: InviteMembershipDto) {
    return this.membershipsService.invite(ctx, orgId, dto);
  }

  @RequierePermiso('gestionar_membresias')
  @Get()
  findAll(@TenantCtx() ctx: TenantContext, @Param('orgId') orgId: string) {
    return this.membershipsService.findAll(ctx, orgId);
  }

  @RequierePermiso('gestionar_membresias')
  @Patch(':membershipId')
  update(
    @TenantCtx() ctx: TenantContext,
    @Param('orgId') orgId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.membershipsService.update(ctx, orgId, membershipId, dto);
  }

  // No @RequierePermiso: quien acepta está en estado "invitado", todavía no
  // es miembro activo — ver SkipMembershipCheck. El propio servicio valida
  // que la invitación le pertenezca al usuario autenticado.
  @SkipMembershipCheck()
  @HttpCode(HttpStatus.OK)
  @Post(':membershipId/accept')
  accept(@TenantCtx() ctx: TenantContext, @Param('orgId') orgId: string, @Param('membershipId') membershipId: string) {
    return this.membershipsService.accept(ctx, orgId, membershipId);
  }
}
