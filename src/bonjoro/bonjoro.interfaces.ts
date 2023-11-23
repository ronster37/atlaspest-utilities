interface BonjoroGetResponse<T> {
  data: T[]
  current_page: number
  next_page_url: string | null
}

interface BonjoroGreet {
  id: string
  campaign: {
    uuid: string
  }
}

interface BonjoroUser {
  id: string
  email: string
  is_email_verified: boolean
  name: string
  first_name: string
  last_name: string
}

interface BonjoroBulkCreateGreetRequest {
  assignee_id: string
  campaign_id: string
  sync: 0
  lines: [
    {
      email: string
      first_name: string
      last_name: string
      reason: string
    },
  ]
}

interface BonjoroCompletedGreetPayload {
  object: {
    data: {
      profile: {
        email: string
      }
      url: string
    }
  }
}
