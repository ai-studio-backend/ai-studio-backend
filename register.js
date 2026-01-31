// Register Page
import { useState } from 'react';
import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    if (password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setLoading(true);

    if (!auth) {
      setError('Firebase not initialized. Please check environment variables.');
      setLoading(false);
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess(true);
      setTimeout(() => {
        router.push('/admin');
      }, 1500);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('อีเมลนี้ถูกใช้งานแล้ว');
      } else if (err.code === 'auth/invalid-email') {
        setError('รูปแบบอีเมลไม่ถูกต้อง');
      } else if (err.code === 'auth/weak-password') {
        setError('รหัสผ่านไม่ปลอดภัยเพียงพอ');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            🤖 AI Studio
          </h1>
          <p className="text-gray-400 mt-2">สมัครสมาชิกใหม่</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-3 rounded-lg text-sm">
              ✅ สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...
            </div>
          )}

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50"
          >
            {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            มีบัญชีอยู่แล้ว?{' '}
            <Link href="/login" className="text-purple-400 hover:text-purple-300">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
