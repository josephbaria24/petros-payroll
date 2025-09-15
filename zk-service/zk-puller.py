from zk import ZK, const
import os
from supabase import create_client, Client
from datetime import datetime, date
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


def log_exists_for_day(user_id: int, log_date: date) -> bool:
    """Check if a log for this user already exists on this date (ignore time)"""
    try:
        response = (
            supabase.table("attendance_logs")
            .select("id")
            .eq("user_id", user_id)
            .gte("timestamp", f"{log_date}T00:00:00")
            .lte("timestamp", f"{log_date}T23:59:59")
            .execute()
        )
        return len(response.data) > 0
    except Exception as e:
        print(f"[WARN] Could not check existing logs for user {user_id} on {log_date}: {e}")
        return False


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
            ts = log.timestamp.isoformat()

            if log_exists_for_day(log.user_id, log_date):
                print(f"[SKIP] Log already exists for user {log.user_id} on {log_date}")
                continue

            data = {
                "user_id": log.user_id,
                "timestamp": ts,
                "status": log.status,
            }
            try:
                supabase.table("attendance_logs").insert(data).execute()
                print(f"[OK] Inserted log for user {log.user_id} on {log_date}")
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
