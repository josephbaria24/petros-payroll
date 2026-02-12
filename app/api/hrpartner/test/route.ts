import { NextResponse } from 'next/server';
import { hrPartner } from '@/lib/hrpartner';

export async function GET() {
    const results: any = {
        employees: { status: 'pending' },
        leaveBalances: { status: 'pending' },
        timesheets: { status: 'pending' }
    };

    try {
        console.log('Testing HRPartner Integration...');

        // 1. Fetch Employees
        try {
            const employees = await hrPartner.getEmployees();
            results.employees = {
                status: 'success',
                count: employees?.length || 0,
                sample: employees?.slice(0, 3).map((e: any) => ({
                    name: e.full_name,
                    code: e.code,
                    email: e.email,
                    department: e.department,
                    position: e.position,
                    sss: e.custom_data?.['sss-number'],
                    philhealth: e.custom_data?.['philhealth-number'],
                    pagibig: e.custom_data?.['pagibig-number']
                }))
            };
        } catch (e: any) {
            results.employees = { status: 'error', message: e.message };
        }

        // 2. Fetch Leave Balances
        try {
            const leaveBalances = await hrPartner.getLeaveBalances();
            results.leaveBalances = {
                status: 'success',
                count: leaveBalances?.length || 0,
                sample: leaveBalances?.slice(0, 3)
            };
        } catch (e: any) {
            results.leaveBalances = { status: 'error', message: e.message };
        }

        // 3. Fetch Timesheets
        try {
            const timesheets = await hrPartner.getTimesheets();
            results.timesheets = {
                status: 'success',
                count: timesheets?.length || 0,
                sample: timesheets?.slice(0, 3)
            };
        } catch (e: any) {
            results.timesheets = { status: 'error', message: e.message };
        }

        return NextResponse.json({
            success: true,
            message: 'HRPartner integration test successful',
            results
        });
    } catch (error: any) {
        console.error('HRPartner Test Error:', error);
        return NextResponse.json({
            success: false,
            message: 'HRPartner integration test failed',
            error: error.message
        }, { status: 500 });
    }
}
