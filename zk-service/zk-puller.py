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

def get_existing_logs_for_day(user_id: int, log_date: date, table_name="attendance_logs", is_pdn=False):
    """Get all existing logs for this user on this date via direct REST API"""
    try:
        # Use simple Postgrest filter syntax
        filter_field = "employee_id" if is_pdn else "user_id"
        params = [
            (filter_field, f"eq.{user_id}"),
            ("timestamp", f"gte.{log_date}T00:00:00"),
            ("timestamp", f"lte.{log_date}T23:59:59"),
            ("order", "timestamp.asc")
        ]
        return supabase_request(table_name, params=params)
    except Exception as e:
        print(f"[WARN] Could not check existing logs for user {user_id} in {table_name}: {e}")
        return []

def should_process_log(user_id: int, log_timestamp: datetime, emp_name: str = "User", table_name="attendance_logs", is_pdn=False) -> tuple[bool, str]:
    """
    Determine if this log should be processed and what type it is.
    """
    if emp_name == "User":
        emp_name = f"User {user_id}"

    log_date = log_timestamp.date()
    existing_logs = get_existing_logs_for_day(user_id, log_date, table_name, is_pdn)
    
    if not existing_logs:
        return (True, 'time_in')
    
    # PDN logic: pdn_attendance_logs uses timeout column for time_out
    if is_pdn:
        latest_log = existing_logs[-1]
        has_time_in = latest_log.get('timestamp') is not None
        has_time_out = latest_log.get('timeout') is not None
        
        if has_time_in and has_time_out:
            print(f"[SKIP] {emp_name} already has complete PDN logs for {log_date}")
            return (False, 'skip')
            
        if has_time_in and not has_time_out:
             # Check if current log is after time_in
             ts_str = latest_log['timestamp'].replace('Z', '+00:00')
             latest_timestamp = datetime.fromisoformat(ts_str).replace(tzinfo=None)
             if log_timestamp > latest_timestamp:
                 return (True, 'time_out')
        return (False, 'skip')

    # Petrosphere logic: separate rows for time_in/time_out in attendance_logs
    has_time_in = any(log.get('status') == 'time_in' for log in existing_logs)
    has_time_out = any(log.get('status') == 'time_out' for log in existing_logs)
    
    if has_time_in and has_time_out:
        print(f"[SKIP] {emp_name} already has complete logs for {log_date}")
        return (False, 'skip')
    
    if has_time_in and not has_time_out:
        latest_log = existing_logs[-1]
        try:
            ts_str = latest_log['timestamp'].replace('Z', '+00:00')
            latest_timestamp = datetime.fromisoformat(ts_str).replace(tzinfo=None)
            
            if log_timestamp > latest_timestamp:
                return (True, 'time_out')
        except Exception as e:
            print(f"[ERROR] Date parsing error for {emp_name}: {e}")
    
    return (False, 'skip')

