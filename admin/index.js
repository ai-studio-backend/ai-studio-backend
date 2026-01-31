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
  const [activeTab, setActiveTab] = useState('users');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [logs, setLogs] = useState([]);
  const [detailedStats, setDetailedStats] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', displayName: '', role: 'user', plan: 'free' });
  const [notification, setNotification] = useState({ title: '', message: '', targetUsers: 'all' });
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

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

  const deleteUser = async (uid, email) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/user/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'User deleted successfully' });
        fetchUsers(user);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setActionLoading(false);
  };

  const createUser = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/user/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(newUser),
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'User created successfully' });
        setShowAddUserModal(false);
        setNewUser({ email: '', password: '', displayName: '', role: 'user', plan: 'free' });
        fetchUsers(user);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setActionLoading(false);
  };

  const fetchLogs = async () => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/logs', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setDetailedStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const sendNotification = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(notification),
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Notification sent successfully' });
        setShowNotificationModal(false);
        setNotification({ title: '', message: '', targetUsers: 'all' });
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setActionLoading(false);
  };

  const exportUsers = async (format = 'json') => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/export?format=${format}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      
      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'users_export.csv';
        a.click();
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'users_export.json';
        a.click();
      }
      setMessage({ type: 'success', text: `Exported as ${format.toUpperCase()}` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && user) fetchLogs();
    if (activeTab === 'stats' && user) fetchStats();
  }, [activeTab, user]);

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

      {/* Message Toast */}
      {message.text && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg z-50 ${
          message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-4">×</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700 px-6">
        <nav className="flex gap-4">
          {['users', 'stats', 'logs'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === tab 
                  ? 'border-purple-500 text-purple-400' 
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'users' && '👥 Users'}
              {tab === 'stats' && '📊 Statistics'}
              {tab === 'logs' && '📋 Logs'}
            </button>
          ))}
        </nav>
      </div>

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

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setShowAddUserModal(true)}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2"
          >
            ➕ Add User
          </button>
          <button
            onClick={() => setShowNotificationModal(true)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2"
          >
            🔔 Send Notification
          </button>
          <button
            onClick={() => exportUsers('csv')}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2"
          >
            📥 Export CSV
          </button>
          <button
            onClick={() => exportUsers('json')}
            className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg flex items-center gap-2"
          >
            📥 Export JSON
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
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
                        <button 
                          onClick={() => deleteUser(u.uid, u.email)}
                          disabled={actionLoading}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && detailedStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">📊 User Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Users</span>
                  <span className="font-bold">{detailedStats.users.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Active Users</span>
                  <span className="font-bold text-green-400">{detailedStats.users.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Suspended Users</span>
                  <span className="font-bold text-red-400">{detailedStats.users.suspended}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Trial Users</span>
                  <span className="font-bold text-yellow-400">{detailedStats.users.trial}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h3 className="text-lg font-semibold mb-4">💎 Plan Distribution</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Free Plan</span>
                  <span className="font-bold">{detailedStats.plans.free}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Pro Plan</span>
                  <span className="font-bold text-purple-400">{detailedStats.plans.pro}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Enterprise Plan</span>
                  <span className="font-bold text-blue-400">{detailedStats.plans.enterprise}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 md:col-span-2">
              <h3 className="text-lg font-semibold mb-4">📈 API Requests</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{detailedStats.requests.total}</div>
                  <div className="text-gray-400 text-sm">Total Requests</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{detailedStats.requests.today}</div>
                  <div className="text-gray-400 text-sm">Today</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{detailedStats.requests.week}</div>
                  <div className="text-gray-400 text-sm">This Week</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold">📋 Admin Activity Logs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Target</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Admin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          log.action === 'delete_user' ? 'bg-red-900 text-red-300' :
                          log.action === 'create_user' ? 'bg-green-900 text-green-300' :
                          log.action === 'send_notification' ? 'bg-blue-900 text-blue-300' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {log.targetEmail || log.targetUid || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {log.adminUid?.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('th-TH') : '-'}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                        No logs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-semibold mb-4">➕ Add New User</h3>
            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Plan</label>
                  <select
                    value={newUser.plan}
                    onChange={(e) => setNewUser({...newUser, plan: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 py-2 rounded-lg disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-semibold mb-4">🔔 Send Notification</h3>
            <form onSubmit={sendNotification} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={notification.title}
                  onChange={(e) => setNotification({...notification, title: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Message</label>
                <textarea
                  value={notification.message}
                  onChange={(e) => setNotification({...notification, message: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white h-24"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Users</label>
                <select
                  value={notification.targetUsers}
                  onChange={(e) => setNotification({...notification, targetUsers: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="all">All Users</option>
                  <option value="active">Active Users Only</option>
                  <option value="pro">Pro Users Only</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNotificationModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg disabled:opacity-50"
                >
                  {actionLoading ? 'Sending...' : 'Send Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
