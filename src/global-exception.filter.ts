import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Response } from 'express'
import { AxiosError } from 'axios'
import { EmailService } from './email.service'

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly emailService: EmailService) {}

  async catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest()

    if (exception instanceof HttpException) {
      // Handle other HttpExceptions
      response.status(exception.getStatus()).json({
        statusCode: exception.getStatus(),
        message: exception.message,
      })
    } else {
      if (exception instanceof AxiosError) {
        await this.emailService.send({
          subject: 'API Error',
          text: `URL: ${exception.config.url}\n\n${JSON.stringify(
            exception.response.data,
            null,
            2,
          )}`,
        })
      } else {
        const errorMessage = `Error occurred: ${exception.message}`
        const stackTrace = exception.stack // Get the stack trace
        const emailContent = `${errorMessage}\n\nStack Trace:\n${stackTrace}`
        await this.emailService.send({
          subject: 'Error Stack Trace',
          text: emailContent,
        })
      }

      // Handle other uncaught exceptions
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred',
      })
    }
  }
}
