from zk import ZK
import socket

def test_zk_behavior():
    # Use a dummy IP that will likely fail or timeout
    zk = ZK('1.1.1.1', timeout=1)
    print(f"Testing ZK(1.1.1.1) connect...")
    try:
        conn = zk.connect()
        print(f"conn: {conn}")
        print(f"type(conn): {type(conn)}")
        if not conn:
            print("conn is falsy")
        else:
            print("conn is truthy")
    except Exception as e:
        print(f"Caught exception: {e}")

if __name__ == "__main__":
    test_zk_behavior()
