/* eslint-disable @typescript-eslint/no-unused-vars */
interface ZohoRefreshAccessTokenResponse {
  access_token: string
  expires_in: number
}

interface Customer {
  name: string
  phone: string
  email: string
}

interface WorkSite {
  street: string
  city: string
  zip: string
}

interface SalesRep {
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface ZohoLeadPayload {
  leadId: string
  customer: Customer
  workSite: WorkSite
  salesRep: SalesRep
}

interface ZohoLeadResponse {
  data: ZohoLead[]
}

interface ZohoLead {
  id: string
  Email: string
  Fist_Name: string
  Last_Name: string
  Full_Name: string
  Phone: string
  Street: string
  City: string
  State: string
  Zip_Code: string
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
