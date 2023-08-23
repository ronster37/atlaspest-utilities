import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Transporter, SendMailOptions } from 'nodemailer'
import * as nodemailer from 'nodemailer'

@Injectable()
export class EmailService {
  transporter: Transporter

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      secure: true,
      auth: {
        user: this.configService.get('GMAIL_USER'),
        pass: this.configService.get('GMAIL_PASSWORD'),
      },
    })
  }

  async send(options: SendMailOptions) {
    await this.transporter.sendMail({
      to: this.configService.get('EMAIL_NOTIFICATIONS_TO'),
      from: this.configService.get('EMAIL_NOTIFICATIONS_FROM'),
      subject: options.subject,
      text: options.text,
    })
  }
}
