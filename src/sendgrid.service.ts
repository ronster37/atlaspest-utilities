import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as SendGrid from '@sendgrid/mail'

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name)

  constructor(private readonly configService: ConfigService) {
    SendGrid.setApiKey(this.configService.get<string>('SENDGRID_API_KEY'))
  }

  async send(mail: SendGrid.MailDataRequired) {
    // TODO: uncomment this line to send emails
    // await SendGrid.send(mail)
    this.logger.log(`E-Mail sent to ${mail.to}`)
  }
}
