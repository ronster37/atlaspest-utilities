import {
  ADDRESS_KEY,
  CITY_KEY,
  CONTRACT_LENGTH_KEY,
  CONTRACT_VALUE_KEY,
  FREQUENCY_KEY,
  INITIAL_PRICE_KEY,
  MULTI_UNIT_PROPERTY_KEY,
  PROPOSAL_DATE_KEY,
  RECURRING_PRICE_KEY,
  SERVICE_INFORMATION_KEY,
  SERVICE_TYPE_KEY,
  STATE_KEY,
  UNIT_QUOTA_KEY,
  ZIP_KEY,
} from './constants'

export interface PipedriveWebhookDealAddedBody {
  v: number
  current: {
    id: number
    person_id: number
    creator_user_id: number
    owner_name: string
    stage_id: number
    person_name: string
    user_id: number
    title: string
    pipeline_id: number
    org_name: string | null
    org_id: number
  }
  previous: null
  event: string
  retry: number
}

export interface PipedrivePerson {
  id: number
  name: string
  first_name: string
  last_name: string
  primary_email: string
  email: {
    value: string
    primary: boolean
  }[]
  phone: {
    value: string
    primary: boolean
  }[]
}

export interface PipedriveDeal {
  id: number
  stage_id: number
  title: string
  person_name: string
  org_name: string
  owner_name: string
  [ADDRESS_KEY]: string
  [CITY_KEY]: string
  [STATE_KEY]: string
  [ZIP_KEY]: string
  user_id: {
    id: number
    name: string
    email: string
  }
  person_id: {
    name: string
    email: [
      {
        value: string
        primary: boolean
      },
    ]
    phone: [
      {
        value: string
        primary: boolean
      },
    ]
    value: number
  }
  org_id: {
    name: string
    value: number
  }
}

export interface PipedriveDealUpdate {
  stage_id?: number
  [SERVICE_TYPE_KEY]?: string
  [INITIAL_PRICE_KEY]?: string
  [CONTRACT_LENGTH_KEY]?: string
  [SERVICE_INFORMATION_KEY]?: string
  [CONTRACT_VALUE_KEY]?: string
  [RECURRING_PRICE_KEY]?: string
  [FREQUENCY_KEY]?: string
  [MULTI_UNIT_PROPERTY_KEY]?: 'Yes' | 'No'
  [UNIT_QUOTA_KEY]?: string
  [PROPOSAL_DATE_KEY]?: string
}
