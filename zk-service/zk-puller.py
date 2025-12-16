from zk import ZK, const
import os
from supabase import create_client, Client
from datetime import datetime, date, time as dt_time
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv(".env.local")

# Supabase credentials
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print("Using Supabase URL:", SUPABASE_URL)
print("Key starts with:", SUPABASE_KEY[:10] if SUPABASE_KEY else None)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def test_supabase_connection():
    try:
        response = supabase.table("attendance_logs").select("*").limit(1).execute()
        print("[OK] Supabase connection successful")
        return True
    except Exception as e:
        print(f"[ERROR] Supabase connection failed: {e}")
        return False


def get_existing_logs_for_day(user_id: int, log_date: date):
    """Get all existing logs for this user on this date"""
    try:
        response = (
            supabase.table("attendance_logs")
            .select("*")
            .eq("user_id", user_id)
            .gte("timestamp", f"{log_date}T00:00:00")
            .lte("timestamp", f"{log_date}T23:59:59")
            .order("timestamp", desc=False)
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"[WARN] Could not check existing logs for user {user_id} on {log_date}: {e}")
        return []


def should_process_log(user_id: int, log_timestamp: datetime) -> tuple[bool, str]:
    """
    Determine if this log should be processed and what type it is.
    Returns: (should_process, log_type)
    log_type can be: 'time_in', 'time_out', or 'skip'
    """
    log_date = log_timestamp.date()
    log_time = log_timestamp.time()
    
    existing_logs = get_existing_logs_for_day(user_id, log_date)
    
    # No logs for today - this is time in
    if not existing_logs:
        return (True, 'time_in')
    
    # Check if we already have both time in and time out
    has_time_in = any(log.get('status') == 'time_in' for log in existing_logs)
    has_time_out = any(log.get('status') == 'time_out' for log in existing_logs)
    
    if has_time_in and has_time_out:
        print(f"[SKIP] User {user_id} already has complete logs for {log_date}")
        return (False, 'skip')
    
    # If we only have time_in, this new log is time_out
    if has_time_in and not has_time_out:
        # Verify this timestamp is after the time_in
        latest_log = existing_logs[-1]
        latest_timestamp = datetime.fromisoformat(latest_log['timestamp'].replace('Z', '+00:00'))
        
        if log_timestamp > latest_timestamp:
            return (True, 'time_out')
        else:
            print(f"[SKIP] New log timestamp is before existing time_in for user {user_id}")
            return (False, 'skip')
    
    # Shouldn't reach here, but default to time_in
    return (True, 'time_in')


def update_time_log_timeout(user_id: int, log_date: date, time_out: str):
    """Update the time_logs table with time_out"""
    try:
        # Find employee_id from attendance_log_userid
        emp_response = (
            supabase.table("employees")
            .select("id")
            .eq("attendance_log_userid", user_id)
            .single()
            .execute()
        )
        
        if not emp_response.data:
            print(f"[WARN] No employee found with attendance_log_userid {user_id}")
            return
        
        employee_id = emp_response.data['id']
        
        # Update time_logs with time_out
        response = (
            supabase.table("time_logs")
            .update({"time_out": time_out})
            .eq("employee_id", employee_id)
            .eq("date", str(log_date))
            .execute()
        )
        
        print(f"[OK] Updated time_out for employee {employee_id} on {log_date}")
        
    except Exception as e:
        print(f"[ERROR] Failed to update time_out: {e}")


def fetch_logs():
    if not test_supabase_connection():
        print("[STOP] Stopping due to Supabase connection issues")
        return

    conn = None
    zk_configs = [
        {"ip": "192.168.254.201", "port": 4370, "timeout": 10, "password": 0, "force_udp": False},
    ]

    for config in zk_configs:
        try:
            zk = ZK(
                config["ip"],
                port=config["port"],
                timeout=config["timeout"],
                password=config["password"],
                force_udp=config["force_udp"],
            )
            conn = zk.connect()
            print("[OK] Connected to ZK device")
            break
        except Exception as e:
            print(f"[ERROR] Failed to connect: {e}")
            conn = None

    if not conn:
        print("[STOP] Could not connect to any device config")
        return

    try:
        logs = conn.get_attendance()
        print(f"[INFO] Retrieved {len(logs)} total logs")

        today = date.today()
        new_logs = [log for log in logs if log.timestamp.date() >= today]
        print(f"[INFO] Keeping {len(new_logs)} logs from {today} onwards")

        for log in new_logs:
            log_date = log.timestamp.date()
            log_time = log.timestamp.time()
            ts = log.timestamp.isoformat()

            should_process, log_type = should_process_log(log.user_id, log.timestamp)
            
            if not should_process:
                continue

            # Store Philippine time as UTC (matching your existing format)
            timestamp_utc = datetime.combine(log_date, log_time)
            
            data = {
                "user_id": log.user_id,
                "timestamp": timestamp_utc.isoformat(),
                "status": log_type,  # 'time_in' or 'time_out'
                "work_date": str(log_date)
            }
            
            try:
                supabase.table("attendance_logs").insert(data).execute()
                print(f"[OK] Inserted {log_type} for user {log.user_id} at {log_time}")
                
                # If this is time_out, also update the time_logs table
                if log_type == 'time_out':
                    time_out_str = log_time.strftime("%H:%M:%S")
                    update_time_log_timeout(log.user_id, log_date, time_out_str)
                
            except Exception as insert_error:
                print(f"[ERROR] Failed to insert log for user {log.user_id}: {insert_error}")

        print("[DONE] Finished processing logs")

    except Exception as e:
        print(f"[ERROR] Error while fetching logs: {e}")
    finally:
        if conn:
            try:
                conn.disconnect()
                print("[OK] Disconnected safely")
            except:
                pass


if __name__ == "__main__":
    fetch_logs()