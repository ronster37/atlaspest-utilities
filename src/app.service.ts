import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { AxiosInstance } from 'axios'
import * as FormData from 'form-data'
import { PrismaService } from './prisma.service'

@Injectable()
export class AppService {
  private zohoAxiosInstance: AxiosInstance
  private readonly ZOHO_ACCESS_TOKEN_KEY = 'zoho_access_token'

  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.zohoAxiosInstance = axios.create()

    this.zohoAxiosInstance.interceptors.request.use(
      async (config) => {
        const accessToken = await this.getAccessToken()
        config.headers.Authorization = `Zoho-oauthtoken ${accessToken}`
        return config
      },
      (error) => Promise.reject(error),
    )

    this.zohoAxiosInstance.interceptors.response.use(
      (response) => {
        return response
      },
      async (error) => {
        const originalRequest = error.config

        if (error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          const access_token = await this.refreshAccessToken()
          originalRequest.headers.Authorization = `Zoho-oauthtoken ${access_token}`

          return axios(originalRequest)
        }

        return Promise.reject(error)
      },
    )
  }

  async getAccessToken() {
    const globalSetting = await this.prisma.globalSettings.findUnique({
      where: {
        key: this.ZOHO_ACCESS_TOKEN_KEY,
      },
    })

    return globalSetting?.value
  }

  async refreshAccessToken() {
    const url = 'https://accounts.zoho.com/oauth/v2/token'

    const response = await axios.post<ZohoRefreshAccessTokenResponse>(
      url,
      {},
      {
        params: {
          refresh_token: this.configService.get('ZOHO_REFRESH_TOKEN'),
          client_id: this.configService.get('ZOHO_CLIENT_ID'),
          client_secret: this.configService.get('ZOHO_CLIENT_SECRET'),
          grant_type: 'refresh_token',
        },
      },
    )

    await this.prisma.globalSettings.upsert({
      where: {
        key: this.ZOHO_ACCESS_TOKEN_KEY,
      },
      update: {
        value: response.data.access_token,
      },
      create: {
        key: this.ZOHO_ACCESS_TOKEN_KEY,
        value: response.data.access_token,
      },
    })

    return response.data.access_token
  }

  async createArcSiteProject(body: ZohoLeadPayload) {
    const { customer, workSite, salesRep, company } = body

    const response = await axios.post<ArcSiteProject>(
      `${this.configService.get('ARCSITE_URL')}/projects`,
      {
        name: company,
        owner: this.configService.get('ARCSITE_OWNER'),
        customer: {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: {
            street: workSite.street,
            city: workSite.city,
            state: workSite.state,
            zip_code: workSite.zip,
          },
        },
        work_site_address: {
          street: workSite.street,
          city: workSite.city,
          state: workSite.state,
          zip_code: workSite.zip,
        },
        sale_rep: {
          name: `${salesRep.firstName} ${salesRep.lastName}`,
          email: salesRep.email,
          phone: salesRep.phone,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.configService.get('ARCSITE_AUTH')}`,
        },
      },
    )

    return response.data
  }

  async getArcSiteProject(project_id: string) {
    const response = await axios.get<ArcSiteProject>(
      `${this.configService.get('ARCSITE_URL')}/projects/${project_id}`,
      {
        headers: {
          Authorization: `Bearer ${this.configService.get('ARCSITE_AUTH')}`,
        },
      },
    )

    return response.data
  }

  async findZohoLead(id: string) {
    const url = `${this.configService.get('ZOHO_URL')}/Leads/${id}`
    const response = await this.zohoAxiosInstance.get<ZohoLeadResponse>(url)

    return response.data.data[0]
  }

  async getZohoRequestPDFArrayBuffer(requestId: string) {
    const url = `${this.configService.get(
      'ZOHO_SIGN_URL',
    )}/requests/${requestId}/pdf`
    const response = await this.zohoAxiosInstance.get(url, {
      responseType: 'arraybuffer',
    })

    return response.data
  }

  async createZohoDocument(company: string, pdfUrl: string) {
    const url = `${this.configService.get('ZOHO_SIGN_URL')}/requests`

    const requestData = {
      requests: {
        request_name: `Atlas Pest Services Proposal for ${company}`,
        notes: '',
        expiration_days: this.configService.get('ZOHO_SIGN_EXPIRATION_DAYS'),
        email_reminders: true,
        reminder_period: this.configService.get('ZOHO_SIGN_REMINDER_PERIOD'),
      },
    }

    const formData = new FormData()
    const pdfResponse = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
    })

    formData.append('file', pdfResponse.data, 'proposal.pdf')
    formData.append('data', JSON.stringify(requestData))

    const response =
      await this.zohoAxiosInstance.post<ZohoCreateDocumentResponse>(
        url,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      )

    // TODO: check if response is ok
    return response.data.requests
  }

  addSignatureField(
    request_id: string,
    document_id: string,
    name: string,
    email: string,
  ) {
    const url = `${this.configService.get(
      'ZOHO_SIGN_URL',
    )}/requests/${request_id}`
    const requestData = {
      requests: {
        actions: [
          {
            recipient_name: name,
            recipient_email: email,
            in_person_name: name,
            action_type: 'SIGN',
            signing_order: 0,
            verify_recipient: false,
            fields: [
              {
                field_name: 'Signature',
                field_label: 'Signature',
                field_type_name: 'Signature',
                document_id: document_id,
                is_mandatory: true,
                x_coord: 50,
                y_coord: 205,
                abs_width: 230,
                abs_height: 45,
                page_no: 4,
              },
            ],
          },
        ],
      },
    }

    const formData = new FormData()
    formData.append('data', JSON.stringify(requestData))

    return this.zohoAxiosInstance.put(url, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    })
  }

  sendForSignature(request_id: string) {
    const url = `${this.configService.get(
      'ZOHO_SIGN_URL',
    )}/requests/${request_id}/submit`

    return this.zohoAxiosInstance.post(url, null)
  }
}
