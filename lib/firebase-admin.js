import admin from 'firebase-admin';

let adminAuth = null;
let adminDb = null;

try {
  if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  }

  adminAuth = admin.auth();
  adminDb = admin.firestore();
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

export { adminAuth, adminDb };
