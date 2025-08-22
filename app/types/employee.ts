// types/employee.ts
export interface Employee {
    id: string
    employee_code: string
    full_name: string
    position: string | null
    department: string | null
    employment_status: "Regular" | "Probationary" | "Project-based" | "Contractual"
    tin: string | null
    sss: string | null
    philhealth: string | null
    pagibig: string | null
    base_salary: number
    pay_type: "monthly" | "daily" | "hourly"
    shift: string | null
    hours_per_week: number | null
    leave_credits: number
    created_at: string
  }
  