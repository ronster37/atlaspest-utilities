import { Injectable, Logger } from '@nestjs/common'
import { DateTime } from 'luxon'
import { FrontService } from 'src/front/front.service'
import { PestRoutesService } from 'src/pestRoutes.service'

import * as currency from 'currency.js'
import * as Handlebars from 'handlebars'

@Injectable()
export class PestRoutesRemindersService {
  private readonly logger = new Logger(PestRoutesRemindersService.name)

  constructor(
    private pestRoutesService: PestRoutesService,
    private frontService: FrontService,
  ) {}

  async sendAppointmentReminder(body: PestRoutesRemindersAppointmentBody) {
    const {
      customerId,
      customerNumber,
      method,
      serviceDate,
      serviceDescription,
    } = body
    const { customer } = await this.pestRoutesService.getCustomerById(
      customerId,
    )
    const serviceAddress = `${customer.address} ${customer.city}, ${customer.state} ${customer.zip}`
    const formattedServiceDate =
      DateTime.fromISO(serviceDate).toFormat('MMMM d')

    if (method === 'email') {
      const { body, subject } = await this.frontService.getTemplate('rsp_mwfyq')
      const template = Handlebars.compile(body)
      const subjectTemplate = Handlebars.compile(subject)
      const channelId = 'cha_9rc0i'

      await this.frontService.sendEmail({
        to: customer.email,
        subject: subjectTemplate({
          serviceDate: formattedServiceDate,
        }),
        body: template({
          accountNumber: customerNumber,
          serviceDate: formattedServiceDate,
          ServiceType: serviceDescription,
          serviceAddress,
        }),
        channelId,
      })
    } else if (method === 'sms') {
      const { body } = await this.frontService.getTemplate('rsp_ot0k2')
      const template = Handlebars.compile(body)
      const channelId = 'cha_ap76a'

      await this.frontService.sendSMS({
        to: customer.phone1,
        body: template({
          firstName: customer.fname,
          serviceDate: formattedServiceDate,
          ServiceType: serviceDescription,
          serviceAddress,
        }),
        channelId,
      })
    } else {
      this.logger.error(`Method '${method}' not recognized.`)
    }
  }

  async sendBillingReminder(body: PestRoutesRemindersBillingBody) {
    const { method, customerId, responsibleBalance, daysPastDue, loginLink } =
      body
    const { customer } = await this.pestRoutesService.getCustomerById(
      customerId,
    )
    const serviceAddress = `${customer.address} ${customer.city}, ${customer.state} ${customer.zip}`

    if (method === 'email') {
      const { body, subject } = await this.frontService.getTemplate('rsp_ot0lu')
      const template = Handlebars.compile(body)
      const subjectTemplate = Handlebars.compile(subject)
      const channelId = 'cha_9rc0i'

      await this.frontService.sendEmail({
        to: customer.email,
        subject: subjectTemplate({}),
        body: template({
          BillingFName: customer.billingFName,
          responsibleBalance: currency(responsibleBalance).format(),
          address: serviceAddress,
          daysPastDue,
          loginLink,
        }),
        channelId,
      })
    } else if (method === 'sms') {
      const { body } = await this.frontService.getTemplate('rsp_ot0nm')
      const template = Handlebars.compile(body)
      const channelId = 'cha_ap76a'

      await this.frontService.sendSMS({
        to: customer.phone1,
        body: template({
          BillingFName: customer.billingFName,
          responsibleBalance: currency(responsibleBalance).format(),
          daysPastDue,
          loginLink,
        }),
        channelId,
      })
    } else {
      this.logger.error(`Method '${method}' not recognized.`)
    }
  }

  async sendBedBugReminder(body: PestRoutesRemindersBedBugBody) {
    const { customerId } = body
    const { customer } = await this.pestRoutesService.getCustomerById(
      customerId,
    )

    const {
      body: templateStr,
      subject,
      attachments,
    } = await this.frontService.getTemplate('rsp_os5oy')
    const template = Handlebars.compile(templateStr)
    const channelId = 'cha_9rc0i'

    await this.frontService.sendEmail({
      to: customer.email,
      subject,
      body: template({
        recipient: {
          first_name: customer.fname,
        },
      }),
      channelId,
      attachmentUrl: attachments[0].url,
      attachmentName: 'Bed Bug Protocol.pdf',
    })
  }
}
