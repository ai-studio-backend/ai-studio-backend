// lib/firebase-admin.js
import admin from 'firebase-admin';

let adminAuth = null;
let adminDb = null;
let adminRtdb = null;

function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials');
    return null;
  }

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin initialized successfully');
    return app;
  } catch (error) {
    console.error('Firebase Admin init error:', error.message);
    return null;
  }
}

const app = initializeFirebase();

if (app) {
  adminAuth = admin.auth();
  adminDb = admin.firestore();
  try {
    adminRtdb = admin.database();
  } catch (e) {
    console.log('Realtime Database not configured');
  }
}

export { adminAuth, adminDb, adminRtdb };
export default admin;
