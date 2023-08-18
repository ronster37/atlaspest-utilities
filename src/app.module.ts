import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { PestRoutesService } from './pestRoute.service'
import { PrismaService } from './prisma.service'
import { ZohoService } from './zoho.service'

@Module({
  imports: [ConfigModule.forRoot(), AuthModule],
  controllers: [AppController],
  providers: [AppService, PestRoutesService, PrismaService, ZohoService],
})
export class AppModule {}
