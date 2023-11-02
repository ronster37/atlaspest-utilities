import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common'
import { AppService } from './app.service'
import axios, { AxiosError } from 'axios'
import { ZohoGuard } from './auth/zoho.guard'
import { PestRoutesService } from './pestRoutes.service'
import { PrismaService } from './prisma.service'
import { EmailService } from './email.service'
import { DateTime } from 'luxon'

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name)

  constructor(
    private readonly appService: AppService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly pestRouteService: PestRoutesService,
  ) {}

  @UseGuards(ZohoGuard)
  @Post('zoho/appointment-scheduled')
  async webhookZohoAppointmentScheduled(@Body() body: ZohoDealPayload) {
    this.logger.log('incoming webhookZohoAppointmentScheduled ' + body.dealId)
    this.logger.log(JSON.stringify(body))

    try {
    const arcSiteProject = await this.appService.createArcSiteProject(body)
    await this.prisma.commercialSales.create({
      data: {
        zohoDealId: body.dealId,
        zohoContactId: body.contactId,
        arcSiteProjectId: arcSiteProject.id,
      },
    })
    await this.appService.updateArcSiteProject(arcSiteProject.id, body)
    } catch (error) {
      // If it is a duplicate project name error, send an email to the sales rep
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError
        if (axiosError.response?.status === 400) {
          const data: any = axiosError.response.data

          if ('message' in data) {
            const message: string = data.message

            if (message.includes('project name already exists')) {
              await this.emailService.send({
                to: body.salesRep.email,
                subject: `Duplicate ArcSite project for ${
                  body.company
                } @ ${new Date().toISOString()}`,
                text: `Duplicate ArcSite project for ${body.company}`,
              })
            } else {
              throw error
            }
          } else {
            throw error
          }
        } else {
          // If it's not a 400 error, rethrow the error
          throw error
        }
      } else {
        // If it's not an Axios error, rethrow the error
        throw error
      }
    }
  }

  @Post('arc-site/proposal-signed')
  async webhookArcSiteProposalSigned(
    @Body() body: ArcSiteProposalSignedPayload,
  ) {
    this.logger.log('incoming webhook webhookArcSiteProposalSigned', body)
    const { project_id, url } = body.data

    const commercialSale = await this.prisma.commercialSales.findUnique({
      where: {
        arcSiteProjectId: project_id,
      },
    })

    // Skip this step for arc-site projects that are created without a Zoho deal
    if (!commercialSale) {
      this.logger.log(`No commercial sale found for project_id ${project_id}`)
      return
    }

    const { zohoContactId, zohoDealId } = commercialSale
    const contact = await this.appService.getZohoContact(zohoContactId)
    const deal = await this.appService.getZohoDeal(zohoDealId)
    const project = await this.appService.getArcSiteProject(project_id)

    const requestDocument = await this.appService.createZohoDocument(
      contact,
      deal,
      project,
      url,
    )

    // TODO: Check if a document already exists for this lead and project
    // If so, then do not create a new document and print error
    await this.prisma.commercialSales.update({
      where: { zohoDealId: zohoDealId, arcSiteProjectId: project_id },
      data: {
        zohoSignRequestId: requestDocument.request_id,
      },
    })
    await this.appService.addFields(
      requestDocument.request_id,
      requestDocument.document_fields[0].document_id,
      contact.Full_Name,
      contact.Email,
      requestDocument.document_ids[0].total_pages - 1,
      `${project.sales_rep.firstName} ${project.sales_rep.lastName}`,
      project.sales_rep.email,
    )
    await this.appService.sendForSignature(requestDocument.request_id)

    const arrayBuffer = await this.appService.getZohoRequestPDFArrayBuffer(
      requestDocument.request_id,
    )

    // Update the stage before the pdf parsing
    await this.appService.updateZohoDeal(deal.id, {
      Stage: 'Proposal Sent',
    })

    const proposalDetails = await this.pestRouteService.getProposalDetails(
      arrayBuffer,
    )

    this.logger.log('proposalDetails ' + JSON.stringify(proposalDetails))
    await this.appService.updateZohoDeal(deal.id, {
      Service_Type: proposalDetails.serviceType,
      Initial_Price: proposalDetails.initialPrice,
      Contract_Length: proposalDetails.contractLength,
      Additional_Service_Information:
        proposalDetails.additionalServiceInformation,
      Annual_Contract_Value: proposalDetails.annualContractValue,
      Recurring_Price: proposalDetails.recurringPrice,
      Recurring_Frequency: proposalDetails.recurringFrequency,
      Multi_Unit_Property: proposalDetails.isMultiUnit,
      Unit_Quota_per_Service: proposalDetails.unitQuotaPerService,
      Date_Proposal_Sent: DateTime.local()
        .setZone('America/Denver')
        .toFormat('yyyy-MM-dd'),
    })
  }

  @Post('zoho/document-signed')
  async webhookZohoDocumentSigned(@Body() body: ZohoSignWebhookPayload) {
    this.logger.log('incoming webhookZohoDocumentSigned ' + body)
    const operationType = body.notifications.operation_type
    const requestId = String(body.requests.request_id)

    if (operationType != 'RequestCompleted') {
      this.logger.log('Invalid notification_type ' + operationType)
      return
    }

    const { id, arcSiteProjectId, zohoContactId, zohoDealId } =
      await this.prisma.commercialSales.findFirstOrThrow({
        where: {
          zohoSignRequestId: requestId,
        },
      })

    const zohoContact = await this.appService.getZohoContact(zohoContactId)
    const zohoDeal = await this.appService.getZohoDeal(zohoDealId)
    const arcSiteProject = await this.appService.getArcSiteProject(
      arcSiteProjectId,
    )

    const arrayBuffer = await this.appService.getZohoRequestPDFArrayBuffer(
      requestId,
    )
    const pestRouteCustomerCreateResponse =
      await this.pestRouteService.createCustomer(
        zohoContact,
        zohoDeal,
        arcSiteProject,
        arrayBuffer,
      )
    const customerId = pestRouteCustomerCreateResponse.result

    // Once the customer is created, update the commercial sale with the pestRoutesCustomerId
    await this.prisma.commercialSales.update({
      where: { id },
      data: {
        pestRoutesCustomerId: Number(customerId),
      },
    })

    await this.pestRouteService.createAdditionalContactIfSecondEmailOrPhoneExists(
      customerId,
      zohoContact,
      arcSiteProject,
    )

    await this.pestRouteService.uploadProposal(
      arrayBuffer,
      customerId,
      'Signed Contract',
      1,
      0,
    )
    await this.pestRouteService.uploadDiagram(
      arrayBuffer,
      customerId,
      'Service Diagram',
    )

    const proposalDetails = await this.pestRouteService.getProposalDetails(
      arrayBuffer,
    )

    if (proposalDetails.additionalServiceInformation) {
      await this.pestRouteService.createRedNote(
        customerId,
        proposalDetails.additionalServiceInformation,
      )
    }

    await this.appService.updateZohoDeal(zohoDealId, {
      Stage: 'Sold',
    })
    // TODO: Add requested start date
    await this.emailService.send({
      subject: `New signed contract for ${zohoContact.Full_Name}`,
      text: `New signed contract for ${zohoContact.Full_Name}.

Customer ID: ${customerId}
Service Type: ${proposalDetails.serviceType}
Initial Price: ${proposalDetails.initialPrice}
Recurring Price: ${proposalDetails.recurringPrice}
Recurring Frequency: ${proposalDetails.recurringFrequency}
Contract Length: ${proposalDetails.contractLength}
Unit Quota per Service: ${proposalDetails.unitQuotaPerService}
Additional Service Information: ${proposalDetails.additionalServiceInformation}

Please set up subscription.
`,
    })
  }

  @Post('test')
  async test(@Body() body: ArcSiteProposalSignedPayload) {
    this.logger.log(JSON.stringify(body))
  }
}
