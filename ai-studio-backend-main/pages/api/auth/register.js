// API Route: Register new user
import { adminAuth, adminDb } from '../../../lib/firebase-admin';

export default async function handler(req, res) {
  // Enable CORS
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
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    });

    // Create user document in Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: displayName,
      role: 'user',
      status: 'active',
      subscription: {
        plan: 'free',
        startDate: new Date(),
        endDate: null,
      },
      usage: {
        productsCreated: 0,
        videosGenerated: 0,
        lastActive: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate custom token for auto-login
    const customToken = await adminAuth.createCustomToken(userRecord.uid);

    return res.status(201).json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: displayName,
      },
      token: customToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
}
