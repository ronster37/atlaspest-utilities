import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common'
import { PipedriveService } from './pipedrive.service'
import { AppService } from 'src/app.service'
import { EmailService } from 'src/email.service'
import { PrismaService } from 'src/prisma.service'
import axios, { AxiosError } from 'axios'
import { PestRoutesService } from 'src/pestRoutes.service'
import { DateTime } from 'luxon'
import {
  ADDRESS_KEY,
  CITY_KEY,
  CONTRACT_LENGTH_KEY,
  CONTRACT_VALUE_KEY,
  DATE_SIGNED_KEY,
  FREQUENCY_KEY,
  INITIAL_PRICE_KEY,
  IS_THIS_AN_UPSELL_KEY,
  MULTI_UNIT_PROPERTY_KEY,
  PEST_ROUTES_ID_KEY,
  PROPOSAL_DATE_KEY,
  RECURRING_PRICE_KEY,
  SERVICE_INFORMATION_KEY,
  SERVICE_TYPE_KEY,
  STAGE_PROPOSAL_SENT,
  STAGE_SOLD,
  STATE_KEY,
  UNIT_QUOTA_KEY,
  ZIP_KEY,
} from './constants'
import { PipedriveWebhookDealAddedBody } from './interfaces'
import { BasicAuthGuard } from 'src/auth/basic-auth.guard'
import * as Sentry from '@sentry/node'

@Controller('pipedrive')
export class PipedriveController {
  private readonly logger = new Logger(PipedriveController.name)

  constructor(
    private readonly appService: AppService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly pipedriveService: PipedriveService,
    private readonly pestRouteService: PestRoutesService,
  ) {}

