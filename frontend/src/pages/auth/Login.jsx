import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, ArrowRight, Shield, Store, BookOpen, AlertCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const user = await login(username.trim(), password);
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else if (user.role === 'STAFF') {
        navigate('/staff');
      } else {
        navigate('/student');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = (uname, pwd) => {
    setUsername(uname);
    setPassword(pwd);
    setError('');
    setSubmitting(true);
    login(uname, pwd)
      .then((user) => {
        if (user.role === 'ADMIN') navigate('/admin');
        else if (user.role === 'STAFF') navigate('/staff');
        else navigate('/student');
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Login failed.');
        setSubmitting(false);
      });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-[#0a0a0a]">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700/80 mb-2">
            <Lock className="w-5 h-5 text-zinc-100" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Campus Food System</h1>
          <p className="text-xs text-zinc-400">
            Sign in to access your role-based campus dining portal
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-[#121212] border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. arun_v, admin, suresh_m"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-zinc-200 text-black font-semibold text-sm rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm mt-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="pt-4 border-t border-zinc-800/80">
            <span className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-2.5 text-center">
              Quick Role Switcher (Pre-Seeded)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('arun_v', 'student123')}
                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-zinc-400 shrink-0" />
                <div>
                  <div className="font-medium text-zinc-200">Student</div>
                  <div className="text-[10px] text-zinc-400">arun_v (Roll CS22B001)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'admin123')}
                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition cursor-pointer"
              >
                <Shield className="w-4 h-4 text-zinc-200 shrink-0" />
                <div>
                  <div className="font-medium text-white">Administrator</div>
                  <div className="text-[10px] text-zinc-400">admin (Full Access)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('mohan_r', 'staff123')}
                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition cursor-pointer"
              >
                <Store className="w-4 h-4 text-zinc-400 shrink-0" />
                <div>
                  <div className="font-medium text-zinc-200">Staff · Nescafé</div>
                  <div className="text-[10px] text-zinc-400">mohan_r (POS & Stock)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('suresh_m', 'staff123')}
                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left transition cursor-pointer"
              >
                <Store className="w-4 h-4 text-zinc-400 shrink-0" />
                <div>
                  <div className="font-medium text-zinc-200">Staff · Mess</div>
                  <div className="text-[10px] text-zinc-400">suresh_m (Attendance)</div>
                </div>
              </button>
            </div>
          </div>

          <div className="text-center pt-2 text-xs text-zinc-400">
            New student?{' '}
            <Link to="/register" className="text-white hover:underline font-medium">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
