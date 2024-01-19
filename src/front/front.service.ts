import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { AxiosInstance } from 'axios'
import * as FormData from 'form-data'

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

  async getTemplate(messageTemplateId: string) {
    const response =
      await this.frontAxiosInstance.get<GetFrontTemplateResponse>(
        `/message_templates/${messageTemplateId}`,
      )

    return response.data
  }

  sendSMS(data: FrontSendSMS) {
    const { body, channelId } = data
    const to =
      this.configService.get('NODE_ENV') === 'production'
        ? data.to
        : this.configService.get('LOCAL_TEST_PHONE')

    return this.frontAxiosInstance.post(`/channels/${channelId}/messages`, {
      to: [to],
      options: {
        archive: true,
      },
      body,
    })
  }

  async sendEmail(data: FrontSendEmail) {
    const { subject, body, channelId } = data
    const to =
      this.configService.get('NODE_ENV') === 'production'
        ? data.to
        : this.configService.get('LOCAL_TEST_EMAIL')

    const formData = new FormData()
    formData.append('to[0]', to)
    formData.append('sender_name', 'Atlas Pest')
    formData.append('options[archive]', 'true')
    formData.append('subject', subject)
    formData.append('body', body)

    if (data.attachmentUrl) {
      const pdfResponse = await this.frontAxiosInstance.get(
        data.attachmentUrl,
        {
          responseType: 'arraybuffer',
        },
      )
      formData.append('attachments[0]', pdfResponse.data, data.attachmentName)
    }

    return this.frontAxiosInstance.post(
      `/channels/${channelId}/messages`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      },
    )
  }
}
