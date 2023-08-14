import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common'
import { AppService } from './app.service'
import { ZohoGuard } from './auth/zoho.guard'

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name)

  constructor(private readonly appService: AppService) {}

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
}
