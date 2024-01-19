interface GetFrontTemplateResponse {
  subject: string
  body: string
  attachments: { url: string }[]
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
  attachmentUrl?: string
  attachmentName?: string
}
