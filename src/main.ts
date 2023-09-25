import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import * as Sentry from '@sentry/node'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const configService = app.get(ConfigService)

  Sentry.init({
    dsn: configService.get('SENTRY_DSN'),
    environment: configService.get('NODE_ENV'),
    // beforeSend(event, hint) {
    //   const originalException: any = hint?.originalException

    //   console.log('in beforeSend')

    //   if (hint && originalException && originalException.isAxiosError) {
    //     if (originalException.response && originalException.response.data) {
    //       const contexts = {
    //         ...event.contexts,
    //       }
    //       contexts.errorResponse = {
    //         data: JSON.parse(originalException.response.data.toString()),
    //       }
    //       event.contexts = contexts

    //       console.log(JSON.parse(originalException.response.data.toString()))
    //     }
    //   }

    //   return event
    // },
  })

  await app.listen(process.env.PORT || 3000)
}

bootstrap()
