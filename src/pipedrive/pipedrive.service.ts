import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as pipedrive from 'pipedrive'
import {
  PipedrivePerson,
  PipedriveDeal,
  PipedriveDealUpdate,
} from './interfaces'

@Injectable()
export class PipedriveService {
  private personsApi: any
  private dealsApi: any
  private usersApi: any
  stagesApi: any

  constructor(private configService: ConfigService) {
    const pd = new pipedrive.ApiClient()
    pd.authentications.api_key.apiKey = configService.get<string>(
      'PIPEDRIVE_API_TOKEN',
    )

    this.personsApi = new pipedrive.PersonsApi(pd)
    this.dealsApi = new pipedrive.DealsApi(pd)
    this.usersApi = new pipedrive.UsersApi(pd)
    this.stagesApi = new pipedrive.StagesApi(pd)
  }

  /**
   * Person API
   */
  async getPerson(id: number | string): Promise<PipedrivePerson> {
    const { data } = await this.personsApi.getPerson(id)
    return data
  }

  /**
   *  Deal API
   */
  async getDeal(id: number | string): Promise<PipedriveDeal> {
    const { data } = await this.dealsApi.getDeal(id)
    return data
  }

  updateDeal(id: number | string, data: PipedriveDealUpdate) {
    const opts = pipedrive.UpdateDealRequest.constructFromObject(data)
    return this.dealsApi.updateDeal(id, opts)
  }
}
