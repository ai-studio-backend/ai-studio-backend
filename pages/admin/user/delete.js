import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    if (!adminAuth || !adminDb) return res.status(500).json({ success: false, error: 'Firebase Admin not initialized' });

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Missing authorization' });

    const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const adminDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required' });

    const { uid } = req.body || {};
    if (!uid) return res.status(400).json({ success: false, error: 'User ID required' });
    if (uid === decodedToken.uid) return res.status(400).json({ success: false, error: 'Cannot delete yourself' });

    await adminAuth.deleteUser(uid);
    await adminDb.collection('users').doc(uid).delete();

    await adminDb.collection('admin_logs').add({ action: 'delete_user', targetUid: uid, adminUid: decodedToken.uid, timestamp: new Date() });

    return res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
