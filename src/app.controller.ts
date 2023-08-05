import { Controller, Get, Logger } from '@nestjs/common'
import { AppService } from './app.service'
import { ConfigService } from '@nestjs/config'

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name)

  constructor(
    private readonly appService: AppService,
    private configService: ConfigService,
  ) {}

  @Get()
  async webhookZohoAppointmentScheduled(): Promise<string> {
    // TODO:
    // 1. Capture webhook data.
    // 2. Create project in Arcsite
    this.appService.doSomethingWithZohoWebhookData()

    return this.configService.get<string>('RON')
  }
}
