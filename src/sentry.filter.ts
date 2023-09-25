import { Catch, ArgumentsHost, HttpServer, Logger } from '@nestjs/common'
import { AbstractHttpAdapter, BaseExceptionFilter } from '@nestjs/core'
import * as Sentry from '@sentry/node'

@Catch()
export class SentryFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(SentryFilter.name)

  handleUnknownError(
    exception: any,
    host: ArgumentsHost,
    applicationRef: HttpServer<any, any> | AbstractHttpAdapter<any, any, any>,
  ) {
    if (exception && exception.isAxiosError) {
      if (exception.response && exception.response.data) {
        try {
          this.logger.error(exception.config.url)
          this.logger.error(exception.response.data)
        } catch (e) {}
      }
    }

    Sentry.captureException(exception)
    super.handleUnknownError(exception, host, applicationRef)
  }
}
