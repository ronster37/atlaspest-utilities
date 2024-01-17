import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { AxiosInstance } from 'axios'

@Injectable()
export class FrontService {
  private frontAxiosInstance: AxiosInstance

  constructor(configService: ConfigService) {
    this.frontAxiosInstance = axios.create({
      baseURL: configService.get<string>('FRONT_API_URL'),
      headers: {
        common: {
          Authorization: `Bearer ${configService.get<string>(
            'FRONT_AUTH_TOKEN',
          )}`,
        },
      },
    })
  }

  async getTemplate(messageTemplateId: string) {
    const response =
      await this.frontAxiosInstance.get<GetFrontTemplateResponse>(
        `/message_templates/${messageTemplateId}`,
      )

    return response.data.body
  }

  sendSMS(data: FrontSendSMS) {
    const { to, body, channelId } = data
    return this.frontAxiosInstance.post(`/channels/${channelId}/messages`, {
      to: [to],
      options: {
        archive: true,
      },
      body,
    })
  }

  sendEmail(data: FrontSendEmail) {
    const { to, subject, body, channelId } = data
    return this.frontAxiosInstance.post(`/channels/${channelId}/messages`, {
      to: [to],
      sender_name: 'Atlas Pest',
      options: {
        archive: true,
      },
      subject,
      body,
    })
  }
}
