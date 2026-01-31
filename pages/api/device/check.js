// API Route: Check if device is still the active device
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const activeDeviceId = userData.activeDeviceId;

    if (activeDeviceId && activeDeviceId !== deviceId) {
      return res.status(200).json({
        valid: false,
        forceLogout: true,
        deviceRevoked: true,
        message: 'บัญชีนี้ถูกใช้งานบนอุปกรณ์อื่น'
      });
    }

    await adminDb.collection('users').doc(uid).update({
      lastActivity: new Date().toISOString()
    });

    return res.status(200).json({
      valid: true,
      forceLogout: false,
      deviceRevoked: false
    });

  } catch (error) {
    console.error('Device check error:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired', forceLogout: true });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
