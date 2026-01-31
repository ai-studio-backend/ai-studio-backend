// API Route: Remove device on logout
import { adminAuth, adminDb } from '../../../lib/firebase-admin';

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
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { deviceId } = req.body;

    // Verify token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Clear active device if it matches
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      
      // Only clear if this is the active device
      if (userData.activeDeviceId === deviceId) {
        await userRef.update({
          activeDeviceId: null,
          activeDeviceInfo: null,
          lastLogout: new Date().toISOString()
        });
      }

      // Log device logout
      await adminDb.collection('deviceLogs').add({
        uid,
        deviceId,
        action: 'logout',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Device logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
