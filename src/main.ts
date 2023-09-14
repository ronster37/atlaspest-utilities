import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import * as Sentry from '@sentry/node'
import { SentryFilter } from './sentry.filter'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const configService = app.get(ConfigService)

  Sentry.init({
    dsn: configService.get('SENTRY_DSN'),
    environment: configService.get('NODE_ENV'),
  })

  // Import the filter globally, capturing all exceptions on all routes
  const { httpAdapter } = app.get(HttpAdapterHost)
  app.useGlobalFilters(new SentryFilter(httpAdapter))

  await app.listen(process.env.PORT || 3000)
}

bootstrap()
