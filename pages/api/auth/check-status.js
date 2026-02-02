// pages/api/auth/check-status.js
// API สำหรับตรวจสอบ status และ Device ID ของ user

import { adminAuth, adminDb } from '../../../lib/firebase-admin';

export default async function handler(req, res) {
  // Set CORS headers
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
    // Get Authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify Firebase token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const uid = decodedToken.uid;
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }

    // Get user data from Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        error: 'ไม่พบข้อมูลผู้ใช้',
        status: 'not_found'
      });
    }

    const userData = userDoc.data();

    // Check user status
    if (userData.status === 'pending') {
      return res.status(200).json({
        status: 'pending',
        message: 'บัญชีของคุณยังรอการอนุมัติจาก Admin'
      });
    }

    if (userData.status === 'rejected') {
      return res.status(200).json({
        status: 'rejected',
        message: 'บัญชีของคุณถูกปฏิเสธ'
      });
    }

    if (userData.status === 'suspended') {
      return res.status(200).json({
        status: 'suspended',
        message: 'บัญชีของคุณถูกระงับการใช้งาน'
      });
    }

    // Check if status is approved or active
    if (userData.status !== 'approved' && userData.status !== 'active') {
      return res.status(200).json({
        status: userData.status || 'unknown',
        message: 'บัญชีของคุณยังไม่ได้รับการอนุมัติ'
      });
    }

    // Check Device ID - 1 account = 1 device
    if (userData.deviceId && userData.deviceId !== deviceId) {
      return res.status(200).json({
        status: 'device_mismatch',
        message: 'บัญชีนี้ถูกลงทะเบียนกับอุปกรณ์อื่น',
        registeredDevice: userData.deviceId?.substring(0, 10) + '...'
      });
    }

    // If no device ID set yet, lock to this device (first login after approval)
    if (!userData.deviceId) {
      await adminDb.collection('users').doc(uid).update({
        deviceId: deviceId,
        deviceLockedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        loginCount: (userData.loginCount || 0) + 1
      });
    } else {
      // Update last login
      await adminDb.collection('users').doc(uid).update({
        lastLoginAt: new Date().toISOString(),
        loginCount: (userData.loginCount || 0) + 1
      });
    }

    // Success - return user info
    return res.status(200).json({
      status: userData.status,
      displayName: userData.displayName,
      email: userData.email,
      role: userData.role || 'user',
      deviceLocked: true
    });

  } catch (error) {
    console.error('Check status error:', error);
    
    return res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการตรวจสอบสถานะ'
    });
  }
}
