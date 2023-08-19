import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

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

  createDocument(filePath: string, customerId: string) {
    const url = `${this.configService.get('PESTROUTES_URL')}/document/create`
    const formData = new FormData()
    formData.append('uploadFile', filePath)
    formData.append('customerID', customerId)
    // TODO: hardcoded description?
    formData.append('description', 'Some descriptin')

    return axios.post(url, formData, this.getAuthorization())
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
