import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

@Injectable()
export class TasksService {
  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    timeZone: 'America/Denver',
  })
  pushToBonjoro() {
    // The function to run at 3 AM in the specified time zone
    console.log('Cron job ran at 3 AM in Mountain Time Zone (MT)')
    // Add your specific logic here
  }
}
