from zk import ZK, const
import os
import json
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, date, time as dt_time
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env.local in project root
root_dir = Path(__file__).parent.parent
env_path = root_dir / ".env.local"
load_dotenv(env_path)

# Supabase credentials
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def supabase_request(path, method="GET", data=None, params=None):
    """Zero-dependency Supabase REST call using standard urllib"""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        # Filter out multi-value params if needed, but and/or Postgrest filters are usually single strings
        url += "?" + urllib.parse.urlencode(params)
    
    req = urllib.request.Request(url, method=method)
    req.add_header("apikey", SUPABASE_KEY if SUPABASE_KEY else "")
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY if SUPABASE_KEY else ''}")
    req.add_header("Content-Type", "application/json")
    
    # Supabase (Postgrest) PATCH/POST usually expects return=minimal for efficiency unless data is needed
    if method in ["PATCH", "POST"]:
        req.add_header("Prefer", "return=representation")
    
    body = json.dumps(data).encode('utf-8') if data else None
    
    try:
        with urllib.request.urlopen(req, data=body) as response:
            res_content = response.read().decode('utf-8')
            return json.loads(res_content) if res_content else []
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"[HTTP ERROR] {e.code} on {method} {path}: {err_body}")
        raise e

def test_supabase_connection():
    try:
        # Test basic connectivity by fetching one log
        supabase_request("attendance_logs", params={"limit": 1})
        print("[OK] Supabase connection successful")
        return True
    except Exception as e:
        print(f"[ERROR] Supabase connection failed: {e}")
        return False

def get_existing_logs_for_day(user_id: int, log_date: date):
    """Get all existing logs for this user on this date via direct REST API"""
    try:
        # Use simple Postgrest filter syntax
        params = [
            ("user_id", f"eq.{user_id}"),
            ("timestamp", f"gte.{log_date}T00:00:00"),
            ("timestamp", f"lte.{log_date}T23:59:59"),
            ("order", "timestamp.asc")
        ]
        return supabase_request("attendance_logs", params=params)
    except Exception as e:
        print(f"[WARN] Could not check existing logs for user {user_id}: {e}")
        return []

def should_process_log(user_id: int, log_timestamp: datetime, emp_name: str = "User") -> tuple[bool, str]:
    """
    Determine if this log should be processed and what type it is.
    """
    if emp_name == "User":
        emp_name = f"User {user_id}"

    log_date = log_timestamp.date()
    existing_logs = get_existing_logs_for_day(user_id, log_date)
    
    if not existing_logs:
        return (True, 'time_in')
    
    has_time_in = any(log.get('status') == 'time_in' for log in existing_logs)
    has_time_out = any(log.get('status') == 'time_out' for log in existing_logs)
    
    if has_time_in and has_time_out:
        print(f"[SKIP] {emp_name} already has complete logs for {log_date}")
        return (False, 'skip')
    
    if has_time_in and not has_time_out:
        latest_log = existing_logs[-1]
        try:
            # Handle timestamps with or without 'Z' or '+00:00'
            ts_str = latest_log['timestamp'].replace('Z', '+00:00')
            # fromisoformat includes timezone if present (+00:00)
            latest_timestamp_aware = datetime.fromisoformat(ts_str)
            # Make it naive for comparison with ZK device timestamp (which is naive)
            latest_timestamp = latest_timestamp_aware.replace(tzinfo=None)
            
            if log_timestamp > latest_timestamp:
                return (True, 'time_out')
            else:
                print(f"[SKIP] {emp_name} log at {log_timestamp.time()} is not after latest {latest_timestamp.time()}")
        except Exception as e:
            print(f"[ERROR] Date parsing error for {emp_name}: {e}")
    
    return (False, 'skip')

def sync_to_time_logs(user_id: int, employee_id: str, log_date: date, log_time: str, log_type: str):
    """Update or create a record in the time_logs table (payroll timesheet)"""
    try:
        if log_type == 'time_in':
            # Check if a record already exists for this employee and date
            params = {"employee_id": f"eq.{employee_id}", "date": f"eq.{log_date}"}
            existing = supabase_request("time_logs", params=params)
            
            if not existing:
                # Create a new record for the day
                data = {
                    "employee_id": employee_id,
                    "date": str(log_date),
                    "time_in": log_time,
                    "status": "Present"
                }
                supabase_request("time_logs", method="POST", data=data)
                print(f"[OK] Created new timesheet entry for employee {employee_id} (time_in: {log_time})")
            else:
                print(f"[SKIP] Timesheet entry already exists for employee {employee_id} on {log_date}")

        elif log_type == 'time_out':
            # Update the existing record with time_out
            supabase_request(
                "time_logs", 
                method="PATCH",
                params={"employee_id": f"eq.{employee_id}", "date": f"eq.{log_date}"},
                data={"time_out": log_time}
            )
            print(f"[OK] Updated time_out ({log_time}) in timesheet for employee {employee_id} on {log_date}")
        
    except Exception as e:
        print(f"[ERROR] Failed to sync to time_logs for user {user_id}: {e}")

