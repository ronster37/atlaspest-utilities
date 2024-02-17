import { Body, Controller, Get, Logger, Post } from '@nestjs/common'
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
  FREQUENCY_KEY,
  INITIAL_PRICE_KEY,
  MULTI_UNIT_PROPERTY_KEY,
  PROPOSAL_DATE_KEY,
  RECURRING_PRICE_KEY,
  SERVICE_INFORMATION_KEY,
  SERVICE_TYPE_KEY,
  STATE_KEY,
  UNIT_QUOTA_KEY,
  ZIP_KEY,
} from './constants'
import { PipedriveWebhookDealAddedBody } from './interfaces'

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

  @Get('test')
  test() {
    this.pipedriveService.updateDeal(15, {
      [INITIAL_PRICE_KEY]: '15.01',
    })
    // return this.pipedriveService.getPerson(4)
    // const opts = pipedrive.UpdateDealRequest.constructFromObject({
    //   '8f815bd5b858e3fd84fa5b6751a7249aa69e489c': '100',
    //   '220f3abc921170b7c7e189fb15bbc30852cb7bda': '54',
    //   '6b2fb6c2b6e83d8d170c12a3d8ee2e9788689b03': DateTime.local()
    //     .setZone('America/Denver')
    //     .toFormat('yyyy-MM-dd'),
    //   f0bb0ff690b79053b45ef21ee9e0205356f6afac: `We will treat up to 10 units per service, we will do all basic insects including hornets and wasps at our
    //     regular price including cockroaches and crawling insects.
    //     Bed bugs are a separate charge.
    //     We will treat the clubhouse at each service and de web it to help maintain high visual standards and
    //     eliminate spider activity.
    //     If services need to be more than monthly we can do weekly and every other week so we can be efficient
    //     and cost productive for the complex.
    //     If there aren’t 10 units to do we will treat the exterior of buildings.`,
    //   stageId: 3,
    // })
    // this.pipedriveService.dealsApi.updateDeal(4, opts)
  }

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
      company: `[Pipedrive Test] ${body.current.org_name}`,
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
      deal.org_name,
      project,
      url,
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
      stage_id: 2,
    })

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
  }
}
