import axios, { AxiosInstance } from 'axios'
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { DateTime } from 'luxon'
import { ConfigService } from '@nestjs/config'
import { PestRoutesService } from 'src/pestRoutes.service'
import { EmailService } from 'src/email.service'

interface GetGreetsParams {
  status?: 'open'
  search?: string
}

interface PutGreetRequest {
  assignee_id: string
}

@Injectable()
export class BonjoroService {
  private readonly logger = new Logger(BonjoroService.name)
  private bonjoroAxiosInstance: AxiosInstance

  constructor(
    private configService: ConfigService,
    private pestRoutesService: PestRoutesService,
    private readonly emailService: EmailService,
  ) {
    this.bonjoroAxiosInstance = axios.create({
      baseURL: configService.get<string>('BONJORO_API_URL'),
      headers: {
        common: {
          Authorization: `Bearer ${configService.get<string>(
            'BONJORO_AUTH_TOKEN',
          )}`,
        },
      },
    })
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    timeZone: 'America/Denver',
  })
  async nightlyJob() {
    await this.deleteOpenGreets()
    await this.createGreets()
  }

  async deleteOpenGreets() {
    const greets: BonjoroGreet[] = await this.getAll(async (url?: string) =>
      this.getGreets(url),
    )

    const greetIds = greets
      .filter(
        (greet) =>
          greet.campaign.uuid ===
          this.configService.get<string>('BONJORO_CAMPAIGN_ID'),
      )
      .map((greet) => greet.id)

    // Delete Open Greets
    await this.deleteGreets(greetIds)
  }

  async getAll<T>(fn: (url?: string) => Promise<BonjoroGetResponse<T>>) {
    let response = await fn()
    let items = response.data

    while (items.length) {
      if (response.next_page_url) {
        response = await fn(response.next_page_url)
        items = items.concat(response.data)
      } else {
        break
      }
    }

    return items
  }

  async getGreets(nextPageUrl?: string) {
    const path = nextPageUrl
      ? nextPageUrl.replace(
          this.configService.get<string>('BONJORO_API_URL'),
          '',
        )
      : '/greets?status=open'
    const result = await this.bonjoroAxiosInstance.get<
      BonjoroGetResponse<BonjoroGreet>
    >(path)

    return result.data
  }

  async getGreetsWithFilter(params: GetGreetsParams = {}) {
    const path = '/greets?status=open'
    const result = await this.bonjoroAxiosInstance.get<
      BonjoroGetResponse<BonjoroGreet>
    >(path, {
      params,
    })

    return result.data
  }

  async getAllGreets() {
    const greets = await this.getAll(async (url?: string) =>
      this.getGreets(url),
    )

    return greets.filter(
      (greet) =>
        greet.campaign.uuid ===
        this.configService.get<string>('BONJORO_CAMPAIGN_ID'),
    )
  }

  async createGreets() {
    const currentDate = DateTime.now()
      .setZone('America/Denver')
      .toFormat('yyyy-MM-dd')

    const { appointmentIDs } =
      await this.pestRoutesService.getAppointmentsByDate(currentDate)
    // const appointmentIDs = [17041]
    const bonjoroUsers: BonjoroUser[] = await this.getAll(
      async (url?: string) => this.getUsers(url),
    )
    const greets: Record<string, BonjoroBulkCreateGreetRequest> = {}
    const bonjorUserIdCache: Record<string, string> = {}

    for (const appointmentId of appointmentIDs) {
      const { appointment } = await this.pestRoutesService.getAppointmentById(
        appointmentId,
      )
      const { route } = await this.pestRoutesService.getRouteById(
        appointment.routeID,
      )
      const { employee } = await this.pestRoutesService.getEmployeeById(
        route.assignedTech,
      )
      const { customer } = await this.pestRoutesService.getCustomerById(
        appointment.customerID,
      )

      let bonjoroUserId = bonjorUserIdCache[employee.email]
      if (!bonjoroUserId) {
        bonjoroUserId = await this.findUserByEmail(employee.email, bonjoroUsers)
        bonjorUserIdCache[employee.email] = bonjoroUserId
      }

      if (!greets[bonjoroUserId]) {
        greets[bonjoroUserId] = {
          assignee_id: bonjoroUserId,
          campaign_id: this.configService.get<string>('BONJORO_CAMPAIGN_ID'),
          sync: 0,
          lines: [
            {
              email: this.getAutomationEmail(appointment.customerID),
              first_name: customer.fname,
              last_name: customer.lname,
              reason: `Service at ${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
            },
          ],
        }
      } else {
        greets[bonjoroUserId].lines.push({
          email: this.getAutomationEmail(appointment.customerID),
          first_name: customer.fname,
          last_name: customer.lname,
          reason: `Service at ${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
        })
      }
    }

    // Create greets
    const userIds = Object.keys(greets)
    for (const userId of userIds) {
      await this.createBulkGreets(greets[userId])
    }
  }

  async findUserByEmail(email: string, users: BonjoroUser[]) {
    const user = users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    )

    if (!user) {
      const warningMessage = 'No Bonjoro user found for email: ' + email
      this.logger.warn(warningMessage)
      await this.emailService.send({
        subject: warningMessage,
        text: 'No match found. Assigning to David.',
      })
      return this.configService.get<string>('BONJORO_FALLBACK_GREET_USER_ID')
    }

    return user.id
  }

  async getUsers(nextPageUrl?: string) {
    const path = nextPageUrl
      ? nextPageUrl.replace(
          this.configService.get<string>('BONJORO_API_URL'),
          '',
        )
      : '/users'
    const result = await this.bonjoroAxiosInstance.get<
      BonjoroGetResponse<BonjoroUser>
    >(path)

    return result.data
  }

  async getAllUsers() {
    return await this.getAll(async (url?: string) => this.getUsers(url))
  }

  async createBulkGreets(greets: BonjoroBulkCreateGreetRequest) {
    await this.bonjoroAxiosInstance.post('/greets/create', greets)
  }

  deleteGreets(greetIds: string[]) {
    return this.bonjoroAxiosInstance.delete('/greets', {
      data: {
        greets: greetIds,
      },
    })
  }

  putGreet(greetId: string, data: PutGreetRequest) {
    return this.bonjoroAxiosInstance.put(`/greets/${greetId}`, data)
  }

  // Find the Greet associated with the cancelled PestRoutes appointment and delete it
  async cancelAppointment(appointmentId: number) {
    const { appointment } = await this.pestRoutesService.getAppointmentById(
      appointmentId,
    )

    const { data: greets } = await this.getGreetsWithFilter({
      status: 'open',
      search: this.getAutomationEmail(appointment.customerID),
    })

    if (greets.length > 1) {
      this.logger.error(
        `Found more than 1 greet for appointment ${appointmentId} and ${this.getAutomationEmail(
          appointment.customerID,
        )}`,
      )
    } else if (greets.length == 0) {
      this.logger.error(
        `Found 0 greets for appointment ${appointmentId} and ${this.getAutomationEmail(
          appointment.customerID,
        )}`,
      )
    } else {
      await this.deleteGreets(greets.map((greet) => greet.id))
    }
  }

  getAutomationEmail(id: string) {
    return `automation+${id}@atlaspest.com`
  }
}
