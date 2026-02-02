/**
 * 👑 AI Studio Admin Panel
 * หน้า Dashboard สำหรับจัดการ Users
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';

// Firebase Config
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDpnheopanPA8ooR1KmmHILeNBPcf4TQy4",
    projectId: "aistudio-82647"
};

const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
const ADMIN_EMAIL = 'moosub@gmail.com';

export default function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Stats
    const stats = {
        total: users.length,
        pending: users.filter(u => u.status === 'pending').length,
        approved: users.filter(u => u.status === 'approved').length,
        rejected: users.filter(u => u.status === 'rejected').length,
    };

    // Check auth on mount
    useEffect(() => {
        const savedAuth = localStorage.getItem('adminAuth');
        if (savedAuth === 'true') {
            setIsAuthenticated(true);
            loadUsers();
        } else {
            setLoading(false);
        }
    }, []);

    // Admin Login
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');

        if (adminEmail.toLowerCase() !== ADMIN_EMAIL) {
            setLoginError('คุณไม่มีสิทธิ์เข้าถึง Admin Panel');
            return;
        }

        try {
            const response = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: adminEmail, password: adminPassword, returnSecureToken: true })
                }
            );
            const data = await response.json();

            if (data.error) {
                setLoginError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
                return;
            }

            localStorage.setItem('adminAuth', 'true');
            setIsAuthenticated(true);
            loadUsers();
        } catch (error) {
            setLoginError('เกิดข้อผิดพลาด กรุณาลองใหม่');
        }
    };

    // Logout
    const handleLogout = () => {
        localStorage.removeItem('adminAuth');
        setIsAuthenticated(false);
    };

    // Load Users from Firestore
    const loadUsers = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${FIRESTORE_URL}/users?key=${FIREBASE_CONFIG.apiKey}`);
            const data = await response.json();

            if (data.documents) {
                const parsedUsers = data.documents.map(doc => ({
                    email: doc.fields?.email?.stringValue || '',
                    displayName: doc.fields?.displayName?.stringValue || '',
                    deviceId: doc.fields?.deviceId?.stringValue || '',
                    status: doc.fields?.status?.stringValue || 'pending',
                    createdAt: doc.fields?.createdAt?.timestampValue || '',
                }));
                setUsers(parsedUsers);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showToast('ไม่สามารถโหลดข้อมูลได้', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Update User Status
    const updateUserStatus = async (email, status) => {
        try {
            const docId = email.replace(/[.@]/g, '_');
            await fetch(
                `${FIRESTORE_URL}/users/${docId}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt&key=${FIREBASE_CONFIG.apiKey}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fields: {
                            status: { stringValue: status },
                            updatedAt: { timestampValue: new Date().toISOString() }
                        }
                    })
                }
            );
            showToast(`${status === 'approved' ? '✅ อนุมัติ' : '❌ ปฏิเสธ'} ${email} แล้ว`, 'success');
            loadUsers();
        } catch (error) {
            showToast('เกิดข้อผิดพลาด', 'error');
        }
    };

    // Delete User
    const deleteUser = async (email) => {
        if (!confirm(`ลบผู้ใช้ ${email}?`)) return;

        try {
            const docId = email.replace(/[.@]/g, '_');
            await fetch(`${FIRESTORE_URL}/users/${docId}?key=${FIREBASE_CONFIG.apiKey}`, { method: 'DELETE' });
            showToast(`🗑️ ลบ ${email} แล้ว`, 'success');
            loadUsers();
        } catch (error) {
            showToast('เกิดข้อผิดพลาด', 'error');
        }
    };

    // Toast
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    // Filter users
    const filteredUsers = filter === 'all' ? users : users.filter(u => u.status === filter);

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // Login Screen
    if (!isAuthenticated) {
        return (
            <>
                <Head>
                    <title>Admin Login - AI Studio</title>
                    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
                </Head>
                <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                        <div className="text-center mb-8">
                            <div className="text-5xl mb-4">👑</div>
                            <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
                            <p className="text-gray-500 mt-2">AI Studio User Management</p>
                        </div>

                        {loginError && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
                                ⚠️ {loginError}
                            </div>
                        )}

                        <form onSubmit={handleLogin}>
                            <div className="mb-4">
                                <label className="block text-gray-700 font-semibold mb-2">อีเมล</label>
                                <input
                                    type="email"
                                    value={adminEmail}
                                    onChange={(e) => setAdminEmail(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                                    placeholder="admin@email.com"
                                    required
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">รหัสผ่าน</label>
                                <input
                                    type="password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
                            >
                                เข้าสู่ระบบ
                            </button>
                        </form>
                    </div>
                </div>
            </>
        );
    }

    // Main Admin Panel
    return (
        <>
            <Head>
                <title>Admin Panel - AI Studio</title>
                <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
            </Head>

            <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 font-[Nunito]">
                {/* Header */}
                <header className="bg-white rounded-2xl shadow-lg p-6 mb-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">👑</span>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
                            <p className="text-gray-500">จัดการผู้ใช้ AI Studio</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={loadUsers}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition"
                        >
                            🔄 รีเฟรช
                        </button>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition"
                        >
                            🚪 ออก
                        </button>
                    </div>
                </header>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                        <div className="text-4xl font-bold text-gray-800">{stats.total}</div>
                        <div className="text-gray-500 mt-1">ทั้งหมด</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                        <div className="text-4xl font-bold text-amber-500">{stats.pending}</div>
                        <div className="text-gray-500 mt-1">รออนุมัติ</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                        <div className="text-4xl font-bold text-emerald-500">{stats.approved}</div>
                        <div className="text-gray-500 mt-1">อนุมัติแล้ว</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                        <div className="text-4xl font-bold text-red-500">{stats.rejected}</div>
                        <div className="text-gray-500 mt-1">ถูกปฏิเสธ</div>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-4 flex-wrap">
                    {['all', 'pending', 'approved', 'rejected'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-full font-semibold transition ${filter === f
                                    ? 'bg-white text-gray-800 shadow'
                                    : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                        >
                            {f === 'all' && 'ทั้งหมด'}
                            {f === 'pending' && '🕐 รออนุมัติ'}
                            {f === 'approved' && '✅ อนุมัติแล้ว'}
                            {f === 'rejected' && '❌ ถูกปฏิเสธ'}
                        </button>
                    ))}
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-500">กำลังโหลด...</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-5xl mb-4">👥</div>
                            <p className="text-gray-500">ไม่มีผู้ใช้</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-4 text-left font-bold text-gray-700">อีเมล</th>
                                        <th className="px-6 py-4 text-left font-bold text-gray-700">ชื่อ</th>
                                        <th className="px-6 py-4 text-left font-bold text-gray-700">สถานะ</th>
                                        <th className="px-6 py-4 text-left font-bold text-gray-700">วันที่สมัคร</th>
                                        <th className="px-6 py-4 text-left font-bold text-gray-700">การดำเนินการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((user, i) => (
                                        <tr key={i} className="border-b hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 text-gray-800 font-medium">{user.email}</td>
                                            <td className="px-6 py-4 text-gray-600">{user.displayName || '-'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${user.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                        user.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                            'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {user.status === 'approved' && '✅ อนุมัติแล้ว'}
                                                    {user.status === 'rejected' && '❌ ถูกปฏิเสธ'}
                                                    {user.status === 'pending' && '🕐 รออนุมัติ'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">{formatDate(user.createdAt)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    {user.status !== 'approved' && (
                                                        <button
                                                            onClick={() => updateUserStatus(user.email, 'approved')}
                                                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition"
                                                        >
                                                            ✅ อนุมัติ
                                                        </button>
                                                    )}
                                                    {user.status !== 'rejected' && (
                                                        <button
                                                            onClick={() => updateUserStatus(user.email, 'rejected')}
                                                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition"
                                                        >
                                                            ❌ ปฏิเสธ
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => deleteUser(user.email)}
                                                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded-lg transition"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Toast */}
                {toast.show && (
                    <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-lg font-semibold text-white ${toast.type === 'success' ? 'bg-gray-800' : 'bg-red-500'
                        } animate-slide-in`}>
                        {toast.message}
                    </div>
                )}
            </div>

            <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease; }
      `}</style>
        </>
    );
}
