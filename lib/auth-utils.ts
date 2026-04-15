/**
 * Priority order for administrative pages
 */
export const ADMIN_ROUTE_PRIORITY = [
  { key: "dashboard", url: "/dashboard" },
  { key: "reports", url: "/reports" },
  { key: "employees", url: "/employees" },
  { key: "timekeeping", url: "/timekeeping" },
  { key: "admin-requests", url: "/admin-requests" },
  { key: "payroll", url: "/payroll" },
  { key: "deductions", url: "/deductions" },
  { key: "user-manager", url: "/user-manager" },
]

/**
 * Determines the best landing page for a user based on their role and granular permissions.
 */
export function getLandingPage(role: string | null, permissions: Record<string, boolean> = {}): string {
  // Employees always go to their personal view
  if (role === "employee") {
    return "/my-payroll"
  }

  // Admins always have full access, so they go to the first priority route (Dashboard)
  if (role === "admin") {
    return "/dashboard"
  }

  // HR users are filtered based on their permissions
  if (role === "hr") {
    const firstAccessible = ADMIN_ROUTE_PRIORITY.find(route => permissions[route.key] === true)
    
    if (firstAccessible) {
      return firstAccessible.url
    }
  }

  // Fallback if no specific admin permissions are found
  return "/my-payroll"
}
