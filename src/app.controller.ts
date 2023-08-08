import {
  Body,
  Headers,
  Controller,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common'
import { AppService } from './app.service'
import { ConfigService } from '@nestjs/config'
import { ZohoGuard } from './auth/zoho.guard'

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name)

  constructor(
    private readonly appService: AppService,
    private configService: ConfigService,
  ) {}

  @UseGuards(ZohoGuard)
  @Post()
  async webhookZohoAppointmentScheduled(
    @Headers() headers: Headers,
    @Body() body: ZohoLeadPayload,
  ) {
    // TODO: REMOVE when deploying to prod
    if (body.customer.name !== 'Ron Test Testing') {
      console.log('SKIPPING ZOHO WEBHOOK')
      return
    }

    await this.appService.createArcSiteProject(body)
  }
}
