import { Module } from '@nestjs/common'
import { PipedriveService } from './pipedrive.service'
import { PipedriveController } from './pipedrive.controller'
import { EmailService } from 'src/email.service'
import { AppService } from 'src/app.service'
import { PrismaService } from 'src/prisma.service'
import { ConfigService } from '@nestjs/config'
import { PestRoutesService } from 'src/pestRoutes.service'

@Module({
  providers: [
    PipedriveService,
    AppService,
    EmailService,
    PrismaService,
    ConfigService,
    PestRoutesService,
  ],
  controllers: [PipedriveController],
})
export class PipedriveModule {}
