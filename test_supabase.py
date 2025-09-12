import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print("URL:", url)
print("Key starts with:", key[:10] if key else None)

supabase = create_client(url, key)

# Just try to select from attendance_logs
try:
    response = supabase.table("attendance_logs").select("*").limit(1).execute()
    print("✅ Success:", response)
except Exception as e:
    print("❌ Error:", e)