  @UseGuards(BasicAuthGuard)
  @Post('appointment-scheduled')
  async wehookAppointmentScheduled(
    @Body() body: PipedriveWebhookDealAddedBody,
  ) {
    const personId = body.current.person_id
    const person = await this.pipedriveService.getPerson(personId)
    const deal = await this.pipedriveService.getDeal(body.current.id)

    const zohoDealPayload: ZohoDealPayload = {
      dealId: '',
      contactId: '',
      company: `[Pipedrive] ${body.current.title}`,
      customer: {
        firstName: person.first_name,
        lastName: person.last_name,
        email: person.email[0]?.value,
        secondEmail: person.email[1]?.value,
        phone: person.phone[0]?.value,
        secondPhone: person.phone[1]?.value,
      },
      workSite: {
        street: deal[ADDRESS_KEY],
        city: deal[CITY_KEY],
        state: deal[STATE_KEY],
        zip: deal[ZIP_KEY],
      },
      salesRep: {
        email: deal.user_id.email,
        name: deal.user_id.name,
        firstName: deal.user_id.name.split(' ')[0],
        lastName: deal.user_id.name.split(' ')[1],
        phone: '',
      },
    }

    try {
      const arcSiteProject = await this.appService.createArcSiteProject(
        zohoDealPayload,
      )
      await this.prisma.commercialSales.create({
        data: {
          pipedriveDealId: String(deal.id),
          arcSiteProjectId: arcSiteProject.id,
        },
      })
      await this.appService.updateArcSiteProject(
        arcSiteProject.id,
        zohoDealPayload,
      )
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
                to: zohoDealPayload.salesRep.email,
                subject: `Duplicate ArcSite project for ${
                  zohoDealPayload.company
                } @ ${new Date().toISOString()}`,
                text: `Duplicate ArcSite project for ${zohoDealPayload.company}`,
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
    this.logger.log(
      'incoming webhook webhookArcSiteProposalSigned (pipedrive)',
      body,
    )

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

    if (!commercialSale.pipedriveDealId) {
      this.logger.log(`No Pipedrive Deal Id found. Skipping arcsite webhook.`)
      return
    }

    const deal = await this.pipedriveService.getDeal(
      commercialSale.pipedriveDealId,
    )
    const project = await this.appService.getArcSiteProject(project_id)
    const salesRepEmail = project.sales_rep.email.toLowerCase()

    const requestDocument = await this.appService.createZohoDocument(
      deal.person_name.split(' ')[0],
      deal.title,
      project,
      url,
    )
    await this.pipedriveService.uploadFileToDealWithURL(
      deal.id,
      url,
      'missing_customer_signature',
    )

    // TODO: Check if a document already exists for this lead and project
    // If so, then do not create a new document and print error
    await this.prisma.commercialSales.update({
      where: {
        pipedriveDealId: commercialSale.pipedriveDealId,
        arcSiteProjectId: project_id,
      },
      data: {
        zohoSignRequestId: requestDocument.request_id,
      },
    })
    await this.appService.addFields(
      requestDocument.request_id,
      requestDocument.document_fields[0].document_id,
      deal.person_id.name,
      deal.person_id.email[0].value,
      deal.person_id.phone[0].value,
      requestDocument.document_ids[0].total_pages - 1,
      salesRepEmail,
    )
    await this.appService.sendForSignature(
      requestDocument.request_id,
      salesRepEmail,
    )

    const arrayBuffer = await this.appService.getZohoRequestPDFArrayBuffer(
      requestDocument.request_id,
    )

    // Update the stage before the pdf parsing
    await this.pipedriveService.updateDeal(deal.id, {
      stage_id: STAGE_PROPOSAL_SENT,
    })

    try {
      const proposalDetails = await this.pestRouteService.getProposalDetails(
        arrayBuffer,
      )

      this.logger.log('proposalDetails ' + JSON.stringify(proposalDetails))
      await this.pipedriveService.updateDeal(deal.id, {
        [SERVICE_TYPE_KEY]: proposalDetails.serviceType,
        [INITIAL_PRICE_KEY]: proposalDetails.initialPrice,
        [CONTRACT_LENGTH_KEY]: proposalDetails.contractLength,
        [SERVICE_INFORMATION_KEY]: proposalDetails.additionalServiceInformation,
        [CONTRACT_VALUE_KEY]: proposalDetails.annualContractValue,
        [RECURRING_PRICE_KEY]: proposalDetails.recurringPrice,
        [FREQUENCY_KEY]: proposalDetails.recurringFrequency,
        [MULTI_UNIT_PROPERTY_KEY]: proposalDetails.isMultiUnit ? 'Yes' : 'No',
        [UNIT_QUOTA_KEY]: proposalDetails.unitQuotaPerService,
        [PROPOSAL_DATE_KEY]: DateTime.local()
          .setZone('America/Denver')
          .toFormat('yyyy-MM-dd'),
      })
    } catch (exception) {
      Sentry.captureException(exception)
      await this.emailService.send({
        to: salesRepEmail,
        subject: `Error parsing proposal details @ ${new Date().toISOString()}`,
        text:
          `Could not parse proposal details for ZohoSignDocument ${requestDocument.request_id}. ` +
          `You will need to input the proposal details manually for PipedriveDeal ${deal.id}.`,
      })
    }
  }

  @Post('/document-signed')
  async webhookDocumentSigned(@Body() body: ZohoSignWebhookPayload) {
    this.logger.log(
      'incoming webhookDocumentSigned (pipedrive) ' + JSON.stringify(body),
    )
    const operationType = body.notifications.operation_type
    const requestId = String(body.requests.request_id)

    if (operationType != 'RequestCompleted') {
      this.logger.log('Invalid notification_type ' + operationType)
      return
    }

    const { id, arcSiteProjectId, pipedriveDealId } =
      await this.prisma.commercialSales.findFirstOrThrow({
        where: {
          zohoSignRequestId: requestId,
        },
      })

    if (!pipedriveDealId) {
      this.logger.log(
        `No Pipedrive Deal Id found. Skipping document signed webhook.`,
      )
      return
    }

    const deal = await this.pipedriveService.getDeal(pipedriveDealId)
    const person = await this.pipedriveService.getPerson(deal.person_id.value)
    const arcSiteProject = await this.appService.getArcSiteProject(
      arcSiteProjectId,
    )

    const arrayBuffer = await this.appService.getZohoRequestPDFArrayBuffer(
      requestId,
    )
    let customerId: string

    // If it's an upsell reuse the existing PR customer
    if (deal[IS_THIS_AN_UPSELL_KEY] == 'Yes') {
      customerId = deal[PEST_ROUTES_ID_KEY]
    } else {
      const pestRouteCustomerCreateResponse =
        await this.pestRouteService.createCustomer(
          person.first_name,
          person.last_name,
          deal.title,
          arcSiteProject,
          arrayBuffer,
        )
      customerId = pestRouteCustomerCreateResponse.result
    }

    // Once the customer is created, update the commercial sale with the pestRoutesCustomerId
    await this.prisma.commercialSales.update({
      where: { id },
      data: {
        pestRoutesCustomerId: Number(customerId),
      },
    })

    // Skip this step for upsells
    if (deal[IS_THIS_AN_UPSELL_KEY] == 'Yes') {
      await this.pestRouteService.createAdditionalContactIfSecondEmailOrPhoneExists(
        customerId,
        person.first_name,
        person.last_name,
        arcSiteProject,
      )
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
    await this.pipedriveService.uploadFileToDealWithArrayBuffer(
      deal.id,
      arrayBuffer,
      'signed_contract',
    )

    try {
      const proposalDetails = await this.pestRouteService.getProposalDetails(
        arrayBuffer,
      )

      if (proposalDetails.additionalServiceInformation) {
        let redNote = proposalDetails.additionalServiceInformation

        if (proposalDetails.unitQuotaPerService) {
          redNote += `\n\nUnit Quota per Service: ${proposalDetails.unitQuotaPerService}`
        }

        await this.pestRouteService.createRedNote(customerId, redNote)
      }

      // TODO: Add requested start date
      await this.emailService.send({
        subject: `New signed contract for ${deal.person_name}`,
        text: `New signed contract for ${deal.person_name}.

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
    } catch (exception) {
      Sentry.captureException(exception)

      await this.emailService.send({
        subject: `New signed contract for ${deal.person_name}`,
        text: `New signed contract for ${deal.person_name}.

  Customer ID: ${customerId}

  Could not parse proposal details for ZohoSignDocument ${requestId}.
  You will need to input the red notes (additional service info and Unit Quota per Service) manually for PestRoutes customer ${customerId}.

  Please set up subscription.
  `,
      })
    }

    const dateSigned = DateTime.fromMillis(body.notifications.performed_at, {
      zone: 'America/Denver',
    }).toFormat('yyyy-MM-dd')
    await this.pipedriveService.updateDeal(deal.id, {
      stage_id: STAGE_SOLD,
      [PEST_ROUTES_ID_KEY]: customerId,
      [DATE_SIGNED_KEY]: dateSigned,
    })
  }
}
