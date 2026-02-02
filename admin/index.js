// Admin Dashboard Page
import { useState, useEffect, useRef } from 'react';
import { auth, db, rtdb } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, online: 0, active: 0, pending: 0 });
  const [activeTab, setActiveTab] = useState('users');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [logs, setLogs] = useState([]);
  const [detailedStats, setDetailedStats] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', displayName: '', role: 'user', plan: 'free' });
  const [notification, setNotification] = useState({ title: '', message: '', targetUsers: 'all' });
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [notificationPermission, setNotificationPermission] = useState(false);
  const previousPendingCount = useRef(0);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission === 'granted');
      });
    }
  }, []);

  // Show browser notification
  const showBrowserNotification = (title, body) => {
    if (notificationPermission && 'Notification' in window) {
      const notification = new Notification(title, {
        body,
        icon: '🔔',
        tag: 'new-user',
        requireInteraction: true
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      setTimeout(() => notification.close(), 10000);
    }
  };

  // Listen for pending users in real-time
  useEffect(() => {
    if (!db || !isAdmin) return;
    
    const pendingQuery = query(collection(db, 'users'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      const pendingCount = snapshot.size;
      
      // Check if there are new pending users
      if (pendingCount > previousPendingCount.current && previousPendingCount.current > 0) {
        const newCount = pendingCount - previousPendingCount.current;
        showBrowserNotification(
          '🔔 มีผู้ใช้ใหม่รอการอนุมัติ!',
          `มี ${newCount} คนสมัครใหม่ กรุณาตรวจสอบ`
        );
        // Play sound
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQMOTJnO3LF1Fx1Coverage');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}
      }
      
      previousPendingCount.current = pendingCount;
      setStats(prev => ({ ...prev, pending: pendingCount }));
    });
    
    return () => unsubscribe();
  }, [isAdmin, notificationPermission]);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
            fetchUsers(currentUser);
            setupPresenceListener();
          }
        } catch (error) { console.error('Error checking admin status:', error); }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchUsers = async (currentUser) => {
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${idToken}` } });
      const data = await response.json();
      if (data.success) { 
        setUsers(data.users); 
        setStats(prev => ({ 
          ...prev, 
          total: data.total,
          pending: data.users.filter(u => u.status === 'pending').length
        }));
        previousPendingCount.current = data.users.filter(u => u.status === 'pending').length;
      }
    } catch (error) { console.error('Error fetching users:', error); }
  };

  const setupPresenceListener = () => {
    const presenceRef = ref(rtdb, 'presence');
    onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      setOnlineUsers(data);
      setStats(prev => ({ ...prev, online: Object.values(data).filter(p => p.online).length }));
    });
  };

  const updateUserStatus = async (uid, status) => {
    try {
      const idToken = await user.getIdToken();
      await fetch(`/api/admin/user/${uid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ status }) });
      fetchUsers(user);
      setMessage({ type: 'success', text: `User ${status === 'approved' ? 'approved' : status} successfully` });
    } catch (error) { console.error('Error updating user:', error); }
  };

  const updateUserPlan = async (uid, plan) => {
    try {
      const idToken = await user.getIdToken();
      await fetch(`/api/admin/user/${uid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ subscription: { plan, startDate: new Date(), endDate: plan === 'free' ? null : new Date(Date.now() + 30*24*60*60*1000) } }) });
      fetchUsers(user);
    } catch (error) { console.error('Error updating plan:', error); }
  };

  const deleteUser = async (uid, email) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/user/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ uid }) });
      const data = await response.json();
      if (data.success) { setMessage({ type: 'success', text: 'User deleted successfully' }); fetchUsers(user); }
      else { setMessage({ type: 'error', text: data.error }); }
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    setActionLoading(false);
  };

  const createUser = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/user/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify(newUser) });
      const data = await response.json();
      if (data.success) { setMessage({ type: 'success', text: 'User created successfully' }); setShowAddUserModal(false); setNewUser({ email: '', password: '', displayName: '', role: 'user', plan: 'free' }); fetchUsers(user); }
      else { setMessage({ type: 'error', text: data.error }); }
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    setActionLoading(false);
  };

  const fetchLogs = async () => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/logs', { headers: { Authorization: `Bearer ${idToken}` } });
      const data = await response.json();
      if (data.success) { setLogs(data.logs); }
    } catch (error) { console.error('Error fetching logs:', error); }
  };

  const fetchStats = async () => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${idToken}` } });
      const data = await response.json();
      if (data.success) { setDetailedStats(data.stats); }
    } catch (error) { console.error('Error fetching stats:', error); }
  };

  const sendNotification = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/notification', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify(notification) });
      const data = await response.json();
      if (data.success) { setMessage({ type: 'success', text: 'Notification sent successfully' }); setShowNotificationModal(false); setNotification({ title: '', message: '', targetUsers: 'all' }); }
      else { setMessage({ type: 'error', text: data.error }); }
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    setActionLoading(false);
  };

  const exportUsers = async (format = 'json') => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/export?format=${format}`, { headers: { Authorization: `Bearer ${idToken}` } });
      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'users_export.csv'; a.click();
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'users_export.json'; a.click();
      }
      setMessage({ type: 'success', text: `Exported as ${format.toUpperCase()}` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
  };

  useEffect(() => {
    if (activeTab === 'logs' && user) fetchLogs();
    if (activeTab === 'stats' && user) fetchStats();
  }, [activeTab, user]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user || !isAdmin) return;
    const interval = setInterval(() => {
      fetchUsers(user);
    }, 30000);
    return () => clearInterval(interval);
  }, [user, isAdmin]);

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-white text-xl">Loading...</div></div>;
  if (!user || !isAdmin) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-center"><h1 className="text-3xl font-bold text-white mb-4">Admin Access Required</h1><a href="/login" className="bg-purple-600 text-white px-6 py-2 rounded-lg">Login</a></div></div>;

  // Filter pending users
  const pendingUsers = users.filter(u => u.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-purple-400">AI Studio Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">{user.email}</span>
            <button onClick={() => auth.signOut()} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm">Logout</button>
          </div>
        </div>
      </header>

      {message.text && <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg z-50 ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{message.text}<button onClick={() => setMessage({ type: '', text: '' })} className="ml-4">×</button></div>}

      {/* Pending Users Alert */}
      {pendingUsers.length > 0 && (
        <div className="bg-yellow-600 px-6 py-3 flex items-center justify-between">
          <span>⏳ มี {pendingUsers.length} คนรอการอนุมัติ</span>
          <button onClick={() => setActiveTab('pending')} className="bg-yellow-700 hover:bg-yellow-800 px-4 py-1 rounded">ดูรายชื่อ</button>
        </div>
      )}

      <div className="bg-gray-800 border-b border-gray-700 px-6">
        <nav className="flex gap-4">
          {['users', 'pending', 'stats', 'logs'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-4 px-2 border-b-2 ${activeTab === tab ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400'}`}>
              {tab === 'users' && '👥 Users'}
              {tab === 'pending' && `⏳ Pending (${pendingUsers.length})`}
              {tab === 'stats' && '📊 Statistics'}
              {tab === 'logs' && '📋 Logs'}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700"><div className="text-3xl font-bold text-purple-400">{stats.total}</div><div className="text-gray-400">Total Users</div></div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700"><div className="text-3xl font-bold text-green-400">{stats.online}</div><div className="text-gray-400">Online Now</div></div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700"><div className="text-3xl font-bold text-yellow-400">{stats.pending}</div><div className="text-gray-400">Pending</div></div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700"><div className="text-3xl font-bold text-blue-400">{users.filter(u => u.subscription?.plan === 'pro').length}</div><div className="text-gray-400">Pro Users</div></div>
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700"><div className="text-3xl font-bold text-pink-400">{users.filter(u => u.status === 'active' || u.status === 'approved').length}</div><div className="text-gray-400">Active Users</div></div>
        </div>

        <div className="flex gap-4 mb-6">
          <button onClick={() => setShowAddUserModal(true)} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg">➕ Add User</button>
          <button onClick={() => setShowNotificationModal(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">🔔 Send Notification</button>
          <button onClick={() => exportUsers('csv')} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg">📥 Export CSV</button>
          <button onClick={() => exportUsers('json')} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg">📥 Export JSON</button>
          <button onClick={() => fetchUsers(user)} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg">🔄 Refresh</button>
        </div>

        {/* Pending Users Tab */}
        {activeTab === 'pending' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700"><h2 className="text-xl font-semibold">⏳ Pending Approval ({pendingUsers.length})</h2></div>
            <table className="w-full">
              <thead className="bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs text-gray-300">User</th><th className="px-6 py-3 text-left text-xs text-gray-300">Device ID</th><th className="px-6 py-3 text-left text-xs text-gray-300">Registered</th><th className="px-6 py-3 text-left text-xs text-gray-300">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-700">
                {pendingUsers.map((u) => (
                  <tr key={u.uid}>
                    <td className="px-6 py-4"><div className="font-medium">{u.displayName || '-'}</div><div className="text-sm text-gray-400">{u.email}</div></td>
                    <td className="px-6 py-4"><span className="text-xs text-gray-400 font-mono">{u.deviceId?.substring(0, 16) || '-'}...</span></td>
                    <td className="px-6 py-4 text-sm text-gray-400">{u.createdAt ? new Date(u.createdAt).toLocaleString('th-TH') : '-'}</td>
                    <td className="px-6 py-4 flex gap-2">
                      <button onClick={() => updateUserStatus(u.uid, 'approved')} className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm">✓ Approve</button>
                      <button onClick={() => updateUserStatus(u.uid, 'rejected')} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm">✗ Reject</button>
                    </td>
                  </tr>
                ))}
                {pendingUsers.length === 0 && <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No pending users</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700"><h2 className="text-xl font-semibold">👥 User Management</h2></div>
            <table className="w-full">
              <thead className="bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs text-gray-300">User</th><th className="px-6 py-3 text-left text-xs text-gray-300">Status</th><th className="px-6 py-3 text-left text-xs text-gray-300">Plan</th><th className="px-6 py-3 text-left text-xs text-gray-300">Online</th><th className="px-6 py-3 text-left text-xs text-gray-300">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-700">
                {users.filter(u => u.status !== 'pending').map((u) => (
                  <tr key={u.uid}>
                    <td className="px-6 py-4"><div className="font-medium">{u.displayName}</div><div className="text-sm text-gray-400">{u.email}</div></td>
                    <td className="px-6 py-4"><select value={u.status} onChange={(e) => updateUserStatus(u.uid, e.target.value)} className="bg-gray-700 rounded px-2 py-1 text-xs"><option value="active">Active</option><option value="approved">Approved</option><option value="suspended">Suspended</option><option value="trial">Trial</option></select></td>
                    <td className="px-6 py-4"><select value={u.subscription?.plan || 'free'} onChange={(e) => updateUserPlan(u.uid, e.target.value)} className="bg-gray-700 rounded px-2 py-1 text-xs"><option value="free">Free</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select></td>
                    <td className="px-6 py-4"><span className={onlineUsers[u.uid]?.online ? 'text-green-400' : 'text-gray-500'}>{onlineUsers[u.uid]?.online ? '🟢 Online' : '⚫ Offline'}</span></td>
                    <td className="px-6 py-4"><button onClick={() => deleteUser(u.uid, u.email)} className="text-red-400 hover:text-red-300">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'stats' && detailedStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6"><h3 className="text-lg font-semibold mb-4">📊 User Statistics</h3><div className="space-y-3"><div className="flex justify-between"><span className="text-gray-400">Total</span><span>{detailedStats.users.total}</span></div><div className="flex justify-between"><span className="text-gray-400">Active</span><span className="text-green-400">{detailedStats.users.active}</span></div><div className="flex justify-between"><span className="text-gray-400">Suspended</span><span className="text-red-400">{detailedStats.users.suspended}</span></div></div></div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6"><h3 className="text-lg font-semibold mb-4">💎 Plan Distribution</h3><div className="space-y-3"><div className="flex justify-between"><span className="text-gray-400">Free</span><span>{detailedStats.plans.free}</span></div><div className="flex justify-between"><span className="text-gray-400">Pro</span><span className="text-purple-400">{detailedStats.plans.pro}</span></div><div className="flex justify-between"><span className="text-gray-400">Enterprise</span><span className="text-blue-400">{detailedStats.plans.enterprise}</span></div></div></div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700"><h2 className="text-xl font-semibold">📋 Admin Logs</h2></div>
            <table className="w-full"><thead className="bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs text-gray-300">Action</th><th className="px-6 py-3 text-left text-xs text-gray-300">Target</th><th className="px-6 py-3 text-left text-xs text-gray-300">Time</th></tr></thead>
              <tbody className="divide-y divide-gray-700">{logs.map((log) => (<tr key={log.id}><td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs ${log.action === 'delete_user' ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>{log.action}</span></td><td className="px-6 py-4 text-gray-400">{log.targetEmail || log.targetUid || '-'}</td><td className="px-6 py-4 text-gray-400">{log.timestamp ? new Date(log.timestamp).toLocaleString('th-TH') : '-'}</td></tr>))}{logs.length === 0 && <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-500">No logs found</td></tr>}</tbody>
            </table>
          </div>
        )}
      </div>

      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-semibold mb-4">➕ Add New User</h3>
            <form onSubmit={createUser} className="space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1">Email</label><input type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" required /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Password</label><input type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" required /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Display Name</label><input type="text" value={newUser.displayName} onChange={(e) => setNewUser({...newUser, displayName: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">Role</label><select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"><option value="user">User</option><option value="admin">Admin</option></select></div>
                <div><label className="block text-sm text-gray-400 mb-1">Plan</label><select value={newUser.plan} onChange={(e) => setNewUser({...newUser, plan: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"><option value="free">Free</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select></div>
              </div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowAddUserModal(false)} className="flex-1 bg-gray-700 py-2 rounded-lg">Cancel</button><button type="submit" disabled={actionLoading} className="flex-1 bg-purple-600 py-2 rounded-lg disabled:opacity-50">{actionLoading ? 'Creating...' : 'Create'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showNotificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-semibold mb-4">🔔 Send Notification</h3>
            <form onSubmit={sendNotification} className="space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1">Title</label><input type="text" value={notification.title} onChange={(e) => setNotification({...notification, title: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2" required /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Message</label><textarea value={notification.message} onChange={(e) => setNotification({...notification, message: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 h-24" required /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Target</label><select value={notification.targetUsers} onChange={(e) => setNotification({...notification, targetUsers: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"><option value="all">All Users</option><option value="active">Active Only</option><option value="pro">Pro Only</option></select></div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowNotificationModal(false)} className="flex-1 bg-gray-700 py-2 rounded-lg">Cancel</button><button type="submit" disabled={actionLoading} className="flex-1 bg-blue-600 py-2 rounded-lg disabled:opacity-50">{actionLoading ? 'Sending...' : 'Send'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
