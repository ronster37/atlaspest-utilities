import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

@Injectable()
export class PestRoutesService {
  constructor(private configService: ConfigService) {}

  createCustomer(firstName: string, lastName: string, email: string) {
    const url = `${this.configService.get('PESTROUTES_URL')}/customer/create`
    const requestData = {
      fname: firstName,
      lname: lastName,
    }

    axios.post(url, requestData, this.getAuthorization())
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
        authenticationToken:
          '1r93g9sr6e5vdg4a7fujbucttt858gqrfc7m58o6f8m2r313sio0t5op34biq5gl',
        authenticationKey:
          'ue35nr5522a193s9doiii3rpbakfqln2vqaimdvd8daidvcd1ej205lo90ruo63s',
      },
    }
  }
}
