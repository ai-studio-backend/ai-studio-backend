// API Route: Admin - Get usage statistics
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

    const usersSnapshot = await adminDb.collection('users').get();
    
    let totalUsers = 0, activeUsers = 0, suspendedUsers = 0, trialUsers = 0;
    let freeUsers = 0, proUsers = 0, enterpriseUsers = 0, totalRequests = 0;

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      totalUsers++;
      if (data.status === 'active') activeUsers++;
      else if (data.status === 'suspended') suspendedUsers++;
      else if (data.status === 'trial') trialUsers++;

      const plan = data.subscription?.plan || 'free';
      if (plan === 'free') freeUsers++;
      else if (plan === 'pro') proUsers++;
      else if (plan === 'enterprise') enterpriseUsers++;

      totalRequests += data.usage?.totalRequests || 0;
    });

    return res.status(200).json({
      success: true,
      stats: {
        users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, trial: trialUsers },
        plans: { free: freeUsers, pro: proUsers, enterprise: enterpriseUsers },
        requests: { total: totalRequests, today: 0, week: 0 },
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: error.message });
  }
}
