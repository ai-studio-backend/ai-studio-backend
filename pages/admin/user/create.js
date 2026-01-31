import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    if (!adminAuth || !adminDb) return res.status(500).json({ success: false, error: 'Firebase Admin not initialized' });

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Missing authorization' });

    const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const adminDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') return res.status(403).json({ success: false, error: 'Admin access required' });

    const { email, password, displayName, role = 'user', plan = 'free' } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });

    const userRecord = await adminAuth.createUser({ email, password, displayName: displayName || email.split('@')[0] });

    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid, email, displayName: displayName || email.split('@')[0], role, status: 'active',
      subscription: { plan, startDate: new Date(), endDate: plan === 'free' ? null : new Date(Date.now() + 30*24*60*60*1000) },
      usage: { totalRequests: 0 }, createdAt: new Date(), createdBy: decodedToken.uid,
    });

    await adminDb.collection('admin_logs').add({ action: 'create_user', targetUid: userRecord.uid, targetEmail: email, adminUid: decodedToken.uid, timestamp: new Date() });

    return res.status(200).json({ success: true, user: { uid: userRecord.uid, email } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
