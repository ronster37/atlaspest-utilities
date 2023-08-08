import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class ZohoGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const authToken = request.headers['x-atlaspest-auth']

    if (authToken !== this.configService.get<string>('ZOHO_WEBHOOK_AUTH_KEY')) {
      throw new UnauthorizedException('Custom Zoho authentication failed.')
    }

    return true
  }
}
