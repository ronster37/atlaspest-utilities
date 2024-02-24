import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as pipedrive from 'pipedrive'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  PipedrivePerson,
  PipedriveDeal,
  PipedriveDealUpdate,
} from './interfaces'
import axios from 'axios'

@Injectable()
export class PipedriveService {
  private readonly logger = new Logger(PipedriveService.name)
  private personsApi: any
  private dealsApi: any
  private usersApi: any
  stagesApi: any
  private filesApi: any

  constructor(private configService: ConfigService) {
    const pd = new pipedrive.ApiClient()
    pd.authentications.api_key.apiKey = configService.get<string>(
      'PIPEDRIVE_API_TOKEN',
    )

    this.personsApi = new pipedrive.PersonsApi(pd)
    this.dealsApi = new pipedrive.DealsApi(pd)
    this.usersApi = new pipedrive.UsersApi(pd)
    this.stagesApi = new pipedrive.StagesApi(pd)
    this.filesApi = new pipedrive.FilesApi(pd)
  }

  /**
   * Person API
   */
  async getPerson(id: number | string): Promise<PipedrivePerson> {
    const { data } = await this.personsApi.getPerson(id)
    return data
  }

  /**
   * Deal API
   */
  async getDeal(id: number | string): Promise<PipedriveDeal> {
    const { data } = await this.dealsApi.getDeal(id)
    return data
  }

  updateDeal(id: number | string, data: PipedriveDealUpdate) {
    const opts = pipedrive.UpdateDealRequest.constructFromObject(data)
    return this.dealsApi.updateDeal(id, opts)
  }

  /**
   * Files API
   */
  async uploadFileToDealWithURL(
    dealId: number | string,
    url: string,
    name: string,
  ) {
    const { data: arrayBuffer } = await axios.get(url, {
      responseType: 'arraybuffer',
    })

    await this.uploadFileToDealWithArrayBuffer(dealId, arrayBuffer, name)
  }

  async uploadFileToDealWithArrayBuffer(
    dealId: number | string,
    arrayBuffer: any,
    name: string,
  ) {
    try {
      const tempDir = await fs.promises.realpath(os.tmpdir()) // Get the real path of the temp directory
      const filePath = path.join(tempDir, `${name}.pdf`)

      await fs.promises.writeFile(filePath, arrayBuffer)

      await this.filesApi.addFile(filePath, {
        dealId,
      })

      await fs.promises.unlink(filePath)
    } catch (e) {
      this.logger.error(e)
    }
  }
}
