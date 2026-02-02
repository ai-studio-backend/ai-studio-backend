// pages/api/admin/login.js
// API สำหรับ Admin เข้าสู่ระบบ Dashboard

import { adminAuth, adminDb } from '../../../lib/firebase-admin';

export default async function handler(req, res) {
  // CORS headers
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'กรุณากรอกอีเมลและรหัสผ่าน' 
      });
    }

    // ใช้ Firebase Auth REST API เพื่อ verify credentials
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
      return res.status(401).json({ 
        success: false, 
        error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' 
      });
    }

    // ตรวจสอบว่าเป็น Admin หรือไม่ (จาก Firestore)
    const userDoc = await adminDb.collection('users').doc(authData.localId).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'คุณไม่มีสิทธิ์เข้าถึง Admin Dashboard' 
      });
    }

    // Log admin login
    console.log(`[Admin Login] ${email} logged in at ${new Date().toISOString()}`);

    return res.status(200).json({
      success: true,
      token: authData.idToken,
      email: email,
      expiresIn: authData.expiresIn
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง' 
    });
  }
}
