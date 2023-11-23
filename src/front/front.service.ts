import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { AxiosInstance } from 'axios'

@Injectable()
export class FrontService {
  private frontAxiosInstance: AxiosInstance

  constructor(private configService: ConfigService) {
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

  async getTemplate() {
    const messageTemplateId = this.configService.get<string>(
      'FRONT_MESSAGE_TEMPLATE_ID',
    )
    const response =
      await this.frontAxiosInstance.get<GetFrontTemplateResponse>(
        `/message_templates/${messageTemplateId}`,
      )

    return response.data.body
  }

  sendMessage(to: string, body: string) {
    const channelId = this.configService.get<string>('FRONT_CHANNEL_ID')
    return this.frontAxiosInstance.post(`/channels/${channelId}/messages`, {
      to: [to],
      options: {
        archive: true,
      },
      body,
    })
  }
}
