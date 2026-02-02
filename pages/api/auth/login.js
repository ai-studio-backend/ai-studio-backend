// pages/api/auth/login.js
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
    const { email, password, deviceId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'กรุณากรอกอีเมลและรหัสผ่าน' 
      });
    }

    // Verify with Firebase Auth REST API
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
    const authResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true
        })
      }
    );

    const authData = await authResponse.json();

    if (!authResponse.ok || authData.error) {
      const errorCode = authData.error?.message;
      let errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      
      if (errorCode === 'USER_DISABLED') {
        // Check user status in Firestore
        const userQuery = await adminDb.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();

        if (!userQuery.empty) {
          const userData = userQuery.docs[0].data();
          if (userData.status === 'pending') {
            return res.status(403).json({
              success: false,
              status: 'pending',
              error: 'บัญชีของคุณกำลังรอการอนุมัติจาก Admin'
            });
          } else if (userData.status === 'rejected') {
            return res.status(403).json({
              success: false,
              status: 'rejected',
              error: 'บัญชีของคุณถูกปฏิเสธ'
            });
          } else if (userData.status === 'suspended') {
            return res.status(403).json({
              success: false,
              status: 'suspended',
              error: 'บัญชีของคุณถูกระงับ'
            });
          }
        }
        errorMessage = 'บัญชีถูกระงับการใช้งาน';
      }

      return res.status(401).json({ 
        success: false,
        error: errorMessage 
      });
    }

    // Get user data from Firestore
    const userDoc = await adminDb.collection('users').doc(authData.localId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลผู้ใช้'
      });
    }

    const userData = userDoc.data();

    // Check user status
    if (userData.status !== 'approved') {
      return res.status(403).json({
        success: false,
        status: userData.status,
        error: userData.status === 'pending' 
          ? 'บัญชีของคุณกำลังรอการอนุมัติจาก Admin'
          : 'บัญชีของคุณถูกระงับ'
      });
    }

    // Check device ID (if provided)
    if (deviceId && userData.deviceId && userData.deviceId !== deviceId) {
      return res.status(403).json({
        success: false,
        status: 'device_mismatch',
        error: 'บัญชีนี้ถูกลงทะเบียนกับอุปกรณ์อื่น'
      });
    }

    // Update last login
    await adminDb.collection('users').doc(authData.localId).update({
      lastLoginAt: new Date().toISOString(),
      loginCount: (userData.loginCount || 0) + 1
    });

    return res.status(200).json({
      success: true,
      user: {
        uid: authData.localId,
        email: authData.email,
        displayName: userData.displayName,
        status: userData.status
      },
      token: authData.idToken,
      refreshToken: authData.refreshToken,
      expiresIn: authData.expiresIn
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง' 
    });
  }
}
