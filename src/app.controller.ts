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
    private readonly pestRouteService: PestRoutesService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(ZohoGuard)
  @Post()
  async webhookZohoAppointmentScheduled(@Body() body: ZohoLeadPayload) {
    // TODO: REMOVE when deploying to prod
    if (body.customer.name !== 'Ron Test Testing') {
      console.log('SKIPPING ZOHO WEBHOOK')
      return
    }

    await this.appService.createArcSiteProject(body)
  }

  @Post()
  async webhookArcSiteProposalSigned(
    @Body() body: ArcSiteProposalSignedPayload,
  ) {
    const project = await this.appService.getArcSiteProject(body.project_id)
    const lead = await this.appService.findZohoLead(project.job_number)
    const filePath = await this.appService.downloadProposal(body.url)

    const requestDocument = await this.appService.createZohoDocument(
      lead.Full_Name,
      filePath,
    )
    await this.appService.addSignatureField(
      requestDocument.request_id,
      requestDocument.document_fields[0].document_id,
      lead.Full_Name,
      lead.Email,
    )
    await this.appService.sendForSignature(requestDocument.request_id)
  }

  @Post('zoho-document-signed')
  async webhookZohoDocumentSigned(@Body() body: ZohoSignWebhookPayload) {
    // await this.pestRouteService.createCustomer()
    // await this.pestRouteService.createDocument()
    // TODO: extra credit - extract the third page
    // await this.pestRouteService.createServiceDiagramDocument()
  }

  @Get()
  async test() {
    return this.prisma.commercialSales.count()
  }
}
