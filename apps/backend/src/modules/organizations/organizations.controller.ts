import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator';
import { TenantCtx } from '../../common/decorators/tenant-ctx.decorator';
import { TenantContext } from '../../common/tenant/tenant-context';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // Sin @RequierePermiso: la ruta no tiene organizationId todavía (se está
  // creando), así que RequierePermisoGuard deja pasar sin exigir membresía.
  @Post()
  create(@TenantCtx() ctx: TenantContext, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(ctx, dto);
  }

  // RequierePermisoGuard ya exige membresía activa por tener `:id` en la ruta.
  @Get(':id')
  findOne(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.organizationsService.findOne(ctx, id);
  }

  @RequierePermiso('editar_organizacion')
  @Patch(':id')
  update(@TenantCtx() ctx: TenantContext, @Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(ctx, id, dto);
  }
}
