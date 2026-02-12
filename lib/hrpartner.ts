const BASE_URL = (process.env.HRPARTNER_BASE_URL || 'https://api.hrpartner.io').replace(/\/$/, '');
const API_KEY = process.env.HRPARTNER_API_KEY;

async function fetchHRPartner(endpoint: string, options: RequestInit = {}) {
    if (!API_KEY) {
        throw new Error('HRPARTNER_API_KEY is not defined in environment variables');
    }

    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HRPartner API error: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`);
    }

    return response.json();
}

export const hrPartner = {
    /**
     * Fetches all employees.
     */
    async getEmployees() {
        return fetchHRPartner('/employees');
    },

    /**
     * Fetches leave balances.
     */
    async getLeaveBalances() {
        return fetchHRPartner('/leave_balances');
    },

    /**
     * Fetches timesheets.
     */
    async getTimesheets() {
        return fetchHRPartner('/timesheets');
    },

    /**
     * Fetches a specific employee by code.
     */
    async getEmployeeByCode(employeeCode: string) {
        return fetchHRPartner(`/employee/${employeeCode}`);
    }
};
