import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common'
import { AppService } from './app.service'
import { ZohoGuard } from './auth/zoho.guard'
import { PestRoutesService } from './pestRoutes.service'
import { PrismaService } from './prisma.service'
import { EmailService } from './email.service'
import * as pdf from 'pdf-parse'

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
  async webhookZohoAppointmentScheduled(@Body() body: ZohoLeadPayload) {
    this.logger.log('webhookZohoAppointmentScheduled for ' + body.leadId)

    const arcSiteProject = await this.appService.createArcSiteProject(body)
    await this.prisma.commercialSales.create({
      data: {
        zohoLeadId: body.leadId,
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

    const { zohoLeadId } = await this.prisma.commercialSales.findUniqueOrThrow({
      where: {
        arcSiteProjectId: project_id,
      },
    })

    const lead = await this.appService.findZohoLead(zohoLeadId)
    const project = await this.appService.getArcSiteProject(project_id)

    const requestDocument = await this.appService.createZohoDocument(
      lead,
      project,
      url,
    )

    // TODO: if a document already exists for this lead and project
    // If so, then do not create a new document and print error
    await this.prisma.commercialSales.update({
      where: { zohoLeadId: lead.id, arcSiteProjectId: project_id },
      data: {
        zohoSignRequestId: requestDocument.request_id,
      },
    })
    await this.appService.addSignatureField(
      requestDocument.request_id,
      requestDocument.document_fields[0].document_id,
      lead.Full_Name,
      lead.Email,
    )
    await this.appService.sendForSignature(requestDocument.request_id)
    await this.appService.updateZohoLead(zohoLeadId, {
      Lead_Status: 'Proposal Sent',
    })
  }

  @Post('zoho/document-signed')
  async webhookZohoDocumentSigned(@Body() body: ZohoSignWebhookPayload) {
    const operationType = body.notifications.operation_type
    const requestId = String(body.requests.request_id)

    if (operationType != 'RequestCompleted') {
      this.logger.log('Invalid notification_type ' + operationType)
      return
    }

    const { id, arcSiteProjectId, zohoLeadId } =
      await this.prisma.commercialSales.findFirst({
        where: {
          zohoSignRequestId: requestId,
        },
      })

    const zohoLead = await this.appService.findZohoLead(zohoLeadId)
    const arcSiteProject = await this.appService.getArcSiteProject(
      arcSiteProjectId,
    )

    const arrayBuffer = await this.appService.getZohoRequestPDFArrayBuffer(
      requestId,
    )
    const pestRouteCustomerCreateResponse =
      await this.pestRouteService.createCustomer(
        zohoLead,
        arcSiteProject,
        arrayBuffer,
      )
    const customerId = pestRouteCustomerCreateResponse.result

    await this.prisma.commercialSales.update({
      where: { id },
      data: {
        pestRoutesCustomerId: Number(customerId),
      },
    })

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

    await this.emailService.send({
      // TODO: use the customer's name
      subject: `New signed contract for ${zohoLead.Full_Name}`,
      // TODO: use the customer's name and ID
      text: `New signed contract for ${zohoLead.Full_Name}.\n\nCustomer ID: ${customerId}\n\nPlease set up subscription.`,
    })
  }

  @Post('test')
  async test(@Body() body: ArcSiteProposalSignedPayload) {
    this.logger.log(JSON.stringify(body))
  }
}
