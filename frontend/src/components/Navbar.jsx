import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';
import { LogOut, User as UserIcon, Store, Shield, BookOpen, UtensilsCrossed } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleVariant = (role) => {
    switch (role) {
      case 'ADMIN': return 'roleAdmin';
      case 'STAFF': return 'roleStaff';
      default: return 'roleStudent';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'ADMIN': return <Shield className="w-3.5 h-3.5" />;
      case 'STAFF': return <Store className="w-3.5 h-3.5" />;
      default: return <BookOpen className="w-3.5 h-3.5" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white group-hover:border-zinc-500 transition-colors">
            <UtensilsCrossed className="w-5 h-5 text-zinc-100" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-widest uppercase text-white font-mono">
              Campus Foods
            </span>
            <span className="text-[10px] text-zinc-400 tracking-wider uppercase font-mono">
              Food Management System
            </span>
          </div>
        </Link>

        {/* User state and actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {user ? (
            <>
              {/* Role Badge */}
              <div className="hidden sm:flex items-center">
                <Badge variant={getRoleVariant(user.role)}>
                  {getRoleIcon(user.role)}
                  <span>{user.role}</span>
                </Badge>
              </div>

              {/* Staff assigned food point if applicable */}
              {user.role === 'STAFF' && user.assigned_food_points?.length > 0 && (
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
                  <Store className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-400">Outlet:</span>
                  <span className="font-medium text-white">{user.assigned_food_points[0].name}</span>
                </div>
              )}

              {/* User Name & Details */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-sm">
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-medium text-zinc-200 leading-tight">
                    {user.full_name || user.username}
                  </span>
                  {user.student_roll_no && (
                    <span className="text-[10px] text-zinc-400 font-mono leading-tight">
                      {user.student_roll_no}
                    </span>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                title="Log Out"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 hover:border-zinc-700 transition-all text-xs font-medium cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 text-xs font-medium bg-white text-black hover:bg-zinc-200 rounded-lg transition"
              >
                Student Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
