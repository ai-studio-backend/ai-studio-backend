// API Route: Admin - Create new user
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

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
    const adminUid = decodedToken.uid;

    const adminDoc = await adminDb.collection('users').doc(adminUid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { email, password, displayName, role = 'user', plan = 'free' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
    });

    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: displayName || email.split('@')[0],
      role: role,
      status: 'active',
      subscription: {
        plan: plan,
        startDate: new Date(),
        endDate: plan === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      usage: { totalRequests: 0, lastActive: null },
      createdAt: new Date(),
      createdBy: adminUid,
    });

    await adminDb.collection('admin_logs').add({
      action: 'create_user',
      targetUid: userRecord.uid,
      targetEmail: email,
      adminUid: adminUid,
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'User created successfully',
      user: { uid: userRecord.uid, email: userRecord.email },
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: error.message });
  }
}