def sync_to_time_logs(user_id: int, employee_id: str, log_date: date, log_time: str, log_type: str):
    """Update or create a record in the time_logs table (payroll timesheet)"""
    try:
        if log_type == 'time_in':
            params = {"employee_id": f"eq.{employee_id}", "date": f"eq.{log_date}"}
            existing = supabase_request("time_logs", params=params)
            
            if not existing:
                data = {
                    "employee_id": employee_id,
                    "date": str(log_date),
                    "time_in": log_time,
                    "status": "Present"
                }
                supabase_request("time_logs", method="POST", data=data)
                print(f"[OK] Created new timesheet entry for employee {employee_id} (time_in: {log_time})")
        
        elif log_type == 'time_out':
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
    zk_configs = [{"ip": "192.168.1.201", "port": 4370, "timeout": 10, "password": 0, "force_udp": False}]

    for config in zk_configs:
        print(f"[INFO] Attempting to connect to ZK device at {config['ip']}...")
        try:
            zk = ZK(config["ip"], port=config["port"], timeout=config["timeout"], 
                    password=config["password"], force_udp=config["force_udp"])
            temp_conn = zk.connect()
            if temp_conn:
                conn = temp_conn
                print(f"[OK] Connected to ZK device at {config['ip']}")
                break
        except Exception as e:
            print(f"[ERROR] Connection to {config['ip']} failed: {e}")

    if conn is None: return

    try:
        user_name_map = {}
        user_emp_id_map = {}
        user_org_map = {} # org -> "petrosphere" or "pdn"

        # 1. Fetch Petrosphere employees
        try:
            employees = supabase_request("employees", params={"select": "id,attendance_log_userid,full_name"})
            for emp in employees:
                if emp.get('attendance_log_userid'):
                    u_id = int(emp['attendance_log_userid'])
                    user_name_map[u_id] = emp.get('full_name', f"User {u_id}")
                    user_emp_id_map[u_id] = emp['id']
                    user_org_map[u_id] = 'petrosphere'
            print(f"[INFO] Loaded {len(employees)} Petrosphere employees")
        except Exception as e:
            print(f"[WARN] Could not load Petrosphere employees: {e}")

        # 2. Fetch PDN employees
        try:
            pdn_employees = supabase_request("pdn_employees", params={"select": "id,attendance_log_userid,full_name"})
            for emp in pdn_employees:
                if emp.get('attendance_log_userid'):
                    u_id = int(emp['attendance_log_userid'])
                    user_name_map[u_id] = emp.get('full_name', f"User {u_id}")
                    user_emp_id_map[u_id] = emp['id']
                    user_org_map[u_id] = 'pdn'
            print(f"[INFO] Loaded {len(pdn_employees)} PDN employees")
        except Exception as e:
            print(f"[WARN] Could not load PDN employees: {e}")

        # 3. Retrieve users from ZK device for name fallback
        try:
            zk_users = conn.get_users()
            for u in zk_users:
                u_id = int(u.user_id)
                if u_id not in user_name_map:
                    user_name_map[u_id] = u.name.strip()
        except: pass

        logs = conn.get_attendance()
        today = date.today()
        from datetime import timedelta
        lookback_date = today - timedelta(days=7)
        new_logs = [log for log in logs if log.timestamp.date() >= lookback_date]
        print(f"[INFO] Checking {len(new_logs)} logs from {lookback_date} onwards")

        for log in new_logs:
            u_id = int(log.user_id)
            org = user_org_map.get(u_id, 'petrosphere') # Default to petrosphere if unknown
            emp_name = user_name_map.get(u_id, f"User {u_id}")
            emp_uuid = user_emp_id_map.get(u_id)
            
            is_pdn = (org == 'pdn')
            table_name = "pdn_attendance_logs" if is_pdn else "attendance_logs"
            
            should_process, log_type = should_process_log(u_id if not is_pdn else emp_uuid, log.timestamp, emp_name, table_name, is_pdn)
            
            if not should_process: continue

            try:
                if is_pdn:
                    # PDN special handling: timestamp and timeout in one record
                    if log_type == 'time_in':
                        data = { "employee_id": emp_uuid, "timestamp": log.timestamp.isoformat() + "+08:00", "work_date": str(log.timestamp.date()), "full_name": emp_name, "status": "Present" }
                        supabase_request("pdn_attendance_logs", method="POST", data=data)
                    else: # time_out
                        supabase_request("pdn_attendance_logs", method="PATCH", params={"employee_id": f"eq.{emp_uuid}", "work_date": f"eq.{log.timestamp.date()}"}, data={"timeout": log.timestamp.isoformat() + "+08:00"})
                    print(f"[OK] {org.upper()} {log_type} log for {emp_name} at {log.timestamp.time()}")
                else:
                    # Petrosphere standard handling
                    data = { "user_id": u_id, "timestamp": log.timestamp.isoformat() + "+08:00", "status": log_type, "work_date": str(log.timestamp.date()), "full_name": emp_name }
                    supabase_request("attendance_logs", method="POST", data=data)
                    print(f"[OK] {org.upper()} {log_type} log for {emp_name} at {log.timestamp.time()}")
                    
                    if emp_uuid:
                        sync_to_time_logs(u_id, emp_uuid, log.timestamp.date(), log.timestamp.strftime("%H:%M:%S"), log_type)
                    
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
    import time
    print("[SERVICE] Starting persistent biometrics sync service...")
    while True:
        try:
            fetch_logs()
        except Exception as e:
            print(f"[CRITICAL ERROR] {e}")
        
        # Sync every 5 minutes (300 seconds)
        time.sleep(300)