interface PestRoutesPostCustomerResponse {
  success: boolean
  result: string
}

interface PestRoutesGetAppointmentsResponse {
  appointmentIDs: number[]
  count: number
}

interface PestRoutesGetAppointmentResponse {
  appointment: {
    customerID: string
    date: string
    employeeID: string
    routeID: string
  }
}

interface PestRoutesGetRouteResponse {
  route: {
    assignedTech: string
  }
}

interface PestRoutesGetEmployeeResponse {
  employee: {
    email: string
  }
}

interface PestRoutesGetCustomerResponse {
  customer: {
    email: string
    phone1: string
    phone2: string | null
    fname: string
    lname: string
    companyName: string
    address: string
    city: string
    state: string
    zip: string
  }
}
