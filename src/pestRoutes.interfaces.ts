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
    subscriptionID: string
  }
}

interface PestRoutesGetRouteResponse {
  route: {
    assignedTech: string
  }
}

interface PestRoutesGetSubscriptionResponse {
  subscription: {
    serviceType: string
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
    billingFName: string
  }
}

interface PestRoutesGetChangelogResponse {
  changelogIDs: number[]
}

interface PestRoutesGetSingleChangelogResponse {
  changelog: {
    changeID: string
    classID: string
    class: string
    dateChanged: string // Format: "2023-12-06 01:49:20"
    employeeID: string
    notes: string // JSON format
    referenceID: string // appointment id
  }
}

interface PestRoutesRemindersBody {
  type: 'bed_bug' | 'billing' | 'appointment'
  method: 'sms' | 'email'
}

interface PestRoutesRemindersAppointmentBody extends PestRoutesRemindersBody {
  customerId: string
  customerNumber: string
  loginLink: string
  serviceDate: string
  serviceDescription: string
}

interface PestRoutesRemindersBillingBody extends PestRoutesRemindersBody {
  customerId: string
  responsibleBalance: number
  daysPastDue: number
  loginLink: string
}

interface PestRoutesRemindersBedBugBody extends PestRoutesRemindersBody {
  customerId: string
}
