import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PDFDocument } from 'pdf-lib'
import axios from 'axios'
import * as FormData from 'form-data'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

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

  async uplodDiagram(
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
