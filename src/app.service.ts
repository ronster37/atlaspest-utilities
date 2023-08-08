import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  async createArcSiteProject(body: ZohoLeadPayload) {
    const { customer, workSite, salesRep } = body

    await axios.post(
      `${this.configService.get('ARCSITE_URL')}/projects`,
      {
        name: `rontest - ${Date.now()}`,
        owner: this.configService.get('ARCSITE_OWNER'),
        // job_number: '',
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
  }
}
