import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import {
  LogIn,
  UserPlus,
  AlertCircle,
  X,
  User as UserIcon,
  Stethoscope,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  initialRole?: UserRole;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  initialRole = 'patient',
}) => {
  const { login, register } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+92 300 ');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedRole(initialRole);
    setMode(initialMode);
    setError(null);
  }, [initialRole, initialMode, isOpen]);

  if (!isOpen) return null;

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setError(null);
    if (role !== 'patient') {
      setMode('login'); // Doctor and Admin only sign in
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password, selectedRole);
      } else {
        await register(name, email, phone, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4 border-2 border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedRole === 'patient' && <UserIcon className="w-5 h-5 text-[#1E3A8A]" />}
            {selectedRole === 'doctor' && <Stethoscope className="w-5 h-5 text-[#064E3B]" />}
            {selectedRole === 'admin' && <ShieldCheck className="w-5 h-5 text-[#800020]" />}
            <h3 className="text-base font-bold text-slate-900">
              {mode === 'register'
                ? 'Create Patient Account'
                : selectedRole === 'doctor'
                ? 'Doctor Portal Sign In'
                : selectedRole === 'admin'
                ? 'Clinic Admin Sign In'
                : 'Patient Portal Sign In'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Portal Tabs with Theme Colors: Blue, Dark Green, Red Wine */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => handleRoleChange('patient')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              selectedRole === 'patient'
                ? 'bg-[#1E3A8A] text-white shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            Patient
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('doctor')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              selectedRole === 'doctor'
                ? 'bg-[#064E3B] text-white shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            Doctor
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('admin')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              selectedRole === 'admin'
                ? 'bg-[#800020] text-white shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin
          </button>
        </div>

        {selectedRole === 'patient' && mode === 'login' && (
          <p className="text-xs text-slate-500">
            Sign in to book and manage appointments. Any patient name and email is supported.
          </p>
        )}

        {selectedRole === 'doctor' && (
          <div className="bg-emerald-50 border border-[#064E3B]/20 p-3 rounded-xl text-xs text-emerald-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-[#064E3B]">
              <Stethoscope className="w-3.5 h-3.5" /> Doctor Clinical Portal
            </div>
            <p className="text-[11px] text-slate-600">
              Please enter your assigned medical practitioner email and confidential password to access your appointments and clinical records.
            </p>
          </div>
        )}

        {selectedRole === 'admin' && (
          <div className="bg-rose-50 border border-[#800020]/20 p-3 rounded-xl text-xs text-[#800020] space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Authorized Administrator Portal
            </div>
            <p className="text-[11px] text-slate-700">
              Restricted clinic operations access. Please enter your administrator email and master password.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && selectedRole === 'patient' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="E.g., Ali Raza"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 ${
                selectedRole === 'doctor'
                  ? 'focus:ring-[#064E3B]'
                  : selectedRole === 'admin'
                  ? 'focus:ring-[#800020]'
                  : 'focus:ring-[#1E3A8A]'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password {selectedRole === 'doctor' && <span className="text-slate-400 font-normal">(Optional for newly created doctors)</span>}
            </label>
            <input
              type="password"
              required={selectedRole !== 'doctor'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={selectedRole === 'doctor' ? 'Optional (leave blank if passwordless)' : '••••••••'}
              className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 ${
                selectedRole === 'doctor'
                  ? 'focus:ring-[#064E3B]'
                  : selectedRole === 'admin'
                  ? 'focus:ring-[#800020]'
                  : 'focus:ring-[#1E3A8A]'
              }`}
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm ${
              selectedRole === 'doctor'
                ? 'bg-[#064E3B] hover:bg-[#065F46]'
                : selectedRole === 'admin'
                ? 'bg-[#800020] hover:bg-[#5C1D24]'
                : 'bg-[#1E3A8A] hover:bg-[#1E40AF]'
            }`}
          >
            {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Patient Account'}
          </button>
        </form>

        {selectedRole === 'patient' && (
          <div className="text-center pt-2 border-t border-slate-100">
            {mode === 'login' ? (
              <p className="text-xs text-slate-500">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="font-bold text-[#1E3A8A] hover:underline"
                >
                  Register with any Name & Email
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="font-bold text-[#1E3A8A] hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
