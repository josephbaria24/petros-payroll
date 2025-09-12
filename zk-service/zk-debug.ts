// zk-service/zk-debug.ts

// @ts-ignore - node-zklib has no types
const ZKLib = require("node-zklib");

async function debugZK() {
  // Replace with your device IP and port (4370 is default for ZKTeco)
  const zk = new ZKLib("192.168.254.201", 4370, 10000, 4000);

  try {
    await zk.createSocket();
    console.log("✅ Connected to ZKTeco device");

    // Get device info
    try {
      const info = await zk.getInfo();
      console.log("📟 Device Info:", info);
    } catch (err: any) {
      console.error("❌ Error fetching device info:", err.message || err);
    }

    // Get enrolled users
    try {
      const users = await zk.getUsers();
      console.log("👥 Users:", users);
    } catch (err: any) {
      console.error("❌ Error fetching users:", err.message || err);
    }

    await zk.disconnect();
    console.log("🔌 Disconnected.");
  } catch (err: any) {
    console.error("❌ Could not connect:", err.message || err);
  }
}

debugZK();
