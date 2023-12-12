import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DateTime } from 'luxon'
import { PestRoutesService } from 'src/pestRoutes.service'
import { PrismaService } from 'src/prisma.service'
import * as Sentry from '@sentry/node'
import { GreetManagerService } from './greet-manager.service'

const PESTROUTES_LAST_CHANGELOG_ID_SEEN = 'PESTROUTES_LAST_CHANGELOG_ID_SEEN'
// 4 is the classId for Appointment models in PestRoutes
const CLASS_ID = 4

@Injectable()
export class ChangelogSearchService {
  private readonly logger = new Logger(ChangelogSearchService.name)

  constructor(
    private pestRoutesService: PestRoutesService,
    private readonly prisma: PrismaService,
    private greetManagerService: GreetManagerService,
  ) {}

  // Every 15 minutes between 2 AM and 5 PM, Monday through Friday
  @Cron('0 */15 2-17 * * 1-5', {
    timeZone: 'America/Denver',
  })
  async searchChangelog() {
    const now = DateTime.now().setZone('America/Denver')

    if (now.hour == 2 && now.minute < 15) {
      // Skip 2:00 AM because it will interfere with the initial bulk greeting creation
      return
    }

    const currentDate = this.getCurrentDate()

    const { changelogIDs: changelogIds } =
      await this.pestRoutesService.getChangelogIds(CLASS_ID, currentDate)
    const lastChangelogIdSeen = await this.getLastChangelogIdSeen()
    const filteredChangelogIds = changelogIds.filter(
      (changelogId) => changelogId > lastChangelogIdSeen,
    )

    if (filteredChangelogIds.length) {
      await this.findDraggedAppointmentsAndReschedule(filteredChangelogIds)
      const maxChangeLogId = String(Math.max(...filteredChangelogIds))

      await this.prisma.globalSettings.upsert({
        where: {
          key: PESTROUTES_LAST_CHANGELOG_ID_SEEN,
        },
        update: {
          value: maxChangeLogId,
        },
        create: {
          key: PESTROUTES_LAST_CHANGELOG_ID_SEEN,
          value: maxChangeLogId,
        },
      })
    }
  }

  getCurrentDate() {
    const dt = DateTime.now().setZone('America/Denver')
    const currentDate = dt.toFormat('yyyy-MM-dd')

    return currentDate
  }

  async getLastChangelogIdSeen() {
    const result = await this.prisma.globalSettings.findUnique({
      where: {
        key: PESTROUTES_LAST_CHANGELOG_ID_SEEN,
      },
    })

    return Number(result?.value || 0)
  }

  async findDraggedAppointmentsAndReschedule(changelogIds: number[]) {
    const currentDate = this.getCurrentDate()

    for (const changelogId of changelogIds) {
      try {
        const { changelog } = await this.pestRoutesService.getSingleChangelog(
          changelogId,
        )
        const appointmentId = changelog.referenceID
        const notes: any[] = JSON.parse(changelog.notes)
        const changelogDateTime = DateTime.fromFormat(
          changelog.dateChanged,
          'yyyy-MM-dd HH:mm:ss',
          {
            zone: 'America/Denver',
          },
        )

        // Changes should only trigger for dragged events between 2 and 5 pm
        if (changelogDateTime.hour < 2 || changelogDateTime.hour >= 17) {
          continue
        } else if (notes.some((note) => note.new === 'Dragged Appointment')) {
          const changedTo = notes.find((note) => note.key === 'Time').new
          const [date]: [string] = changedTo.split(' ')

          if (date === currentDate) {
            this.logger.log(`Found dragged appointment: ${appointmentId}`)
            // TODO: do we need to check the time?
            await this.greetManagerService.appointmentRescheduled(
              Number(appointmentId),
            )
          }
        }
      } catch (exception) {
        Sentry.captureException(exception)
      }
    }
  }
}
