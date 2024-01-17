import { Controller, Get, Logger, Param, Query } from '@nestjs/common'
import { BonjoroService } from '../bonjoro/bonjoro.service'
import { ConfigService } from '@nestjs/config'
import { PestRoutesService } from 'src/pestRoutes.service'
import { DateTime } from 'luxon'
import { GreetManagerService } from './greet-manager.service'
import { AppService } from 'src/app.service'
import { PrismaService } from 'src/prisma.service'
import { EmailService } from 'src/email.service'
import { FrontService } from 'src/front/front.service'
import * as Handlebars from 'handlebars'

@Controller('pest-routes')
export class PestRoutesController {
  private readonly logger = new Logger(PestRoutesController.name)

  constructor(
    private configService: ConfigService,
    private bonjoroService: BonjoroService,
    private pestRoutesService: PestRoutesService,
    private greetManagerService: GreetManagerService,
    private appService: AppService,
    private prisma: PrismaService,
    private readonly emailService: EmailService,
    private frontService: FrontService,
  ) {}

  @Get('/appointments/:id/scheduled')
  async appointmentScheduled(@Param('id') id: number) {
    this.logger.log(`${this.appointmentScheduled.name} ${id}`)

    const dt = DateTime.now().setZone('America/Denver')
    const currentDate = dt.toFormat('yyyy-MM-dd')
    const { appointment } = await this.pestRoutesService.getAppointmentById(id)
    const { date } = appointment

    // For testing
    // if (currentDate == date) {
    if (currentDate == date && dt.hour >= 2 && dt.minute > 0) {
      this.logger.log(`Creating new greet for appointment ${id}`)
      const { customer } = await this.pestRoutesService.getCustomerById(
        appointment.customerID,
      )
      const { route } = await this.pestRoutesService.getRouteById(
        appointment.routeID,
      )
      const { employee } = await this.pestRoutesService.getEmployeeById(
        route.assignedTech,
      )
      const bonjoroUsers = await this.bonjoroService.getAllUsers()
      const bonjoroUserId = await this.bonjoroService.findUserByEmail(
        employee.email,
        bonjoroUsers,
      )

      await this.bonjoroService.createBulkGreets({
        assignee_id: bonjoroUserId,
        campaign_id: this.configService.get<string>('BONJORO_CAMPAIGN_ID'),
        sync: 0,
        lines: [
          {
            email: this.bonjoroService.getAutomationEmail(
              appointment.customerID,
            ),
            first_name: customer.fname,
            last_name: customer.lname,
            reason: `Service at ${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
          },
        ],
      })
    }
  }

  @Get('/appointments/:id/rescheduled')
  async appointmentRescheduled(@Param('id') id: number) {
    await this.greetManagerService.appointmentRescheduled(id)
  }

  @Get('/appointments/:id/cancelled')
  async appointmentCancelled(@Param('id') id: number) {
    this.logger.log(`${this.appointmentCancelled.name} ${id}`)
    await this.bonjoroService.cancelAppointment(id)
  }

  @Get('/appointments/:id/completed')
  async appointmentCompleted(@Param('id') id: number) {
    const { appointment } = await this.pestRoutesService.getAppointmentById(id)
    const commercialSales = await this.prisma.commercialSales.findMany({
      where: {
        pestRoutesCustomerId: Number(appointment.customerID),
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!commercialSales.length) {
      // Do nothing, because we only care about items that went through the Zoho flow
    } else {
      let countSold = 0
      for (const commercialSale of commercialSales) {
        const zohoDeal = await this.appService.getZohoDeal(
          commercialSale.zohoDealId,
        )

        if (zohoDeal.Stage === 'Sold') {
          countSold++
        }
      }

      if (countSold > 1) {
        await this.emailService.send({
          subject: `More than 1 deal in Sold Stage for PR Customer: ${
            appointment.customerID
          } @ ${new Date().toISOString()}`,
          text:
            'Could not change the stage to Sold-Serviced ' +
            `because multiple deals found for PR Customer: ${appointment.customerID}.\n` +
            `Error ecountered during incoming webhook for PR appointment complete: ${id}`,
        })
        return
      }

      for (const commercialSale of commercialSales) {
        const zohoDeal = await this.appService.getZohoDeal(
          commercialSale.zohoDealId,
        )

        if (zohoDeal.Stage === 'Sold') {
          await this.appService.updateZohoDeal(zohoDeal.id, {
            Stage: 'Sold-Serviced',
          })
          break
        }
      }
    }
  }

  @Get('reminders/:id/appointments')
  async appointmentReminder(
    @Param('id') id: number,
    @Query('method') method: 'email' | 'sms',
  ) {
    const { appointment } = await this.pestRoutesService.getAppointmentById(
      18136,
    )
    const { customer } = await this.pestRoutesService.getCustomerById(
      appointment.customerID,
    )
    const { subscription } = await this.pestRoutesService.getSubscriptionById(
      appointment.subscriptionID,
    )
    const serviceType = subscription.serviceType
    const serviceAddress = `${customer.address} ${customer.city}, ${customer.state} ${customer.zip}`
    const serviceDate = DateTime.fromISO(appointment.date).toFormat('MMMM d')

    if (method === 'email') {
      const templateStr = await this.frontService.getTemplate('rsp_mwfyq')
      const template = Handlebars.compile(templateStr)

      await this.frontService.sendEmail({
        to: customer.email,
        subject: `Appointment Reminder: ${serviceDate}`,
        body: template({
          accountNumber: appointment.customerID,
          serviceDate,
          ServiceType: serviceType,
          serviceAddress,
        }),
        channelId: 'cha_9rc0i',
      })
    } else if (method === 'sms') {
      const templateStr = await this.frontService.getTemplate('rsp_ot0k2')
      const template = Handlebars.compile(templateStr)

      await this.frontService.sendSMS({
        to: customer.phone1,
        body: template({
          firstName: customer.fname,
          serviceDate,
          ServiceType: serviceType,
          serviceAddress,
        }),
        channelId: 'cha_ap76a',
      })
    } else {
      this.logger.error(`Method '${method}' not recognized.`)
    }
  }
}
