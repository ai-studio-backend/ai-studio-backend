# 🤖 AI Studio Backend

Backend สำหรับ AI Studio Chrome Extension พร้อมระบบ Authentication และ Real-time User Status

## 🔥 Tech Stack

- **Framework:** Next.js 14
- **Authentication:** Firebase Auth (Email/Password)
- **Database:** Firebase Firestore
- **Real-time:** Firebase Realtime Database
- **Hosting:** Firebase Hosting / Vercel
- **Styling:** TailwindCSS

## 📁 Project Structure

```
ai-studio-backend/
├── lib/
│   ├── firebase.js          # Firebase Client SDK
│   ├── firebase-admin.js    # Firebase Admin SDK
│   └── auth.js              # Auth helper functions
├── pages/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register.js  # Register new user
│   │   │   ├── login.js     # Login user
│   │   │   └── verify.js    # Verify token & subscription
│   │   ├── admin/
│   │   │   ├── users.js     # Get all users
│   │   │   └── user/[uid].js # Manage single user
│   │   └── presence/
│   │       └── update.js    # Update user presence
│   ├── admin/
│   │   └── index.js         # Admin Dashboard
│   ├── login.js             # Login page
│   └── index.js             # Landing page
├── styles/
│   └── globals.css          # Global styles
└── .env.example             # Environment variables template
```

## 🚀 Setup Instructions

### 1. Create Firebase Project

1. ไปที่ [Firebase Console](https://console.firebase.google.com/)
2. สร้าง Project ใหม่
3. เปิดใช้งาน:
   - **Authentication** → Email/Password
   - **Firestore Database**
   - **Realtime Database**

### 2. Get Firebase Config

1. ไปที่ Project Settings → General
2. เลื่อนลงไปที่ "Your apps" → Add Web App
3. Copy Firebase config

### 3. Get Firebase Admin SDK

1. ไปที่ Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download JSON file

### 4. Setup Environment Variables

```bash
cp .env.example .env.local
```

แก้ไข `.env.local` ด้วยค่าจาก Firebase:

```env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
...

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run Development Server

```bash
npm run dev
```

เปิด http://localhost:3000

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/verify` | Verify token & check subscription |

### Admin (Requires Admin Role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | Get all users |
| GET | `/api/admin/user/[uid]` | Get user details |
| PUT | `/api/admin/user/[uid]` | Update user |
| DELETE | `/api/admin/user/[uid]` | Delete user |

### Presence

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/presence/update` | Update user online status |

## 🔐 User Roles & Permissions

| Role | Permissions |
|------|-------------|
| `user` | Use extension, view own data |
| `admin` | All user permissions + Admin Dashboard |

## 💳 Subscription Plans

| Plan | Products | Videos | Price |
|------|----------|--------|-------|
| Free | 5 | 10 | ฟรี |
| Pro | 100 | 500 | 299฿/เดือน |
| Enterprise | Unlimited | Unlimited | ติดต่อ |

## 🚀 Deploy to Vercel

1. Push code to GitHub
2. ไปที่ [Vercel](https://vercel.com)
3. Import project from GitHub
4. Add Environment Variables
5. Deploy!

## 📱 Connect with Chrome Extension

ดู `extension-integration.md` สำหรับวิธีเชื่อมต่อ Extension กับ Backend

## 📞 Support

หากมีปัญหาหรือคำถาม ติดต่อได้ที่ support@aistudio.com
