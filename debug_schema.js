
const { createClient } = require('@supabase/supabase-client')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugSchema() {
    try {
        console.log('--- payroll_records columns ---')
        const { data: payroll, error: pError } = await supabase.from('payroll_records').select('*').limit(1)
        if (pError) console.error('Payroll Error:', pError)
        else if (payroll && payroll.length > 0) console.log(Object.keys(payroll[0]).join(', '))
        else console.log('No records in payroll_records')

        console.log('\n--- deductions columns ---')
        const { data: deductions, error: dError } = await supabase.from('deductions').select('*').limit(1)
        if (dError) console.error('Deductions Error:', dError)
        else if (deductions && deductions.length > 0) console.log(Object.keys(deductions[0]).join(', '))
        else console.log('No records in deductions')

        console.log('\n--- deduction_types columns ---')
        const { data: types, error: tError } = await supabase.from('deduction_types').select('*').limit(1)
        if (tError) console.error('Types Error:', tError)
        else if (types && types.length > 0) console.log(Object.keys(types[0]).join(', '))
        else console.log('No records in deduction_types')
    } catch (e) {
        console.error('Unexpected error:', e)
    }
}

debugSchema()
