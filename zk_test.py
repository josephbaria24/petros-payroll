from zk import ZK
import sys

def test_zk_connection():
    """Test ZK device connection with various parameters"""
    
    host = '192.168.254.201'
    port = 4370
    
    # Test configurations
    configs = [
        {'password': 0, 'force_udp': False, 'timeout': 10},
        {'password': 0, 'force_udp': True, 'timeout': 10},
        {'password': '', 'force_udp': False, 'timeout': 10},
        {'password': None, 'force_udp': False, 'timeout': 10},
        {'password': 1234, 'force_udp': False, 'timeout': 10},
        {'password': 12345, 'force_udp': False, 'timeout': 10},
        {'password': 123456, 'force_udp': False, 'timeout': 10},
        {'password': '1234', 'force_udp': False, 'timeout': 10},
        {'password': '12345', 'force_udp': False, 'timeout': 10},
        {'password': 0, 'force_udp': False, 'timeout': 30},  # Longer timeout
    ]
    
    print(f"🔍 Testing ZK device connection to {host}:{port}")
    print("=" * 60)
    
    for i, config in enumerate(configs, 1):
        print(f"\n📋 Test {i}: Password={repr(config['password'])}, UDP={config['force_udp']}, Timeout={config['timeout']}s")
        
        try:
            zk = ZK(host, port=port, **config)
            conn = zk.connect()
            
            print("✅ CONNECTION SUCCESS!")
            
            # Try to get basic info
            try:
                users = conn.get_users()
                print(f"👥 Found {len(users)} users")
            except Exception as e:
                print(f"⚠️ Connected but couldn't get users: {e}")
            
            try:
                attendance = conn.get_attendance()
                print(f"📋 Found {len(attendance)} attendance records")
            except Exception as e:
                print(f"⚠️ Connected but couldn't get attendance: {e}")
            
            try:
                firmware = conn.get_firmware_version()
                print(f"🔧 Firmware: {firmware}")
            except Exception as e:
                print(f"⚠️ Connected but couldn't get firmware: {e}")
            
            conn.disconnect()
            print("🎉 SUCCESS! Use these settings:")
            print(f"   Password: {repr(config['password'])}")
            print(f"   UDP: {config['force_udp']}")
            print(f"   Timeout: {config['timeout']}")
            return config
            
        except Exception as e:
            print(f"❌ FAILED: {e}")
    
    print("\n💔 All connection attempts failed!")
    print("\n🔧 Troubleshooting suggestions:")
    print("1. Check if device has a web interface at http://192.168.254.201")
    print("2. Look for password/communication settings on device menu")
    print("3. Try resetting device communication settings")
    print("4. Check device manual for default password")
    
    return None

if __name__ == "__main__":
    test_zk_connection()