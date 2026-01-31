// API Route: Login user
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
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Missing ID token' });
    }

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get user data from Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Check if user is suspended
    if (userData.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Update last active
    await adminDb.collection('users').doc(uid).update({
      'usage.lastActive': new Date(),
      updatedAt: new Date(),
    });

    // Set presence to online
    await adminRtdb.ref(`presence/${uid}`).set({
      online: true,
      lastSeen: Date.now(),
      device: 'extension',
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
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(401).json({ 
      success: false, 
      error: error.message 
    });
  }
}
