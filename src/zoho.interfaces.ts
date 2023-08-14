/* eslint-disable @typescript-eslint/no-unused-vars */
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
  Email: string
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
