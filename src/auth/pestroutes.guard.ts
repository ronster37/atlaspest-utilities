import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Request } from 'express'

@Injectable()
export class PestRoutesGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest()
    const authHeader = request.query['x-atlaspest-auth']

    if (
      !authHeader ||
      authHeader !== this.configService.get('PESTROUTES_ATLASPEST_AUTH')
    ) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    return true
  }
}
