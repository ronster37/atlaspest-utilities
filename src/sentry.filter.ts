import { Catch, ArgumentsHost, HttpServer, Logger } from '@nestjs/common'
import { AbstractHttpAdapter, BaseExceptionFilter } from '@nestjs/core'
import { Request } from 'express'
import * as Sentry from '@sentry/node'
import { EmailService } from './email.service'

@Catch()
export class SentryFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(SentryFilter.name)

  constructor(private readonly emailService: EmailService) {
    super()
  }

  async handleUnknownError(
    exception: any,
    host: ArgumentsHost,
    applicationRef: HttpServer<any, any> | AbstractHttpAdapter<any, any, any>,
  ) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()

    const url = request.url
    const body = JSON.stringify(request.body, null, 2)
    let text = `Body:\n${body}`

    if (exception && exception.isAxiosError) {
      if (exception.response && exception.response.data) {
        try {
          this.logger.error(exception.config.url)
          this.logger.error(exception.response.data)

          text += `\n\nExtra Info:\n${exception.config.url}\n${JSON.stringify(
            JSON.parse(exception.response.data.toString()),
            null,
            2,
          )}`
        } catch (e) {}
      }
    }

    await this.emailService.send({
      subject: `Error on webhook ${url} @ ${new Date().toISOString()}`,
      text: text,
    })

    Sentry.captureException(exception)
    super.handleUnknownError(exception, host, applicationRef)
  }
}
