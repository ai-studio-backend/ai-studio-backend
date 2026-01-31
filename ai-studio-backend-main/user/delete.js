// API Route: Admin - Delete user
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
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

    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Don't allow deleting yourself
    if (uid === adminUid) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete user from Firebase Auth
    await adminAuth.deleteUser(uid);

    // Delete user document from Firestore
    await adminDb.collection('users').doc(uid).delete();

    // Log the action
    await adminDb.collection('admin_logs').add({
      action: 'delete_user',
      targetUid: uid,
      adminUid: adminUid,
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: error.message });
  }
}
