import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LandingHome } from './components/LandingHome';
import { PatientView } from './components/PatientView';
import { DoctorView } from './components/DoctorView';
import { AdminView } from './components/AdminView';
import { NotificationDrawer } from './components/NotificationDrawer';
import { AuthModal } from './components/AuthModal';
import { Activity, Shield, HeartPulse } from 'lucide-react';
import { UserRole } from './types';

const MainContent: React.FC<{
  onOpenNotifications: () => void;
  onOpenLoginModal: (role?: UserRole) => void;
  onOpenRegisterModal: () => void;
}> = ({ onOpenNotifications, onOpenLoginModal, onOpenRegisterModal }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#800020] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#800020]">Connecting to Nowshera Family Clinic...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Navbar
        onOpenNotifications={onOpenNotifications}
        onOpenLoginModal={onOpenLoginModal}
        onOpenRegisterModal={onOpenRegisterModal}
      />

      <main className="flex-1 pb-16">
        {!user && (
          <LandingHome
            onOpenLoginModal={onOpenLoginModal}
            onOpenRegisterModal={onOpenRegisterModal}
          />
        )}
        {user?.role === 'patient' && <PatientView />}
        {user?.role === 'doctor' && <DoctorView />}
        {user?.role === 'admin' && <AdminView />}
      </main>

      {/* Footer styled with Red Wine, Dark Green, Blue accents */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-[#800020]" />
            <span className="font-bold text-[#800020]">Nowshera Family Clinic</span>
            <span>• 4 Resident Specialists • Verified Timings</span>
          </div>

          <div className="flex items-center gap-1 text-slate-600">
            <Shield className="w-3.5 h-3.5 text-[#064E3B]" />
            Doctor-Patient Confidentiality & Strict Slot Booking Active
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register';
    role: UserRole;
  }>({
    isOpen: false,
    mode: 'login',
    role: 'patient',
  });

  return (
    <AuthProvider>
      <MainContent
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenLoginModal={(role = 'patient') =>
          setAuthModalConfig({ isOpen: true, mode: 'login', role })
        }
        onOpenRegisterModal={() =>
          setAuthModalConfig({ isOpen: true, mode: 'register', role: 'patient' })
        }
      />

      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      <AuthModal
        isOpen={authModalConfig.isOpen}
        initialMode={authModalConfig.mode}
        initialRole={authModalConfig.role}
        onClose={() => setAuthModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </AuthProvider>
  );
}
