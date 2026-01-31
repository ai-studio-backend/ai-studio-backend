// Admin Dashboard Page
import { useState, useEffect } from 'react';
import { auth, db, rtdb } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, online: 0, active: 0 });

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Check if admin
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
            fetchUsers(currentUser);
            setupPresenceListener();
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchUsers = async (currentUser) => {
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
        setStats(prev => ({ ...prev, total: data.total }));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const setupPresenceListener = () => {
    const presenceRef = ref(rtdb, 'presence');
    onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      setOnlineUsers(data);
      const onlineCount = Object.values(data).filter(p => p.online).length;
      setStats(prev => ({ ...prev, online: onlineCount }));
    });
  };

  const updateUserStatus = async (uid, status) => {
    try {
      const idToken = await user.getIdToken();
      await fetch(`/api/admin/user/${uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ status }),
      });
      fetchUsers(user);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const updateUserPlan = async (uid, plan) => {
    try {
      const idToken = await user.getIdToken();
      await fetch(`/api/admin/user/${uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ 
          subscription: { 
            plan,
            startDate: new Date(),
            endDate: plan === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          } 
        }),
      });
      fetchUsers(user);
    } catch (error) {
      console.error('Error updating plan:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">🔒 Admin Access Required</h1>
          <p className="text-gray-400">Please login with an admin account.</p>
          <a href="/login" className="mt-4 inline-block bg-purple-600 text-white px-6 py-2 rounded-lg">
            Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            🎛️ AI Studio Admin Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">{user.email}</span>
            <button 
              onClick={() => auth.signOut()}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-3xl font-bold text-purple-400">{stats.total}</div>
            <div className="text-gray-400">Total Users</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-3xl font-bold text-green-400">{stats.online}</div>
            <div className="text-gray-400">Online Now</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-3xl font-bold text-blue-400">
              {users.filter(u => u.subscription?.plan === 'pro').length}
            </div>
            <div className="text-gray-400">Pro Users</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="text-3xl font-bold text-pink-400">
              {users.filter(u => u.status === 'active').length}
            </div>
            <div className="text-gray-400">Active Users</div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold">👥 User Management</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Online</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Last Active</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-gray-750">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {u.displayName?.charAt(0) || u.email?.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="font-medium">{u.displayName}</div>
                          <div className="text-sm text-gray-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.status}
                        onChange={(e) => updateUserStatus(u.uid, e.target.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium bg-gray-700 border-0 ${
                          u.status === 'active' ? 'text-green-400' : 
                          u.status === 'suspended' ? 'text-red-400' : 'text-yellow-400'
                        }`}
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="trial">Trial</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.subscription?.plan || 'free'}
                        onChange={(e) => updateUserPlan(u.uid, e.target.value)}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 border-0 text-purple-400"
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-2 ${
                        onlineUsers[u.uid]?.online ? 'text-green-400' : 'text-gray-500'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          onlineUsers[u.uid]?.online ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                        }`}></span>
                        {onlineUsers[u.uid]?.online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {u.lastActive ? new Date(u.lastActive).toLocaleString('th-TH') : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-blue-400 hover:text-blue-300 mr-3">View</button>
                      <button className="text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
