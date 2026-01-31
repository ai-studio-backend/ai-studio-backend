// API Route: Admin - Get admin logs
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

    const { type = 'all', limit: queryLimit = 50 } = req.query;

    // Get admin logs
    let logsQuery = adminDb.collection('admin_logs')
      .orderBy('timestamp', 'desc')
      .limit(parseInt(queryLimit));

    if (type !== 'all') {
      logsQuery = adminDb.collection('admin_logs')
        .where('action', '==', type)
        .orderBy('timestamp', 'desc')
        .limit(parseInt(queryLimit));
    }

    const logsSnapshot = await logsQuery.get();

    const logs = [];
    logsSnapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        action: data.action,
        targetUid: data.targetUid,
        targetEmail: data.targetEmail,
        adminUid: data.adminUid,
        details: data.details,
        timestamp: data.timestamp?.toDate(),
      });
    });

    return res.status(200).json({
      success: true,
      logs,
      total: logs.length,
    });
  } catch (error) {
    console.error('Logs error:', error);
    return res.status(500).json({ error: error.message });
  }
}
