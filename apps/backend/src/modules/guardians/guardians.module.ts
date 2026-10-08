import { Module } from '@nestjs/common';
import { GuardianAccessGuard } from './guardian-access.guard';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';

@Module({
  controllers: [GuardiansController],
  providers: [GuardiansService, GuardianAccessGuard],
})
export class GuardiansModule {}
