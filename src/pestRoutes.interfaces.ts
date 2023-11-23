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
    fname: string
    lname: string
    companyName: string
    address: string
    city: string
    state: string
    zip: string
  }
}
