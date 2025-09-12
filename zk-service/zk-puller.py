from zk import ZK, const
import os
from supabase import create_client, Client
from datetime import datetime
from dotenv import load_dotenv
from datetime import datetime, date
# Load environment variables from .env.local
load_dotenv(".env.local")

# Supabase credentials
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print("Using Supabase URL:", SUPABASE_URL)
print("Key starts with:", SUPABASE_KEY[:10] if SUPABASE_KEY else None)
print("Key length:", len(SUPABASE_KEY) if SUPABASE_KEY else None)
print("Key suffix:", SUPABASE_KEY[-5:] if SUPABASE_KEY else None)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def test_supabase_connection():
    """Test if we can connect to Supabase and check table access"""
    try:
        # Test connection by trying to read from the table
        response = supabase.table("attendance_logs").select("*").limit(1).execute()
        print("✅ Supabase connection successful")
        print(f"📊 Table access works, found {len(response.data)} records")
        return True
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        return False

def fetch_logs():
    # Test Supabase connection first
    if not test_supabase_connection():
        print("🛑 Stopping due to Supabase connection issues")
        return
    
    conn = None
    
    # Try different connection parameters for ZK device
    zk_configs = [
        {'ip': '192.168.254.201', 'port': 4370, 'timeout': 10, 'password': 0, 'force_udp': False},
        {'ip': '192.168.254.201', 'port': 4370, 'timeout': 10, 'password': 0, 'force_udp': True},
        {'ip': '192.168.254.201', 'port': 4370, 'timeout': 10, 'password': '', 'force_udp': False},
        {'ip': '192.168.254.201', 'port': 4370, 'timeout': 10, 'password': 1234, 'force_udp': False},
        {'ip': '192.168.254.201', 'port': 4370, 'timeout': 10, 'password': 12345, 'force_udp': False},
        {'ip': '192.168.254.201', 'port': 80, 'timeout': 10, 'password': 0, 'force_udp': False},
        {'ip': '192.168.254.201', 'port': 8080, 'timeout': 10, 'password': 0, 'force_udp': False},
        {'ip': '192.168.254.201', 'port': 2000, 'timeout': 10, 'password': 0, 'force_udp': False},
    ]
    
    for i, config in enumerate(zk_configs):
        password_display = config.get('password', 'default')
        print(f"\n🔄 Trying connection {i+1}: {config['ip']}:{config['port']} (UDP: {config['force_udp']}, Password: {password_display}, Timeout: {config['timeout']}s)")
        
        try:
            # Create ZK instance
            zk = ZK(config['ip'], port=config['port'], timeout=config['timeout'], 
                    password=config['password'], force_udp=config['force_udp'])
            
        except Exception as init_error:
            print(f"  ❌ Failed to initialize ZK object: {init_error}")
            continue
        
        try:
            conn = zk.connect()
            print("✅ Connected to ZK device!")
            
            # Test if we can get device info
            try:
                firmware = conn.get_firmware_version()
                print(f"📱 Device firmware: {firmware}")
            except:
                print("⚠️ Connected but couldn't get firmware info")
            
            break  # Successfully connected, exit the loop
            
        except Exception as e:
            print(f"❌ Connection {i+1} failed: {e}")
            if conn:
                try:
                    conn.disconnect()
                except:
                    pass
                conn = None
    
    if not conn:
        print("🛑 All connection attempts failed. Please check:")
        print("   - Device IP address (192.168.254.201)")
        print("   - Network connectivity (can you ping the device?)")
        print("   - Device is powered on and functioning")
        print("   - No firewall blocking the connection")
        return

def fetch_logs():
    # Test Supabase connection first
    if not test_supabase_connection():
        print("🛑 Stopping due to Supabase connection issues")
        return
    
    conn = None
    
    # Connection configs (you can simplify if only 1 works reliably)
    zk_configs = [
        {'ip': '192.168.254.201', 'port': 4370, 'timeout': 10, 'password': 0, 'force_udp': False},
    ]
    
    # Try to connect
    for config in zk_configs:
        try:
            zk = ZK(
                config['ip'],
                port=config['port'],
                timeout=config['timeout'],
                password=config['password'],
                force_udp=config['force_udp']
            )
            conn = zk.connect()
            print("✅ Connected to ZK device!")
            break
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            conn = None
    
    if not conn:
        print("🛑 Could not connect to any device config")
        return

    try:
        # Get all logs
        logs = conn.get_attendance()
        print(f"📥 Retrieved {len(logs)} total logs")

        # Filter today's logs onwards
        today = date.today()
        new_logs = [log for log in logs if log.timestamp.date() >= today]
        print(f"📅 Keeping {len(new_logs)} logs from {today} onwards")

        for log in new_logs:
            data = {
                "user_id": log.user_id,
                "timestamp": log.timestamp.isoformat(),
                "status": log.status,
            }
            try:
                supabase.table("attendance_logs").insert(data).execute()
                print(f"✅ Inserted log for user {log.user_id} at {log.timestamp}")
            except Exception as insert_error:
                print(f"❌ Failed to insert log for user {log.user_id}: {insert_error}")

        print("🔌 Done processing logs")

    except Exception as e:
        print(f"❌ Error while fetching logs: {e}")
    finally:
        if conn:
            try:
                conn.disconnect()
                print("🔌 Disconnected safely")
            except:
                pass


if __name__ == "__main__":
    fetch_logs()
