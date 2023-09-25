import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common'
import { AppService } from './app.service'
import { ZohoGuard } from './auth/zoho.guard'
import { PestRoutesService } from './pestRoutes.service'
import { PrismaService } from './prisma.service'
import { EmailService } from './email.service'

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
    this.logger.log('webhookZohoAppointmentScheduled for ' + body.dealId)
    this.logger.log(JSON.stringify(body))

    const arcSiteProject = await this.appService.createArcSiteProject(body)
    await this.prisma.commercialSales.create({
      data: {
        zohoDealId: body.dealId,
        zohoContactId: body.contactId,
        arcSiteProjectId: arcSiteProject.id,
      },
    })
    await this.appService.updateArcSiteProject(arcSiteProject.id, body)
  }

  @Post('arc-site/proposal-signed')
  async webhookArcSiteProposalSigned(
    @Body() body: ArcSiteProposalSignedPayload,
  ) {
    this.logger.log('body', body)
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
    await this.appService.addSignatureField(
      requestDocument.request_id,
      requestDocument.document_fields[0].document_id,
      contact.Full_Name,
      contact.Email,
    )
    await this.appService.sendForSignature(requestDocument.request_id)
    await this.appService.updateZohoDeal(deal.id, 'Proposal Sent')
  }

  @Post('zoho/document-signed')
  async webhookZohoDocumentSigned(@Body() body: ZohoSignWebhookPayload) {
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
    const info = await this.pestRouteService.getAdditionalServiceInfo(
      arrayBuffer,
    )

    if (info) {
      await this.pestRouteService.createRedNote(customerId, info)
    }

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

    await this.appService.updateZohoDeal(zohoDeal.id, 'Sold')
    await this.emailService.send({
      subject: `New signed contract for ${zohoContact.Full_Name}`,
      text: `New signed contract for ${zohoContact.Full_Name}.\n\nCustomer ID: ${customerId}\n\nPlease set up subscription.`,
    })
  }

  @Post('test')
  async test(@Body() body: ArcSiteProposalSignedPayload) {
    this.logger.log(JSON.stringify(body))
  }
}
