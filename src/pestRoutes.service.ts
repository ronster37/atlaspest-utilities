import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PDFDocument } from 'pdf-lib'
import axios from 'axios'
import * as FormData from 'form-data'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as pdf from 'pdf-parse'
import { DateTime } from 'luxon'
import * as currency from 'currency.js'

const IS_TEXT = 'Initial Service'
const RS_TEXT = 'Recurring Services'
const TRP_TEXT = 'Total Recurring Price'
const ASI_TEXT = 'Additional Service Information'
const MUP_TEXT = 'Multi-Unit Property'
const UQPS_TEXT = 'Unit quota per service'
const FOR_TEXT = '*For'

@Injectable()
export class PestRoutesService {
  constructor(private configService: ConfigService) {}

  async createCustomer(
    zohoContact: ZohoContact,
    zohoDeal: ZohoDeal,
    arcSiteProject: ArcSiteProject,
    arrayBuffer: Buffer,
  ) {
    const url = `${this.configService.get('PESTROUTES_URL')}/customer/create`
    const result = await pdf(arrayBuffer)
    const pdfText = result.text
    const isMultiUnit = await this.isMultiUnit(pdfText)
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

  async getProposalDetails(arrayBuffer: Buffer) {
    const result = await pdf(arrayBuffer)
    const pdfText = result.text

    const recurringPrice = this.getTotalRecurringPrice(pdfText)
    const recurringFrequency = this.getRecurringFrequency(pdfText)
    const initialPrice = this.getInitialTotal(pdfText)
    const frequencies = {
      daily: 365, // Contracts that occur daily (365 days a year)
      weekly: 52, // Contracts that occur weekly (52 weeks a year)
      biweekly: 26, // Contracts that occur every two weeks (26 times a year)
      monthly: 12, // Contracts that occur monthly (12 times a year)
      bimonthly: 6, // Contracts that occur every two months (6 times a year)
      quarterly: 4, // Contracts that occur quarterly (4 times a year)
      semiannually: 2, // Contracts that occur semiannually (2 times a year)
      annually: 1, // Contracts that occur annually (1 time a year)
    }

    return {
      serviceType: this.getServiceType(pdfText),
      initialPrice: initialPrice,
      recurringPrice: recurringPrice,
      recurringFrequency: recurringFrequency,
      contractLength: this.getContractLength(pdfText),
      // requestedStartDate: await this.getRequestedStartDate(arrayBuffer),
      isMultiUnit: this.isMultiUnit(pdfText),
      unitQuotaPerService: this.getUnitQuotePerService(pdfText),
      additionalServiceInformation: this.getAdditionalServiceInfo(pdfText),
      annualContractValue: currency(recurringPrice)
        .multiply(frequencies[recurringFrequency.toLowerCase()])
        .add(initialPrice || 0)
        .toString(),
    }
  }

  getInitialTotal(pdfText: string) {
    let total = ''

    if (pdfText.includes(IS_TEXT)) {
      total = pdfText
        .split(IS_TEXT)[1]
        .split('Total')[1]
        .match(/(?:\d{1,3}(?:,\d{3})*(?:\.\d+)?)|(?:\d+\.\d+)/)[0]
    }

    return total
  }

  isMultiUnit(pdfText: string) {
    return (
      pdfText.includes('Multi-Unit Property') &&
      pdfText
        .split('Multi-Unit Property')[1]
        .substring(0, 5)
        .toLowerCase()
        .replace(/\s/g, '')
        .indexOf('yes') > -1
    )
  }

  getUnitQuotePerService(pdfText: string) {
    let unitQuote = ''

    if (pdfText.includes(UQPS_TEXT)) {
      unitQuote = pdfText.split(UQPS_TEXT)[1].match(/\d+/)[0]
    }

    return unitQuote
  }

  getTotalRecurringPrice(pdfText: string) {
    let totalRecurringPrice = ''

    if (pdfText.includes(TRP_TEXT)) {
      totalRecurringPrice = pdfText
        .split(TRP_TEXT)[1]
        .match(/(?:\d{1,3}(?:,\d{3})*(?:\.\d+)?)|(?:\d+\.\d+)/)[0]
    }

    return totalRecurringPrice
  }

  getAdditionalServiceInfo(pdfText: string) {
    let additionalServiceInfo = ''

    if (pdfText.includes(ASI_TEXT)) {
      additionalServiceInfo = pdfText.split(ASI_TEXT)[1]

      if (additionalServiceInfo.includes(MUP_TEXT)) {
        additionalServiceInfo = additionalServiceInfo.split(MUP_TEXT)[0]
      } else if (additionalServiceInfo.includes(UQPS_TEXT)) {
        additionalServiceInfo = additionalServiceInfo.split(UQPS_TEXT)[0]
      } else if (additionalServiceInfo.includes(FOR_TEXT)) {
        additionalServiceInfo = additionalServiceInfo.split(FOR_TEXT)[0]
      }
    }

    return additionalServiceInfo.trim()
  }

  getServiceType(pdfText: string) {
    const recurringServiceText = this.getRecurringService(pdfText)
    return recurringServiceText.replace(/^\S+\s*/, '')
  }

  getRecurringService(pdfText: string) {
    let recurringServiceText = ''

    if (pdfText.includes(RS_TEXT) && pdfText.includes(TRP_TEXT)) {
      recurringServiceText = pdfText
        .split(RS_TEXT)[1]
        .split(TRP_TEXT)[0]
        .replace(/[^a-zA-Z0-9$,. ]/g, '')
    }

    return recurringServiceText
  }

  getRecurringFrequency(pdfText: string) {
    const recurringServiceText = this.getRecurringService(pdfText)
    return recurringServiceText.split(' ')[0]
  }

  getContractLength(pdfText: string) {
    let contractLengthText = ''

    if (pdfText.includes('initial period of')) {
      contractLengthText = pdfText
        .split('initial period of')[1]
        .trim()
        .split(' ')
        .slice(0, 2)
        .join(' ')
        .replace(/\./g, '')
    }

    return contractLengthText
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

  async createRedNote(customerId: string, note: string) {
    const url = `${this.configService.get('PESTROUTES_URL')}/note/create`
    const requestData = {
      customerID: customerId,
      date: DateTime.now()
        .setZone('America/Los_Angeles')
        .toFormat('yyyy-MM-dd'),
      // This sets the note as a red note
      contactType: 8,
      showOnInvoice: 0,
      notes: note,
      showTech: 1,
      showCustomer: 0,
    }

    await axios.post(url, requestData, this.getAuthorization())
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
