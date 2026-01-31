// API Route: Admin - Get all users
import { adminAuth, adminDb } from '../../../lib/firebase-admin';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Check if user is admin
    const adminDoc = await adminDb.collection('users').doc(uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all users
    const usersSnapshot = await adminDb.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const users = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        status: data.status,
        subscription: data.subscription,
        usage: data.usage,
        createdAt: data.createdAt?.toDate(),
        lastActive: data.usage?.lastActive?.toDate(),
      });
    });

    // Get online users from Realtime Database
    const presenceSnapshot = await adminDb.collection('presence').get();
    const onlineUsers = {};
    presenceSnapshot.forEach(doc => {
      onlineUsers[doc.id] = doc.data().online;
    });

    return res.status(200).json({
      success: true,
      users,
      onlineUsers,
      total: users.length,
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ error: error.message });
  }
}
