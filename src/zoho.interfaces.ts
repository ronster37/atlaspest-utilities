/* eslint-disable @typescript-eslint/no-unused-vars */
interface ZohoRefreshAccessTokenResponse {
  access_token: string
  expires_in: number
}

interface ZohoDealCustomer {
  firstName: string
  lastName: string
  phone: string
  secondPhone: string | null
  email: string
  secondEmail: string | null
}

interface WorkSite {
  street: string
  city: string
  state: string
  zip: string
}

interface SalesRep {
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface ZohoDealPayload {
  dealId: string
  contactId: string
  company: string
  customer: ZohoDealCustomer
  workSite: WorkSite
  salesRep: SalesRep
}

interface ZohoCreateDocumentResponse {
  code: 0
  requests: ZohoRequest
  message: string
  status: string
}

// There are a LOT more fields, but these are the only ones
// we need for the moment
interface ZohoRequest {
  document_fields: ZohoDocumentFields[]
  request_id: string
}

interface ZohoDocumentFields {
  document_id: string
}

interface ZohoSignWebhookPayload {
  requests: ZohoSignRequest
  notifications: ZohoSignNotification
}

interface ZohoSignRequest {
  request_status: string
  document_ids: ZohoSignDocumentId[]
  request_id: number
  actions: ZohoSignAction[]
}

interface ZohoSignDocumentId {
  document_id: string
}

interface ZohoSignAction {
  recipient_email: string
  recipient_name: string
}

interface ZohoSignNotification {
  performed_by_email: string
  reason: string
  activity: string
  operation_type: string
  action_id: number
  performed_by_name: string
}

interface ZohoDealResponse {
  data: ZohoDeal[]
}

interface ZohoDeal {
  id: string
  Owner: Owner
  Email: string
  Currency: string
  Deal_Name: string
  Stage: string
  Contact_Name: Contact
}

interface Owner {
  id: string
  name: string
  email: string
}

interface Contact {
  id: string
  name: string
}

interface ZohoContactResponse {
  data: ZohoContact[]
}

interface ZohoContact {
  id: string
  Owner: Owner
  Full_Name: string
  First_Name: string
  Last_Name: string
  Email: string
  Secondary_Email: string
  Phone: string
  Other_Phone: string
  Mailing_Street: string
  Mailng_City: string
  Mailing_State: string
  Mailing_Zip: string
}
