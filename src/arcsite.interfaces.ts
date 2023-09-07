interface ArcSiteProposalSignedPayload {
  event: string
  data: ArcSiteProposalSignedData
}

interface ArcSiteProposalSignedData {
  project_id: string
  name: string
  url: string
}

interface CustomerAddress {
  street: string
  city: string
  county: string
  state: string
  zip_code: string
}

interface Customer {
  name: string
  phone: string
  second_phone: string
  email: string
  second_email: string
  address: CustomerAddress
}

interface SalesRep {
  name: string
  email: string
  phone: string
}

interface ArcSiteProject {
  id: string
  name: string
  created_at: string
  updated_at: string
  customer: Customer
  work_site_address: CustomerAddress
  sales_rep: SalesRep
}
