import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import * as FormData from 'form-data'

@Injectable()
export class PestRoutesService {
  constructor(private configService: ConfigService) {}

  async createCustomer(zohoLead: ZohoLead) {
    const url = `${this.configService.get('PESTROUTES_URL')}/customer/create`
    const requestData = {
      fname: zohoLead.Fist_Name,
      lname: zohoLead.Last_Name,
      address: zohoLead.Street,
      city: zohoLead.City,
      state: zohoLead.State,
      zip: zohoLead.Zip_Code,
      phone1: zohoLead.Phone,
      email: zohoLead.Email,
      status: 1,
    }
    const response = await axios.post<PestRoutesCustomerCreateResponse>(
      url,
      requestData,
      this.getAuthorization(),
    )

    return response.data
  }

  async createDocument(arrayBuffer: ArrayBuffer, customerId: string) {
    const url = `${this.configService.get('PESTROUTES_URL')}/document/create`
    const formData = new FormData()

    formData.append('uploadFile', arrayBuffer, 'proposal.pdf')
    formData.append('customerID', customerId)
    // TODO: hardcoded description?
    formData.append(
      'description',
      'TODO: Some description goes here ' + Date.now(),
    )

    console.log('headers', {
      ...this.getAuthorization(),
      ...formData.getHeaders(),
    })

    return await axios.post(url, formData, {
      ...this.getAuthorization(),
      ...formData.getHeaders(),
    })
  }

  getAuthorization() {
    return {
      params: {
        authenticationToken: this.configService.get('PESTROUTES_AUTH_TOKEN'),
        authenticationKey: this.configService.get('PESTROUTES_AUTH_KEY'),
      },
    }
  }
}
