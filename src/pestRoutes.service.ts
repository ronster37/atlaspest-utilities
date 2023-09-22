import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PDFDocument } from 'pdf-lib'
import axios from 'axios'
import * as FormData from 'form-data'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as pdf from 'pdf-parse'

@Injectable()
export class PestRoutesService {
  constructor(private configService: ConfigService) {}

  async createCustomer(
    zohoContact: ZohoContact,
    zohoDeal: ZohoDeal,
    arcSiteProject: ArcSiteProject,
    arrayBuffer: ArrayBuffer,
  ) {
    const url = `${this.configService.get('PESTROUTES_URL')}/customer/create`
    const isMultiUnit = await this.isMultiUnit(arrayBuffer)
    const requestData = {
      fname: zohoContact.First_Name,
      lname: zohoContact.Last_Name,
      address: arcSiteProject.work_site_address.street,
      city: arcSiteProject.work_site_address.city,
      state: arcSiteProject.work_site_address.state,
      zip: arcSiteProject.work_site_address.zip_code,
      phone1: arcSiteProject.customer.phone,
      phone2: arcSiteProject.customer.second_phone,
      email: arcSiteProject.customer.email,
      smsReminders: 1,
      emailReminders: 1,
      specialScheduling: arcSiteProject.customer.second_email
        ? `Second Email: ${arcSiteProject.customer.second_email}`
        : '',
      companyName: zohoDeal.Deal_Name,
      // This sets the customer as a commercial property
      commercialAccount: 1,
      // This sets the customer as a commercial customer
      sourceID: 14,
      status: 1,
    }
    const response = await axios.post<PestRoutesCustomerCreateResponse>(
      url,
      requestData,
      this.getAuthorization(),
    )

    return response.data
  }

  async isMultiUnit(arrayBuffer: any) {
    const result = await pdf(arrayBuffer)

    return (
      result.text.includes('Multi-Unit Property') &&
      result.text
        .split('Multi-Unit Property')[1]
        .substring(0, 5)
        .toLowerCase()
        .replace(/\s/g, '')
        .indexOf('yes') > -1
    )
  }

  async createAdditionalContactIfSecondEmailOrPhoneExists(
    customerId: string,
    zohoContact: ZohoContact,
    arcSiteProject: ArcSiteProject,
  ) {
    const { second_email, second_phone } = arcSiteProject.customer
    const url = `${this.configService.get(
      'PESTROUTES_URL',
    )}/additionalContact/create`
    const requestData = {
      customerID: customerId,
      additionalContactTypeID: 2,
      fname: zohoContact.First_Name,
      lname: zohoContact.Last_Name,
      phone: second_phone || '',
      email: second_email || '',
      smsReminders: 1,
      emailReminders: 1,
    }

    if (second_phone || second_email) {
      await axios.post(url, requestData, this.getAuthorization())
    }
  }

  async uploadProposal(
    arrayBuffer: ArrayBuffer,
    customerId: string,
    description: string,
    showCustomer: 1 | 0,
    showTech: 1 | 0,
  ) {
    const url = `${this.configService.get('PESTROUTES_URL')}/document/create`
    const formData = new FormData()

    formData.append('uploadFile', arrayBuffer, 'proposal.pdf')
    formData.append('customerID', customerId)
    formData.append('description', description)
    formData.append('showCustomer', showCustomer)
    formData.append('showTech', showTech)

    return await axios.post(url, formData, {
      ...this.getAuthorization(),
      ...formData.getHeaders(),
    })
  }

  async uploadDiagram(
    arrayBuffer: ArrayBuffer,
    customerId: string,
    description: string,
  ) {
    const filePath = await this.getThirdPageFromPDF(arrayBuffer)
    const fileBuffer = await fs.promises.readFile(filePath)

    try {
      await this.uploadProposal(fileBuffer, customerId, description, 0, 1)
    } catch (e) {
      // TODO: print error
    }

    await fs.promises.unlink(filePath)
  }

  async getThirdPageFromPDF(arrayBuffer: ArrayBuffer) {
    const pdfBuffer = Buffer.from(arrayBuffer)
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const pages = pdfDoc.getPages()

    if (pages.length < 3) {
      // TODO: throw error
    }

    const newPDFDoc = await PDFDocument.create()
    const copiedPage = await newPDFDoc.copyPages(pdfDoc, [1])
    newPDFDoc.addPage(copiedPage[0])

    const newPDFBytes = await newPDFDoc.save()

    const tempDir = await fs.promises.realpath(os.tmpdir()) // Get the real path of the temp directory
    const filePath = path.join(tempDir, `${Date.now()}.pdf`)

    await fs.promises.writeFile(filePath, newPDFBytes)

    return filePath
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
