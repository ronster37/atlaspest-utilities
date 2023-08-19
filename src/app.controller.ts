import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common'
import { AppService } from './app.service'
import { ZohoGuard } from './auth/zoho.guard'
import { PestRoutesService } from './pestRoute.service'
import { PrismaService } from './prisma.service'

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name)

  constructor(
    private readonly appService: AppService,
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
  }

  @Post('arc-site/proposal-signed')
  async webhookArcSiteProposalSigned(
    @Body() body: ArcSiteProposalSignedPayload,
  ) {
    const project = await this.appService.getArcSiteProject(body.project_id)
    const lead = await this.appService.findZohoLead(project.job_number)

    const requestDocument = await this.appService.createZohoDocument(
      lead.Full_Name,
      body.url,
    )

    // TODO: if a document already exists for this lead and project
    // If so, then do not create a new document and print error
    await this.prisma.commercialSales.update({
      where: { zohoLeadId: lead.id, arcSiteProjectId: body.project_id },
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
  }

  @Post('zoho/document-signed')
  async webhookZohoDocumentSigned(@Body() body: ZohoSignWebhookPayload) {
    if (body.notifications.operation_type != 'RequestCompleted') {
      this.logger.log(
        'Invalid notification_type ' + body.notifications.operation_type,
      )
      return
    }

    const { zohoLeadId, arcSiteProjectId } =
      await this.prisma.commercialSales.findFirst({
        where: {
          zohoSignRequestId: String(body.requests.request_id),
        },
      })
    // TODO: Which info to user, the lead or the project?
    const zohoLead = await this.appService.findZohoLead(zohoLeadId)

    await this.pestRouteService.createCustomer(zohoLead)
    // await this.pestRouteService.createDocument()
    // TODO: extra credit - extract the third page
    // await this.pestRouteService.createServiceDiagramDocument()
    // await this.emailService.send({
    //   to: 'r4castil@gmail.com',
    //   from: 'ron@atlaspest.com',
    //   // TODO: use the customer's name
    //   // subject: `New signed contract for ${'fullname'}`,
    //   subject: 'New signed contract',
    //   // TODO: use the customer's name and ID
    //   // text: `New signed contract for ${'fullname'}.\n\nCustomer ID: ${'customer_id'}\n\nPlease set up subscription.`,
    //   text: 'New signed contract.\n\nPlease set up subscription.',
    // })
  }

  @Get()
  async test() {
    return this.prisma.commercialSales.count()
  }
}
