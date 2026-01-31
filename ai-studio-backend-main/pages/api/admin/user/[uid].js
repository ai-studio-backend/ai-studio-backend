// API Route: Admin - Manage single user
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { uid } = req.query;

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

    // GET - Get user details
    if (req.method === 'GET') {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json({ success: true, user: userDoc.data() });
    }

    // PUT - Update user
    if (req.method === 'PUT') {
      const { status, role, subscription } = req.body;
      const updates = { updatedAt: new Date() };

      if (status) updates.status = status;
      if (role) updates.role = role;
      if (subscription) updates.subscription = subscription;

      await adminDb.collection('users').doc(uid).update(updates);
      return res.status(200).json({ success: true, message: 'User updated' });
    }

    // DELETE - Delete user
    if (req.method === 'DELETE') {
      await adminAuth.deleteUser(uid);
      await adminDb.collection('users').doc(uid).delete();
      return res.status(200).json({ success: true, message: 'User deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin user error:', error);
    return res.status(500).json({ error: error.message });
  }
}
