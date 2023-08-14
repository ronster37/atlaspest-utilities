interface ArcSiteProposalSignedPayload {
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

interface SaleRep {
  name: string
  email: string
  phone: string
}

interface ArcSiteProject {
  id: number
  name: string
  created_at: string
  updated_at: string
  job_number: string
  customer: Customer
  work_site_address: CustomerAddress
  sale_rep: SaleRep
}