def fetch_logs():
    if not test_supabase_connection():
        print("[STOP] Stopping due to Supabase connection issues")
        return

    conn = None
    zk_configs = [
        {"ip": "192.168.254.201", "port": 4370, "timeout": 10, "password": 0, "force_udp": False},
    ]

    for config in zk_configs:
        print(f"[INFO] Attempting to connect to ZK device at {config['ip']}...")
        try:
            zk = ZK(config["ip"], port=config["port"], timeout=config["timeout"], 
                    password=config["password"], force_udp=config["force_udp"])
            # Some versions of pyzk might return None or raise an exception
            temp_conn = zk.connect()
            if temp_conn:
                conn = temp_conn
                print(f"[OK] Connected to ZK device at {config['ip']}")
                break
            else:
                print(f"[WARN] Connection to {config['ip']} returned None")
        except Exception as e:
            print(f"[ERROR] Connection to {config['ip']} failed: {e}")

    if conn is None:
        print("[STOP] Could not connect to any device config. Please check if the device is online and the IP is correct.")
        return

    try:
        # Double check that we have a valid connection with the required method
        if not hasattr(conn, 'get_attendance'):
            print("[ERROR] Connection object does not have 'get_attendance' method")
            return
        try:
            # 1. Fetch employee mappings from Supabase (Source of Truth for HR)
            user_name_map = {}
            user_emp_id_map = {}
            try:
                employees = supabase_request("employees", params={"select": "id,attendance_log_userid,first_name,last_name"})
                for emp in employees:
                    if emp.get('attendance_log_userid'):
                        u_id = int(emp['attendance_log_userid'])
                        full_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
                        user_name_map[u_id] = full_name
                        user_emp_id_map[u_id] = emp['id']
                print(f"[INFO] Loaded {len(user_name_map)} employee mappings from Supabase")
            except Exception as e:
                print(f"[WARN] Could not load employee data from Supabase: {e}")

            # 2. Fetch users from ZK Device (as backup or additional source)
            try:
                zk_users = conn.get_users()
                print(f"[INFO] Retrieved {len(zk_users)} users from ZK device")
                for u in zk_users:
                    u_id = int(u.user_id)
                    # If user is not already mapped in Supabase, take the device name
                    if u_id not in user_name_map or not user_name_map[u_id]:
                        user_name_map[u_id] = u.name.strip()
            except Exception as e:
                print(f"[WARN] Could not load names from ZK device: {e}")

            logs = conn.get_attendance()
            print(f"[INFO] Retrieved {len(logs)} total logs")

            today = date.today()
            # Keep logs from today only to avoid historical reprocessing
            new_logs = [log for log in logs if log.timestamp.date() >= today]
            print(f"[INFO] Checking {len(new_logs)} logs from {today} onwards")

            for log in new_logs:
                emp_name = user_name_map.get(int(log.user_id), f"User {log.user_id}")
                should_process, log_type = should_process_log(log.user_id, log.timestamp, emp_name)
                
                if not should_process:
                    continue

                data = {
                    "user_id": log.user_id,
                    "timestamp": log.timestamp.isoformat(),
                    "status": log_type,
                    "work_date": str(log.timestamp.date()),
                    "full_name": emp_name
                }
                
                try:
                    supabase_request("attendance_logs", method="POST", data=data)
                    print(f"[OK] Inserted binary {log_type} log for {emp_name} at {log.timestamp.time()}")
                    
                    # Also update the payroll timekeeping table (time_logs)
                    employee_id = user_emp_id_map.get(int(log.user_id))
                    if employee_id:
                        log_time_str = log.timestamp.strftime("%H:%M:%S")
                        sync_to_time_logs(log.user_id, employee_id, log.timestamp.date(), log_time_str, log_type)
                    
                except Exception as e:
                    print(f"[ERROR] Failed to process log for {emp_name}: {e}")

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