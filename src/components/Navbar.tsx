import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CalendarCheck,
  Mail,
  LogOut,
  LogIn,
  ShieldCheck,
  Stethoscope,
  User as UserIcon,
  HeartPulse,
} from 'lucide-react';
import { UserRole } from '../types';

interface NavbarProps {
  onOpenNotifications: () => void;
  onOpenLoginModal: (role?: UserRole) => void;
  onOpenRegisterModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNotifications,
  onOpenLoginModal,
  onOpenRegisterModal,
}) => {
  const { user, logout } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-[#800020] border border-[#800020]/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Clinic Admin
          </span>
        );
      case 'doctor':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-[#064E3B] border border-[#064E3B]/20">
            <Stethoscope className="w-3.5 h-3.5" />
            Doctor Portal
          </span>
        );
      case 'patient':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-[#1E3A8A] border border-[#1E3A8A]/20">
            <UserIcon className="w-3.5 h-3.5" />
            Patient Portal
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name (Red Wine, Gold Accents) */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#800020] text-white flex items-center justify-center shadow-md border border-[#F59E0B]/30">
              <HeartPulse className="w-6 h-6 text-[#F59E0B]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-slate-900 tracking-tight">Nowshera Family Clinic</span>
                <span className="hidden md:inline-block text-[11px] font-bold px-2 py-0.5 rounded-sm bg-amber-50 text-[#B45309] border border-amber-200">
                  4 Resident Specialists
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Real-Time Appointment Scheduling & Clinical Care</p>
            </div>
          </div>

          {/* Actions & Navigation */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications Center */}
            <button
              id="notifications-btn"
              onClick={onOpenNotifications}
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 transition-colors"
              title="View Simulated Email Notifications & Alerts"
            >
              <Mail className="w-4 h-4 text-[#B45309]" />
              <span className="hidden md:inline">Notifications</span>
              <span className="md:hidden">Alerts</span>
            </button>

            {/* Authenticated User Status / Actions */}
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="hidden sm:block text-right">
                    <div className="text-xs font-bold text-slate-900 leading-tight">{user.name}</div>
                  </div>
                  {getRoleBadge(user.role)}
                </div>

                <button
                  id="sign-out-btn"
                  onClick={logout}
                  className="p-2 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="sign-in-btn"
                  onClick={() => onOpenLoginModal('patient')}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  Sign In
                </button>
                <button
                  id="register-btn"
                  onClick={onOpenRegisterModal}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#800020] hover:bg-[#5C1D24] rounded-lg transition-colors shadow-xs"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

