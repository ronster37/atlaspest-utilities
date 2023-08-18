import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  async createArcSiteProject(body: ZohoLeadPayload) {
    const { leadId, customer, workSite, salesRep } = body

    const response = await axios.post<ArcSiteProject>(
      `${this.configService.get('ARCSITE_URL')}/projects`,
      {
        name: `RonTest - ${Date.now()}`,
        owner: this.configService.get('ARCSITE_OWNER'),
        job_number: leadId,
        customer: {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        },
        work_site_address: {
          street: workSite.street,
          city: workSite.city,
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
    const response = await axios.get<ZohoLeadResponse>(
      `${this.configService.get('ZOHO_URL')}/Leads/${id})`,
      this.getZohoAuthenticationHeaders(),
    )

    return response.data.data[0]
  }

  async downloadProposal(url: string) {
    const response = await axios.get(url, { responseType: 'arraybuffer' })
    const pdfBuffer = Buffer.from(response.data, 'binary')

    const tmpPath = path.join('/tmp', 'proposal.pdf')
    fs.writeFileSync(tmpPath, pdfBuffer)
    // TODO: print and catch error

    return tmpPath
  }

  async createZohoDocument(fullname: string, filePath: string) {
    const url = `${this.configService.get('ZOHO_SIGN_URL')}/requests`
    const requestData = {
      requests: {
        request_name: `${fullname}`,
        notes: '',
        expiration_days: 5,
        email_reminders: true,
        reminder_period: 2,
      },
    }

    const formData = new FormData()
    formData.append('file', filePath)
    formData.append('data', JSON.stringify(requestData))

    const response = await axios.post<ZohoCreateDocumentResponse>(
      url,
      formData,
      this.getZohoAuthenticationHeaders({
        'Content-Type': 'multipart/form-data',
      }),
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

    return axios.put(
      url,
      formData,
      this.getZohoAuthenticationHeaders({
        'Content-Type': 'multipart/form-data',
      }),
    )
  }

  sendForSignature(request_id: string) {
    const url = `${this.configService.get(
      'ZOHO_SIGN_URL',
    )}/requests/${request_id}/submit`

    return axios.post(url, null, this.getZohoAuthenticationHeaders())
  }

  getZohoAuthenticationHeaders(additionalHeaders: any = {}) {
    return {
      headers: {
        Authorization: `Zoho-oauthtoken ${'TODO'}`,
        ...additionalHeaders,
      },
    }
  }
}
