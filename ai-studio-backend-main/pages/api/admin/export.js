// API Route: Admin - Export users data
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

    const { format = 'json' } = req.query;
    const usersSnapshot = await adminDb.collection('users').get();

    const users = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        status: data.status,
        plan: data.subscription?.plan || 'free',
        totalRequests: data.usage?.totalRequests || 0,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
      });
    });

    await adminDb.collection('admin_logs').add({
      action: 'export_users',
      details: { format, userCount: users.length },
      adminUid: adminUid,
      timestamp: new Date(),
    });

    if (format === 'csv') {
      const headers = ['UID', 'Email', 'Display Name', 'Role', 'Status', 'Plan', 'Total Requests', 'Created At'];
      const csvRows = [headers.join(',')];
      users.forEach(user => {
        const row = [user.uid, user.email, user.displayName || '', user.role, user.status, user.plan, user.totalRequests, user.createdAt ? new Date(user.createdAt).toISOString() : ''];
        csvRows.push(row.map(val => `"${val}"`).join(','));
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
      return res.status(200).send(csvRows.join('\n'));
    }

    return res.status(200).json({ success: true, users, total: users.length });
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: error.message });
  }
}
