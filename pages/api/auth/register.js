// pages/api/auth/register.js
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
    const { email, password, displayName, deviceId, deviceInfo } = req.body;

    if (!email || !password || !deviceId) {
      return res.status(400).json({ 
        success: false,
        error: 'กรุณากรอกข้อมูลให้ครบถ้วน' 
      });
    }

    // Check if email already exists
    try {
      const existingUser = await adminAuth.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ 
          success: false,
          error: 'อีเมลนี้ถูกใช้งานแล้ว' 
        });
      }
    } catch (e) {
      // User not found - good
    }

    // Check if device is already registered
    const deviceQuery = await adminDb.collection('users')
      .where('deviceId', '==', deviceId)
      .get();

    if (!deviceQuery.empty) {
      return res.status(400).json({
        success: false,
        error: 'อุปกรณ์นี้ถูกลงทะเบียนกับบัญชีอื่นแล้ว'
      });
    }

    // Create user (disabled until admin approves)
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
      disabled: true
    });

    // Save to Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName: displayName || email.split('@')[0],
      deviceId,
      deviceInfo: deviceInfo || {},
      status: 'pending',
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedAt: null,
      approvedBy: null,
      lastLoginAt: null,
      loginCount: 0
    });

    return res.status(200).json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ! กรุณารอการอนุมัติจาก Admin',
      status: 'pending',
      user: {
        uid: userRecord.uid,
        email,
        displayName: displayName || email.split('@')[0]
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    
    let errorMessage = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    }

    return res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
}
