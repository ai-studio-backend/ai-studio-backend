// pages/api/admin/users.js
import { adminAuth, adminDb } from '../../../lib/firebase-admin';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify admin token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Check if user is admin
    const adminDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // GET - List all users
    if (req.method === 'GET') {
      const usersSnapshot = await adminDb.collection('users')
        .orderBy('createdAt', 'desc')
        .get();

      const users = [];
      let stats = { pending: 0, approved: 0, rejected: 0, suspended: 0, total: 0 };

      usersSnapshot.forEach(doc => {
        const data = doc.data();
        users.push(data);
        stats.total++;
        if (stats[data.status] !== undefined) {
          stats[data.status]++;
        }
      });

      return res.status(200).json({ users, stats });
    }

    // PUT - Update user status
    if (req.method === 'PUT') {
      const { uid, action } = req.body;

      if (!uid || !action) {
        return res.status(400).json({ error: 'Missing uid or action' });
      }

      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }

      let updateData = { updatedAt: new Date().toISOString() };

      switch (action) {
        case 'approve':
          updateData.status = 'approved';
          updateData.approvedAt = new Date().toISOString();
          updateData.approvedBy = decodedToken.uid;
          await adminAuth.updateUser(uid, { disabled: false });
          break;

        case 'reject':
          updateData.status = 'rejected';
          break;

        case 'suspend':
          updateData.status = 'suspended';
          await adminAuth.updateUser(uid, { disabled: true });
          break;

        case 'unsuspend':
          updateData.status = 'approved';
          await adminAuth.updateUser(uid, { disabled: false });
          break;

        case 'reset_device':
          updateData.deviceId = null;
          updateData.deviceInfo = null;
          break;

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }

      await userRef.update(updateData);

      return res.status(200).json({ 
        success: true, 
        message: `User ${action} successfully` 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
