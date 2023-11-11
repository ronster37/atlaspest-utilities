import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { PestRoutesService } from './pestRoutes.service'
import { PrismaService } from './prisma.service'
import { ZohoService } from './zoho.service'
import { EmailService } from './email.service'
import { APP_FILTER } from '@nestjs/core'
import { SentryFilter } from './sentry.filter'
import { BonjoroService } from './bonjoro/bonjoro.service'
import { ScheduleModule } from '@nestjs/schedule'

@Module({
  imports: [ConfigModule.forRoot(), AuthModule, ScheduleModule.forRoot()],
  controllers: [AppController],
  providers: [
    AppService,
    PestRoutesService,
    PrismaService,
    ZohoService,
    EmailService,
    {
      provide: APP_FILTER,
      useClass: SentryFilter,
    },
    BonjoroService,
  ],
})
export class AppModule {}
