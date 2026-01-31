// API Route: Admin - Send notification to users
import { adminAuth, adminDb } from '../../../lib/firebase-admin';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
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

    const { title, message, targetUsers = 'all', userIds = [] } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    // Create notification document
    const notificationData = {
      title,
      message,
      targetUsers,
      userIds: targetUsers === 'specific' ? userIds : [],
      createdBy: adminUid,
      createdAt: new Date(),
      read: [],
    };

    const notificationRef = await adminDb.collection('notifications').add(notificationData);

    // If targeting specific users, add to their notification list
    if (targetUsers === 'specific' && userIds.length > 0) {
      const batch = adminDb.batch();
      for (const userId of userIds) {
        const userNotifRef = adminDb.collection('users').doc(userId).collection('notifications').doc(notificationRef.id);
        batch.set(userNotifRef, {
          notificationId: notificationRef.id,
          read: false,
          createdAt: new Date(),
        });
      }
      await batch.commit();
    }

    // Log the action
    await adminDb.collection('admin_logs').add({
      action: 'send_notification',
      details: { title, targetUsers, userCount: targetUsers === 'specific' ? userIds.length : 'all' },
      adminUid: adminUid,
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      notificationId: notificationRef.id,
    });
  } catch (error) {
    console.error('Notification error:', error);
    return res.status(500).json({ error: error.message });
  }
}
