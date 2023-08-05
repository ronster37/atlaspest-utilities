import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  doSomethingWithZohoWebhookData(): string {
    return 'Hello World!'
  }
}
