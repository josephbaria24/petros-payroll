//zk-service\zk-puller.ts

// @ts-ignore
const ZKLib = require("node-zklib");
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load env vars
dotenv.config({ path: ".env.local" });

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
async function fetchLogs() {
  const zk = new ZKLib('192.168.254.201', 4370, 10000, 4000)

  try {
    await zk.createSocket()
    console.log('Connected to ZKTeco! ✅')

    // Get logs from device
    const logs = await zk.getAttendances();

    if (!logs || !logs.data) {
      console.log("No attendance logs found.");
    } else {
      console.log("Logs:", logs.data);
    
      for (let log of logs.data) {
        await supabase.from("attendance_logs").insert({
          user_id: log.uid,
          timestamp: new Date(log.recordTime),
          status: log.type,
        });
      }
    }
    

    await zk.disconnect()
  } catch (e) {
    console.error(e)
  }
}

fetchLogs()
