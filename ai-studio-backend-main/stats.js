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
    // Verify admin token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const adminUid = decodedToken.uid;

    // Check if user is admin
    const adminDoc = await adminDb.collection('users').doc(adminUid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all users for statistics
    const usersSnapshot = await adminDb.collection('users').get();
    
    let totalUsers = 0;
    let activeUsers = 0;
    let suspendedUsers = 0;
    let trialUsers = 0;
    let freeUsers = 0;
    let proUsers = 0;
    let enterpriseUsers = 0;
    let totalRequests = 0;
    let todayRequests = 0;
    let weekRequests = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const usersByDay = {};
    const requestsByDay = {};

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      totalUsers++;

      // Count by status
      if (data.status === 'active') activeUsers++;
      else if (data.status === 'suspended') suspendedUsers++;
      else if (data.status === 'trial') trialUsers++;

      // Count by plan
      const plan = data.subscription?.plan || 'free';
      if (plan === 'free') freeUsers++;
      else if (plan === 'pro') proUsers++;
      else if (plan === 'enterprise') enterpriseUsers++;

      // Count requests
      const userRequests = data.usage?.totalRequests || 0;
      totalRequests += userRequests;

      // Count users by creation date (last 30 days)
      if (data.createdAt) {
        const createdDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        const dateKey = createdDate.toISOString().split('T')[0];
        usersByDay[dateKey] = (usersByDay[dateKey] || 0) + 1;
      }
    });

    // Get logs for request statistics
    const logsSnapshot = await adminDb.collection('api_logs')
      .where('timestamp', '>=', weekAgo)
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();

    logsSnapshot.forEach(doc => {
      const data = doc.data();
      const logDate = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
      const dateKey = logDate.toISOString().split('T')[0];
      
      requestsByDay[dateKey] = (requestsByDay[dateKey] || 0) + 1;
      weekRequests++;
      
      if (logDate >= today) {
        todayRequests++;
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          trial: trialUsers,
        },
        plans: {
          free: freeUsers,
          pro: proUsers,
          enterprise: enterpriseUsers,
        },
        requests: {
          total: totalRequests,
          today: todayRequests,
          week: weekRequests,
        },
        charts: {
          usersByDay,
          requestsByDay,
        },
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: error.message });
  }
}
