import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { AppService } from './app.service';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  // El envelope {data, meta} lo agrega el ResponseInterceptor global.
  @Public()
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
}
