# 🔌 Extension Integration Guide

วิธีเชื่อมต่อ Chrome Extension กับ Backend

## 1. สร้างไฟล์ Auth Service ใน Extension

สร้างไฟล์ `src/services/auth-service.js`:

```javascript
// Auth Service for Chrome Extension
const API_BASE_URL = 'https://your-backend.vercel.app'; // เปลี่ยนเป็น URL ของคุณ

class AuthService {
  constructor() {
    this.user = null;
    this.token = null;
  }

  // Register new user
  async register(email, password, displayName) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await response.json();
      
      if (data.success) {
        await this.saveToken(data.token);
        this.user = data.user;
      }
      return data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Login
  async login(email, password) {
    try {
      // First, sign in with Firebase Client SDK
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('./firebase-client');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      
      // Verify with backend
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await response.json();
      
      if (data.success) {
        await this.saveToken(idToken);
        this.user = data.user;
        this.startPresenceUpdates();
      }
      return data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify token and check subscription
  async verify() {
    try {
      const token = await this.getToken();
      if (!token) return { valid: false, error: 'No token' };

      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Logout
  async logout() {
    try {
      const { signOut } = await import('firebase/auth');
      const { auth } = await import('./firebase-client');
      
      await this.updatePresence(false);
      await signOut(auth);
      await this.clearToken();
      this.user = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Update presence (online status)
  async updatePresence(online = true, activity = 'idle') {
    try {
      const token = await this.getToken();
      if (!token) return;

      await fetch(`${API_BASE_URL}/api/presence/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ online, device: 'extension', activity }),
      });
    } catch (error) {
      console.error('Presence update error:', error);
    }
  }

  // Start periodic presence updates
  startPresenceUpdates() {
    // Update presence every 30 seconds
    this.presenceInterval = setInterval(() => {
      this.updatePresence(true, 'active');
    }, 30000);

    // Update on visibility change
    document.addEventListener('visibilitychange', () => {
      this.updatePresence(!document.hidden, document.hidden ? 'idle' : 'active');
    });
  }

  // Stop presence updates
  stopPresenceUpdates() {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
    }
  }

  // Save token to chrome storage
  async saveToken(token) {
    this.token = token;
    await chrome.storage.local.set({ authToken: token });
  }

  // Get token from chrome storage
  async getToken() {
    if (this.token) return this.token;
    const result = await chrome.storage.local.get(['authToken']);
    this.token = result.authToken;
    return this.token;
  }

  // Clear token
  async clearToken() {
    this.token = null;
    await chrome.storage.local.remove(['authToken']);
  }
}

export const authService = new AuthService();
```

## 2. สร้าง Firebase Client สำหรับ Extension

สร้างไฟล์ `src/services/firebase-client.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

## 3. เพิ่ม Login UI ใน Extension

เพิ่มใน `sidebar.html`:

```html
<!-- Login Modal -->
<div id="loginModal" class="modal hidden">
  <div class="modal-content">
    <h2>🔐 เข้าสู่ระบบ AI Studio</h2>
    <form id="loginForm">
      <input type="email" id="loginEmail" placeholder="Email" required>
      <input type="password" id="loginPassword" placeholder="Password" required>
      <button type="submit">เข้าสู่ระบบ</button>
    </form>
    <p>ยังไม่มีบัญชี? <a href="#" id="showRegister">สมัครสมาชิก</a></p>
  </div>
</div>
```

## 4. เพิ่ม Auth Logic ใน sidebar.js

```javascript
import { authService } from './services/auth-service';

// Check auth on load
async function checkAuth() {
  const result = await authService.verify();
  
  if (!result.valid) {
    showLoginModal();
    return false;
  }
  
  // Check subscription limits
  if (result.limits) {
    updateUsageLimits(result.limits, result.usage);
  }
  
  return true;
}

// Login handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  const result = await authService.login(email, password);
  
  if (result.success) {
    hideLoginModal();
    showToast('✅ เข้าสู่ระบบสำเร็จ!');
  } else {
    showToast('❌ ' + result.error);
  }
});

// Check auth on extension load
checkAuth();
```

## 5. อัพเดท manifest.json

เพิ่ม permissions:

```json
{
  "permissions": [
    "storage",
    "identity"
  ],
  "host_permissions": [
    "https://your-backend.vercel.app/*",
    "https://identitytoolkit.googleapis.com/*",
    "https://securetoken.googleapis.com/*"
  ]
}
```

## 6. ตรวจสอบสิทธิ์ก่อนใช้งานฟีเจอร์

```javascript
async function generateVideoPrompt() {
  // Check auth first
  const auth = await authService.verify();
  if (!auth.valid) {
    showLoginModal();
    return;
  }
  
  // Check usage limits
  if (auth.limits.videos !== -1 && auth.usage.videosGenerated >= auth.limits.videos) {
    showToast('❌ คุณใช้งานครบ limit แล้ว กรุณาอัพเกรด');
    return;
  }
  
  // Continue with video generation...
}
```

## 7. Real-time Status Updates

Backend จะติดตาม user status แบบ real-time:
- 🟢 **Online** - กำลังใช้งาน extension
- 🟡 **Idle** - เปิด extension แต่ไม่ได้ใช้งาน
- 🔴 **Offline** - ปิด extension แล้ว

Admin สามารถดูสถานะทั้งหมดได้ใน Dashboard
