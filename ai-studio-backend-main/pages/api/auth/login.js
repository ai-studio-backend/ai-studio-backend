// API Route: Login user with Device Limit (1 ID = 1 Computer)
import { adminAuth, adminDb, adminRtdb } from '../../../lib/firebase-admin';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { idToken, deviceId, deviceInfo } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Missing ID token' });
    }

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get user data from Firestore
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Check if user is suspended
    if (userData.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // ========== DEVICE LIMIT CHECK (1 ID = 1 Computer) ==========
    const now = new Date();
    const activeDeviceId = userData.activeDeviceId;
    const lastActivity = userData.lastActivity ? new Date(userData.lastActivity) : null;
    
    // ถ้ามี active device และไม่ใช่ device เดียวกัน
    if (deviceId && activeDeviceId && activeDeviceId !== deviceId) {
      // ตรวจสอบว่า device เดิมยังใช้งานอยู่หรือไม่ (ภายใน 2 นาที)
      const deviceTimeout = 2 * 60 * 1000; // 2 minutes
      
      if (lastActivity && (now - lastActivity) < deviceTimeout) {
        // Device เดิมยังใช้งานอยู่ - ไม่อนุญาตให้ login
        console.log(`Device limit exceeded for user ${uid}. Active: ${activeDeviceId}, Requesting: ${deviceId}`);
        return res.status(200).json({
          success: false,
          error: 'DEVICE_LIMIT_EXCEEDED',
          message: 'บัญชีนี้ถูกใช้งานบนอุปกรณ์อื่นแล้ว',
          activeDevices: [{
            deviceId: activeDeviceId,
            lastActivity: userData.lastActivity,
            deviceInfo: userData.activeDeviceInfo
          }]
        });
      }
      
      // Device เดิมไม่ได้ใช้งานแล้ว (timeout) - อนุญาตให้ login และแทนที่
      console.log(`Device ${activeDeviceId} timed out, replacing with ${deviceId} for user ${uid}`);
    }

    // ========== UPDATE ACTIVE DEVICE ==========
    const updateData = {
      'usage.lastActive': now,
      updatedAt: now,
      lastActivity: now.toISOString(),
      lastLogin: now.toISOString(),
    };

    // บันทึก device info ถ้ามี
    if (deviceId) {
      updateData.activeDeviceId = deviceId;
      updateData.activeDeviceInfo = deviceInfo || {};
    }

    await userRef.update(updateData);

    // Log device login
    if (deviceId) {
      await adminDb.collection('deviceLogs').add({
        uid,
        deviceId,
        action: 'login',
        previousDevice: activeDeviceId || null,
        deviceInfo: deviceInfo || {},
        timestamp: now.toISOString()
      });
    }

    // Set presence to online
    await adminRtdb.ref(`presence/${uid}`).set({
      online: true,
      lastSeen: Date.now(),
      device: 'extension',
      deviceId: deviceId || null,
    });

    return res.status(200).json({
      success: true,
      user: {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        status: userData.status,
        subscription: userData.subscription,
      },
      deviceId,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(401).json({ 
      success: false, 
      error: error.message 
    });
  }
}
