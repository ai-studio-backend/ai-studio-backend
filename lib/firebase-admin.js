// lib/firebase-admin.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
    console.log('Firebase Admin initialized');
  } catch (error) {
    console.error('Firebase Admin init error:', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminRtdb = admin.database();

export default admin;
