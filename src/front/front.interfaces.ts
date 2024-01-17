interface GetFrontTemplateResponse {
  body: string
}

interface FrontSendSMS {
  to: string
  body: string
  channelId: string
}

interface FrontSendEmail {
  to: string
  subject: string
  body: string
  channelId: string
}
