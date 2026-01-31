// API Route: Update user presence (real-time status)
import { adminAuth, adminRtdb, adminDb } from '../../../lib/firebase-admin';

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
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { online, device, activity } = req.body;

    // Update presence in Realtime Database
    await adminRtdb.ref(`presence/${uid}`).set({
      online: online !== false,
      lastSeen: Date.now(),
      device: device || 'extension',
      activity: activity || 'idle',
    });

    // Update last active in Firestore
    await adminDb.collection('users').doc(uid).update({
      'usage.lastActive': new Date(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Presence update error:', error);
    return res.status(500).json({ error: error.message });
  }
}
