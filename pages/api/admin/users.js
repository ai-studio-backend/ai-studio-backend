// pages/api/admin/users.js
// API สำหรับ Admin จัดการ Users - อนุมัติ/ปฏิเสธ/ระงับ

import { adminAuth, adminDb } from '../../../lib/firebase-admin';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verify admin token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Check if user is admin
    const adminDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // GET - List all users
    if (req.method === 'GET') {
      const { status, page = 1, limit = 50 } = req.query;
      
      let query = adminDb.collection('users').orderBy('createdAt', 'desc');
      
      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.limit(parseInt(limit)).get();
      const users = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        users.push({
          uid: doc.id,
          email: data.email,
          displayName: data.displayName,
          deviceId: data.deviceId,
          deviceInfo: data.deviceInfo,
          status: data.status,
          role: data.role,
          createdAt: data.createdAt,
          approvedAt: data.approvedAt,
          approvedBy: data.approvedBy,
          lastLoginAt: data.lastLoginAt,
          loginCount: data.loginCount
        });
      });

      // Count by status
      const pendingCount = await adminDb.collection('users').where('status', '==', 'pending').get();
      const approvedCount = await adminDb.collection('users').where('status', '==', 'approved').get();
      const rejectedCount = await adminDb.collection('users').where('status', '==', 'rejected').get();
      const suspendedCount = await adminDb.collection('users').where('status', '==', 'suspended').get();

      return res.status(200).json({
        success: true,
        users,
        stats: {
          pending: pendingCount.size,
          approved: approvedCount.size,
          rejected: rejectedCount.size,
          suspended: suspendedCount.size,
          total: pendingCount.size + approvedCount.size + rejectedCount.size + suspendedCount.size
        }
      });
    }

    // PUT - Update user status (approve/reject/suspend)
    if (req.method === 'PUT') {
      const { uid, action, reason } = req.body;

      if (!uid || !action) {
        return res.status(400).json({ error: 'Missing uid or action' });
      }

      const validActions = ['approve', 'reject', 'suspend', 'unsuspend', 'reset_device'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }

      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updateData = {
        updatedAt: new Date().toISOString()
      };

      switch (action) {
        case 'approve':
          updateData.status = 'approved';
          updateData.approvedAt = new Date().toISOString();
          updateData.approvedBy = decodedToken.uid;
          // Enable user in Firebase Auth
          await adminAuth.updateUser(uid, { disabled: false });
          break;

        case 'reject':
          updateData.status = 'rejected';
          updateData.rejectedAt = new Date().toISOString();
          updateData.rejectedBy = decodedToken.uid;
          updateData.rejectReason = reason || '';
          break;

        case 'suspend':
          updateData.status = 'suspended';
          updateData.suspendedAt = new Date().toISOString();
          updateData.suspendedBy = decodedToken.uid;
          updateData.suspendReason = reason || '';
          // Disable user in Firebase Auth
          await adminAuth.updateUser(uid, { disabled: true });
          break;

        case 'unsuspend':
          updateData.status = 'approved';
          updateData.unsuspendedAt = new Date().toISOString();
          updateData.unsuspendedBy = decodedToken.uid;
          // Enable user in Firebase Auth
          await adminAuth.updateUser(uid, { disabled: false });
          break;

        case 'reset_device':
          // Allow user to login from new device
          updateData.deviceId = null;
          updateData.activeDeviceId = null;
          updateData.deviceResetAt = new Date().toISOString();
          updateData.deviceResetBy = decodedToken.uid;
          break;
      }

      await adminDb.collection('users').doc(uid).update(updateData);

      return res.status(200).json({
        success: true,
        message: `User ${action} successfully`,
        action,
        uid
      });
    }

    // DELETE - Delete user
    if (req.method === 'DELETE') {
      const { uid } = req.body;

      if (!uid) {
        return res.status(400).json({ error: 'Missing uid' });
      }

      // Delete from Firebase Auth
      await adminAuth.deleteUser(uid);
      
      // Delete from Firestore
      await adminDb.collection('users').doc(uid).delete();

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Admin users error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}
