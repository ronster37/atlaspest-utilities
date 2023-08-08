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
  customer: Customer
  workSite: WorkSite
  salesRep: SalesRep
}
