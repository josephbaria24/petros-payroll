import { NextResponse } from 'next/server';
import { hrPartner } from '@/lib/hrpartner';
import { supabase } from '@/lib/supabaseClient';

export async function POST() {
    try {
        console.log('Starting HRPartner employee sync...');

        // 1. Fetch all employees and leave balances from HRPartner
        const hrEmployees = await hrPartner.getEmployees();
        const hrLeaveBalances = await hrPartner.getLeaveBalances();

        // Aggregate leave balances by employee code
        const leaveMap = new Map();
        if (Array.isArray(hrLeaveBalances)) {
            hrLeaveBalances.forEach((lb: any) => {
                const code = lb.employee?.code;
                if (code) {
                    const current = leaveMap.get(code) || 0;
                    leaveMap.set(code, current + (lb.balance || 0));
                }
            });
        }

        // 2. Fetch all employees from local database
        const { data: localEmployees, error: fetchError } = await supabase
            .from('employees')
            .select('id, employee_code, full_name, email');

        if (fetchError) {
            throw new Error(`Failed to fetch local employees: ${fetchError.message}`);
        }

        // 3. Create a map of local employees by employee_code
        const localEmployeeMap = new Map(
            localEmployees?.map(emp => [emp.employee_code, emp]) || []
        );

        const results = {
            totalHRPartner: hrEmployees?.length || 0,
            matched: [] as any[],
            unmatched: [] as any[],
            updated: 0,
            errors: [] as any[]
        };

        // 4. Process each HRPartner employee
        for (const hrEmp of hrEmployees || []) {
            const localEmp = localEmployeeMap.get(hrEmp.code);

            if (!localEmp) {
                // Employee exists in HRPartner but not in local DB
                results.unmatched.push({
                    code: hrEmp.code,
                    name: hrEmp.full_name,
                    email: hrEmp.email
                });
                continue;
            }

            // Employee matched - prepare update data
            const updateData: any = {
                full_name: hrEmp.full_name || localEmp.full_name,
                email: hrEmp.email || localEmp.email,
                department: hrEmp.department || null,
                position: hrEmp.position || null,
                leave_credits: leaveMap.get(hrEmp.code) || 0
            };

            // Extract government IDs from custom_data
            if (hrEmp.custom_data) {
                if (hrEmp.custom_data['sss-number']) {
                    updateData.sss = hrEmp.custom_data['sss-number'];
                }
                if (hrEmp.custom_data['philhealth-number']) {
                    updateData.philhealth = hrEmp.custom_data['philhealth-number'];
                }
                if (hrEmp.custom_data['pagibig-number']) {
                    updateData.pagibig = hrEmp.custom_data['pagibig-number'];
                }
            }

            // Update the employee in the database
            const { error: updateError } = await supabase
                .from('employees')
                .update(updateData)
                .eq('id', localEmp.id);

            if (updateError) {
                results.errors.push({
                    code: hrEmp.code,
                    name: hrEmp.full_name,
                    error: updateError.message
                });
            } else {
                results.matched.push({
                    code: hrEmp.code,
                    name: hrEmp.full_name,
                    updated: Object.keys(updateData)
                });
                results.updated++;
            }
        }

        // 5. Find employees in local DB but not in HRPartner
        const hrEmployeeCodes = new Set(hrEmployees?.map((e: any) => e.code) || []);
        const notInHRPartner = localEmployees?.filter(
            emp => emp.employee_code && !hrEmployeeCodes.has(emp.employee_code)
        ) || [];

        return NextResponse.json({
            success: true,
            message: `Sync completed: ${results.updated} employees updated`,
            summary: {
                totalInHRPartner: results.totalHRPartner,
                totalInLocalDB: localEmployees?.length || 0,
                matched: results.matched.length,
                updated: results.updated,
                unmatchedInHRPartner: results.unmatched.length,
                notInHRPartner: notInHRPartner.length,
                errors: results.errors.length
            },
            details: {
                matched: results.matched,
                unmatchedInHRPartner: results.unmatched,
                notInHRPartner: notInHRPartner.map((e: any) => ({
                    code: e.employee_code,
                    name: e.full_name
                })),
                errors: results.errors
            }
        });
    } catch (error: any) {
        console.error('HRPartner Sync Error:', error);
        return NextResponse.json({
            success: false,
            message: 'Sync failed',
            error: error.message
        }, { status: 500 });
    }
}
