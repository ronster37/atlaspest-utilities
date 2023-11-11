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
import { AxiosCacheInstance, setupCache } from 'axios-cache-interceptor'

const IS_TEXT = 'Initial Service'
const RS_TEXT = 'Recurring Services'
const TRP_TEXT = 'Total Recurring Price'
const ASI_TEXT = 'Service Specific Details:'
const MUP_TEXT = 'Multi-Unit Property'
const AESA_TEXT = 'At each scheduled appointment'
const INDIVIDUAL_TEXT = 'Individual unit'
const YOU_TEXT = 'You, the'
const IF_TEXT = 'If at any time'

const ONE_TIME_PATTERN = /One[\s-]?Time/i
const BI_MONTHLY_PATTERN = /Bi[\s-]?Monthly/i
const FREQUENCIES_AND_MULTIPLIERS = [
  { pattern: ONE_TIME_PATTERN, multiplier: 0 },
  { pattern: /Weekly/i, multiplier: 51 },
  { pattern: /Every[\s-]?2[\s-]?Weeks/i, multiplier: 25 },
  { pattern: /Twice[\s-]?a[\s-]?Month/i, multiplier: 23 },
  { pattern: /Monthly/i, multiplier: 11 },
  { pattern: BI_MONTHLY_PATTERN, multiplier: 5 },
  { pattern: /Quarterly/i, multiplier: 3 },
  { pattern: /Seasonally/i, multiplier: 7 },
]
const RECURRING_FREQUENCY_PATTERNS = FREQUENCIES_AND_MULTIPLIERS.map(
  (frequency) => frequency.pattern,
)

@Injectable()
export class PestRoutesService {
  private pestRoutesAxiosInstance: AxiosCacheInstance

  constructor(private configService: ConfigService) {
    const axiosInstance = axios.create({
      baseURL: this.configService.get('PESTROUTES_URL'),
      params: {
        authenticationToken: this.configService.get('PESTROUTES_AUTH_TOKEN'),
        authenticationKey: this.configService.get('PESTROUTES_AUTH_KEY'),
      },
    })
    this.pestRoutesAxiosInstance = setupCache(axiosInstance, {
      debug: console.log,
      headerInterpreter: () => 300,
    })
  }

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
    const response = await axios.post<PestRoutesPostCustomerResponse>(
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
    const contractLength = this.getContractLength(pdfText)
    let annualContractValue: currency

    if (ONE_TIME_PATTERN.test(recurringFrequency)) {
      annualContractValue = currency(initialPrice)
    } else {
      for (const frequency of FREQUENCIES_AND_MULTIPLIERS) {
        if (recurringFrequency.match(frequency.pattern)) {
          annualContractValue = currency(recurringPrice)
            .multiply(frequency.multiplier)
            .add(initialPrice)
          break
        }
      }
    }

    return {
      serviceType: this.getServiceType(pdfText),
      initialPrice: initialPrice,
      recurringPrice: recurringPrice,
      recurringFrequency: recurringFrequency,
      contractLength: contractLength,
      // requestedStartDate: await this.getRequestedStartDate(arrayBuffer),
      isMultiUnit: this.isMultiUnit(pdfText),
      unitQuotaPerService: this.getUnitQuotePerService(pdfText),
      additionalServiceInformation: this.getAdditionalServiceInfo(pdfText),
      annualContractValue: annualContractValue.toString(),
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

    if (pdfText.includes(AESA_TEXT)) {
      unitQuote = pdfText.split(AESA_TEXT)[1].match(/\d+/)[0]
    }

    return unitQuote
  }

  getTotalRecurringPrice(pdfText: string) {
    let totalRecurringPrice = ''

    if (pdfText.includes(TRP_TEXT)) {
      totalRecurringPrice = pdfText
        .split(TRP_TEXT)[1]
        .match(/(?:\d{1,}(?:,\d{3})*(?:\.\d+)?)|(?:\d+\.\d+)/)[0]
    }

    return totalRecurringPrice
  }

  getAdditionalServiceInfo(pdfText: string) {
    let additionalServiceInfo = ''

    if (pdfText.includes(ASI_TEXT)) {
      additionalServiceInfo = pdfText
        .split(ASI_TEXT)[1]
        .replace(/Page \d+ of \d+/g, '')

      if (additionalServiceInfo.includes(MUP_TEXT)) {
        additionalServiceInfo = additionalServiceInfo.split(MUP_TEXT)[0]
      } else if (additionalServiceInfo.includes(INDIVIDUAL_TEXT)) {
        additionalServiceInfo = additionalServiceInfo.split(INDIVIDUAL_TEXT)[0]
      } else if (additionalServiceInfo.includes(YOU_TEXT)) {
        additionalServiceInfo = additionalServiceInfo.split(YOU_TEXT)[0]
      } else if (additionalServiceInfo.includes(IF_TEXT)) {
        additionalServiceInfo = additionalServiceInfo.split(IF_TEXT)[0]
      }
    }

    return additionalServiceInfo.trim()
  }

  getServiceType(pdfText: string) {
    const recurringServiceText = this.getRecurringService(pdfText)
    let serviceType = ''

    for (const pattern of RECURRING_FREQUENCY_PATTERNS) {
      const match = recurringServiceText.match(pattern)

      if (match) {
        serviceType = recurringServiceText.replace(pattern, '')
        break // Remove the first match and exit the loop
      }
    }

    return serviceType.trim()
  }

  getRecurringService(pdfText: string) {
    let recurringServiceText = ''

    if (pdfText.includes(RS_TEXT) && pdfText.includes(TRP_TEXT)) {
      recurringServiceText = pdfText
        .split(RS_TEXT)[1]
        .split(TRP_TEXT)[0]
        .replace(/\n/g, ' ')
        .replace(/[^a-zA-Z0-9$,. ]/g, '')
        .trim()
    }

    return recurringServiceText
  }

  getRecurringFrequency(pdfText: string) {
    const recurringServiceText = this.getRecurringService(pdfText)
    let recurringFrequency = ''

    for (const pattern of RECURRING_FREQUENCY_PATTERNS) {
      const match = recurringServiceText.match(pattern)

      if (match) {
        recurringFrequency = match[0]
      }
    }

    return recurringFrequency
  }

  getContractLength(pdfText: string) {
    const pattern = /\d+ (days|months)/g
    let match: RegExpExecArray
    let contractLengthText = ''

    while ((match = pattern.exec(pdfText)) !== null) {
      contractLengthText = match[0]
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

  async getAppointmentsByDate(date: string) {
    const result =
      await this.pestRoutesAxiosInstance.get<PestRoutesGetAppointmentsResponse>(
        '/appointment/search',
        {
          params: {
            date,
          },
        },
      )

    return result.data
  }

  async getAppointmentById(id: number) {
    const result =
      await this.pestRoutesAxiosInstance.get<PestRoutesGetAppointmentResponse>(
        `/appointment/${id}`,
      )

    return result.data
  }

  async getRouteById(id: string) {
    const result =
      await this.pestRoutesAxiosInstance.get<PestRoutesGetRouteResponse>(
        `/route/${id}`,
      )

    return result.data
  }

  async getEmployeeById(id: string) {
    const result =
      await this.pestRoutesAxiosInstance.get<PestRoutesGetEmployeeResponse>(
        `/employee/${id}`,
      )

    return result.data
  }

  async getCustomerById(id: string) {
    const result =
      await this.pestRoutesAxiosInstance.get<PestRoutesGetCustomerResponse>(
        `/customer/${id}`,
      )

    console.log(result.cached)
    return result.data
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
