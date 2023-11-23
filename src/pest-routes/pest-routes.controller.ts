import { Controller, Get, Logger, Param } from '@nestjs/common'
import { BonjoroService } from '../bonjoro/bonjoro.service'
import { ConfigService } from '@nestjs/config'
import { PestRoutesService } from 'src/pestRoutes.service'
import { DateTime } from 'luxon'

@Controller('pest-routes')
export class PestRoutesController {
  private readonly logger = new Logger(PestRoutesController.name)

  constructor(
    private configService: ConfigService,
    private bonjoroService: BonjoroService,
    private pestRoutesService: PestRoutesService,
  ) {}

  @Get('/appointments/:id/scheduled')
  async appointmentScheduled(@Param('id') id: number) {
    this.logger.log(`${this.appointmentScheduled.name} ${id}`)

    const dt = DateTime.now().setZone('America/Denver')
    const currentDate = dt.toFormat('yyyy-MM-dd')
    const { appointment } = await this.pestRoutesService.getAppointmentById(id)
    const { date } = appointment

    if (currentDate == date && dt.hour >= 2 && dt.minute > 0) {
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
            email: customer.email,
            first_name: customer.fname,
            last_name: customer.lname,
            reason: `Service at ${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
          },
        ],
      })
    }

    return date
  }

  @Get('/appointments/:id/rescheduled')
  async appointmentRescheduled(@Param('id') id: number) {
    this.logger.log(`${this.appointmentRescheduled.name} ${id}`)

    const dt = DateTime.now().setZone('America/Denver')
    const currentDate = dt.toFormat('yyyy-MM-dd')
    const { appointment } = await this.pestRoutesService.getAppointmentById(id)
    const { date } = appointment

    if (currentDate != date) {
      // Find and Delete Greet
      await this.bonjoroService.cancelAppointment(id)
    } else if (currentDate == date && dt.hour >= 2 && dt.minute > 0) {
      const { customer } = await this.pestRoutesService.getCustomerById(
        appointment.customerID,
      )
      const { data: greets } = await this.bonjoroService.getGreetsWithFilter({
        status: 'open',
        search: customer.email,
      })

      if (greets.length > 1) {
        // Throw an error
      } else if (greets.length == 0) {
        // Throw an error?
      }

      const greet = greets[0]
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
      await this.bonjoroService.putGreet(greet.id, {
        assignee_id: bonjoroUserId,
      })
    }
  }

  @Get('/appointments/:id/cancelled')
  async appointmentCancelled(@Param('id') id: number) {
    this.logger.log(`${this.appointmentCancelled.name} ${id}`)
    await this.bonjoroService.cancelAppointment(id)
  }
}
