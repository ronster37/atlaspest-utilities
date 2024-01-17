import { Body, Controller, Logger, Post } from '@nestjs/common'
import { FrontService } from 'src/front/front.service'
import { PestRoutesService } from 'src/pestRoutes.service'

@Controller('bonjoro')
export class BonjoroController {
  private readonly logger = new Logger(BonjoroController.name)

  constructor(
    private pestRoutesService: PestRoutesService,
    private frontService: FrontService,
  ) {}

  @Post('greet/completed')
  async greetCompleted(@Body() body: BonjoroCompletedGreetPayload) {
    const emailPattern = /^automation\+([^\s@]+)@atlaspest\.com$/
    const email = body.object.data.profile.email
    const videoUrl = body.object.data.url.replace(
      'https://www.bonjoro.com',
      'https://video.atlaspest.com',
    )
    const match = email.match(emailPattern)
    const pestRoutesCustomerId = match ? match[1] : null

    if (pestRoutesCustomerId) {
      const { customer } = await this.pestRoutesService.getCustomerById(
        pestRoutesCustomerId,
      )
      let textTemplate = await this.frontService.getTemplate('rsp_mtjrm')

      textTemplate = textTemplate
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, '\n\n')
        .replace('{{customer.first_name}}', `${customer.fname}`)
        .replace('{{link}}', videoUrl)

      await this.frontService.sendSMS({
        to: customer.phone1,
        body: textTemplate,
        channelId: 'cha_ap76a',
      })
    }
  }
}
