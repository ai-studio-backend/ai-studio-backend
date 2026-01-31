// Authentication Helper Functions
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, set, onDisconnect, serverTimestamp as rtdbTimestamp } from 'firebase/database';
import { auth, db, rtdb } from './firebase';

// Register new user
export async function registerUser(email, password, displayName) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update profile with display name
    await updateProfile(user, { displayName });

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      role: 'user', // user, admin
      status: 'active', // active, suspended, trial
      subscription: {
        plan: 'free', // free, pro, enterprise
        startDate: serverTimestamp(),
        endDate: null,
      },
      usage: {
        productsCreated: 0,
        videosGenerated: 0,
        lastActive: serverTimestamp(),
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Login user
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update last login
    await updateDoc(doc(db, 'users', user.uid), {
      'usage.lastActive': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Set up presence system
    await setupPresence(user.uid);

    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Logout user
export async function logoutUser() {
  try {
    const user = auth.currentUser;
    if (user) {
      // Update presence to offline
      await set(ref(rtdb, `presence/${user.uid}`), {
        online: false,
        lastSeen: rtdbTimestamp(),
      });
    }
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Reset password
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Setup real-time presence system
export async function setupPresence(uid) {
  const presenceRef = ref(rtdb, `presence/${uid}`);
  const connectedRef = ref(rtdb, '.info/connected');

  // Set online status
  await set(presenceRef, {
    online: true,
    lastSeen: rtdbTimestamp(),
    device: 'extension',
  });

  // Set up disconnect handler
  onDisconnect(presenceRef).set({
    online: false,
    lastSeen: rtdbTimestamp(),
  });
}

// Get user data
export async function getUserData(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() };
    }
    return { success: false, error: 'User not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Check if user has valid subscription
export async function checkSubscription(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return { valid: false, reason: 'User not found' };
    }

    const userData = userDoc.data();
    
    // Check if user is suspended
    if (userData.status === 'suspended') {
      return { valid: false, reason: 'Account suspended' };
    }

    // Check subscription
    const subscription = userData.subscription;
    if (subscription.plan === 'free') {
      return { valid: true, plan: 'free', limits: { products: 5, videos: 10 } };
    }

    if (subscription.endDate && subscription.endDate.toDate() < new Date()) {
      return { valid: false, reason: 'Subscription expired' };
    }

    return { 
      valid: true, 
      plan: subscription.plan,
      limits: subscription.plan === 'pro' 
        ? { products: 100, videos: 500 }
        : { products: -1, videos: -1 } // unlimited for enterprise
    };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}
