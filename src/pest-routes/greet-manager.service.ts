import { Injectable, Logger } from '@nestjs/common'
import { DateTime } from 'luxon'
import { BonjoroService } from 'src/bonjoro/bonjoro.service'
import { PestRoutesService } from 'src/pestRoutes.service'

@Injectable()
export class GreetManagerService {
  private readonly logger = new Logger(GreetManagerService.name)

  constructor(
    private bonjoroService: BonjoroService,
    private pestRoutesService: PestRoutesService,
  ) {}

  async appointmentRescheduled(id: number) {
    const dt = DateTime.now().setZone('America/Denver')
    const currentDate = dt.toFormat('yyyy-MM-dd')
    const { appointment } = await this.pestRoutesService.getAppointmentById(id)
    const { date } = appointment

    if (currentDate != date) {
      // Find and Delete Greet
      await this.bonjoroService.cancelAppointment(id)
    } else if (currentDate == date && dt.hour >= 2 && dt.minute > 0) {
      // } else if (currentDate) {
      const { data: greets } = await this.bonjoroService.getGreetsWithFilter({
        status: 'open',
        search: this.bonjoroService
          .getAutomationEmail(appointment.customerID)
          .replace('automation+', ''),
      })

      if (greets.length > 1) {
        // Throw an error
        this.logger.error(
          `Found more than 1 greets for appointment '${id}' and email ${this.bonjoroService.getAutomationEmail(
            appointment.customerID,
          )}`,
        )
        return
      } else if (greets.length == 0) {
        // Throw an error?
        this.logger.error(
          `Found 0 greets for appointment '${id}' and email ${this.bonjoroService.getAutomationEmail(
            appointment.customerID,
          )}`,
        )
        return
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
}
