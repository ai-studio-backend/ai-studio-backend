// API Route: Verify user token and check subscription
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get user data
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ valid: false, error: 'User not found' });
    }

    const userData = userDoc.data();

    // Check status
    if (userData.status === 'suspended') {
      return res.status(403).json({ valid: false, error: 'Account suspended' });
    }

    // Check subscription
    const subscription = userData.subscription;
    let limits = { products: 5, videos: 10 }; // Free tier limits

    if (subscription.plan === 'pro') {
      limits = { products: 100, videos: 500 };
    } else if (subscription.plan === 'enterprise') {
      limits = { products: -1, videos: -1 }; // Unlimited
    }

    // Check if subscription expired
    if (subscription.endDate && new Date(subscription.endDate.toDate()) < new Date()) {
      return res.status(200).json({
        valid: true,
        expired: true,
        user: {
          uid: userData.uid,
          email: userData.email,
          displayName: userData.displayName,
          role: userData.role,
        },
        subscription: {
          plan: 'free',
          expired: true,
        },
        limits: { products: 5, videos: 10 },
      });
    }

    return res.status(200).json({
      valid: true,
      user: {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
      },
      subscription: {
        plan: subscription.plan,
        endDate: subscription.endDate,
      },
      limits,
      usage: userData.usage,
    });
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(401).json({ valid: false, error: error.message });
  }
}
