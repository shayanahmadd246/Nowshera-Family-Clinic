import React from 'react';
import {
  CalendarCheck,
  LogIn,
  UserPlus,
  ShieldCheck,
  Stethoscope,
  Clock,
  MapPin,
  Phone,
  Mail,
  Award,
  Sparkles,
  CheckCircle2,
  HeartPulse,
  Building2,
  Microscope,
  Baby,
  Smile,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface LandingHomeProps {
  onOpenLoginModal: (role?: 'patient' | 'doctor' | 'admin') => void;
  onOpenRegisterModal: () => void;
}

export const LandingHome: React.FC<LandingHomeProps> = ({
  onOpenLoginModal,
  onOpenRegisterModal,
}) => {
  // 4 Registered Doctors
  const doctors = [
    {
      id: 'doc_ayesha',
      name: 'Dr. Ayesha Siddiqui',
      role: 'Cardiologist & Heart Specialist',
      qualifications: 'MBBS, FCPS Cardiology (Gold Medalist)',
      experience: '12+ Years Consultant Experience',
      email: 'dr.ayesha@nowshera.clinic',
      schedule: 'Mon – Fri: 09:00 AM - 01:00 PM',
      color: 'border-[#1E3A8A] text-[#1E3A8A]',
      accentBg: 'bg-blue-50',
      badgeBg: 'bg-[#1E3A8A] text-white',
      image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'doc_tariq',
      name: 'Dr. Tariq Mahmood',
      role: 'General Physician & Internal Medicine',
      qualifications: 'MBBS, MRCP (UK), Fellow Internal Medicine',
      experience: '15+ Years Clinical Practice',
      email: 'dr.tariq@nowshera.clinic',
      schedule: 'Mon – Fri: 02:00 PM - 06:00 PM',
      color: 'border-[#064E3B] text-[#064E3B]',
      accentBg: 'bg-emerald-50',
      badgeBg: 'bg-[#064E3B] text-white',
      image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'doc_fatima',
      name: 'Dr. Fatima Noor',
      role: 'Consultant Pediatrician & Child Health',
      qualifications: 'MBBS, DCH, MCPS Pediatrics',
      experience: '9+ Years Child Specialist',
      email: 'dr.fatima@nowshera.clinic',
      schedule: 'Mon – Thu: 10:00 AM - 02:00 PM',
      color: 'border-[#800020] text-[#800020]',
      accentBg: 'bg-rose-50',
      badgeBg: 'bg-[#800020] text-white',
      image: 'https://images.unsplash.com/photo-1594824813587-080c3c544e3e?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'doc_bilal',
      name: 'Dr. Bilal Hamza',
      role: 'Dermatologist & Laser Specialist',
      qualifications: 'MBBS, FCPS Dermatology',
      experience: '11+ Years Skin Care & Aesthetics',
      email: 'dr.bilal@nowshera.clinic',
      schedule: 'Tue – Sat: 03:00 PM - 07:00 PM',
      color: 'border-[#B45309] text-[#B45309]',
      accentBg: 'bg-amber-50',
      badgeBg: 'bg-[#B45309] text-white',
      image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=600&q=80',
    },
  ];

  // Clinic Facilities and Gallery Images
  const clinicGallery = [
    {
      title: 'Modern Clinic Reception & Triage',
      desc: 'Welcoming front desk with digital queue management and patient reception lounge.',
      image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80',
      category: 'Main Reception',
      tagColor: 'bg-[#800020] text-white',
    },
    {
      title: 'Consultation & Diagnostics Suite',
      desc: 'Equipped with digital ECG, ultrasound imaging, and non-invasive cardiovascular monitors.',
      image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=900&q=80',
      category: 'Diagnostics Lab',
      tagColor: 'bg-[#1E3A8A] text-white',
    },
    {
      title: 'Pediatric Care & Family Wing',
      desc: 'Friendly, sanitized consultation suites designed for child comfort and gentle vaccinations.',
      image: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=900&q=80',
      category: 'Pediatrics Wing',
      tagColor: 'bg-[#064E3B] text-white',
    },
    {
      title: 'Dermatology & Minor Procedures Suite',
      desc: 'Sterile procedure theater for clinical skin treatments, biopsies, and laser therapy.',
      image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=900&q=80',
      category: 'Skin & Laser Suite',
      tagColor: 'bg-[#B45309] text-white',
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Banner with Red Wine, Yellow, Dark Green & Blue Theme */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#5C1D24] via-[#800020] to-[#1E3A8A] text-white py-14 px-4 sm:px-6 lg:px-8 shadow-md">
        {/* Decorative Theme Elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F59E0B]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#065F46]/25 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F59E0B] text-[#5C1D24] text-xs font-bold uppercase tracking-wider shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                Premier Family Healthcare & Specialist Clinic
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                Excellence in Clinical Care & Seamless Appointments
              </h1>

              <p className="text-sm sm:text-base text-rose-100 max-w-2xl leading-relaxed">
                Welcome to Nowshera Family Clinic. Our team of 4 dedicated resident specialists provides comprehensive Cardiology, Pediatrics, Dermatology, and Internal Medicine care with real-time slot booking and instant confirmation.
              </p>

              {/* Quick Sign-In and Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  id="hero-patient-signin-btn"
                  onClick={() => onOpenLoginModal('patient')}
                  className="px-5 py-3 rounded-xl bg-[#064E3B] hover:bg-[#065F46] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all transform hover:-translate-y-0.5 border border-[#10B981]/30"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Book Appointment
                </button>

                <button
                  id="hero-register-btn"
                  onClick={onOpenRegisterModal}
                  className="px-5 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#5C1D24] font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all transform hover:-translate-y-0.5"
                >
                  <UserPlus className="w-4 h-4" />
                  New Patient Register
                </button>

                <button
                  id="hero-doctor-signin-btn"
                  onClick={() => onOpenLoginModal('doctor')}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 backdrop-blur-xs border border-white/20 transition-all"
                >
                  <Stethoscope className="w-4 h-4 text-emerald-300" />
                  Doctor Sign In
                </button>

                <button
                  id="hero-admin-signin-btn"
                  onClick={() => onOpenLoginModal('admin')}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 backdrop-blur-xs border border-white/20 transition-all"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  Admin Portal
                </button>
              </div>

              {/* Clinic Key Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-rose-900/60">
                <div className="bg-black/20 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                  <div className="text-lg font-black text-[#F59E0B]">4 Specialists</div>
                  <div className="text-[11px] text-rose-200">Resident Physicians</div>
                </div>
                <div className="bg-black/20 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                  <div className="text-lg font-black text-[#10B981]">30-Min Slots</div>
                  <div className="text-[11px] text-rose-200">Zero Wait Scheduling</div>
                </div>
                <div className="bg-black/20 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                  <div className="text-lg font-black text-[#60A5FA]">100% Verified</div>
                  <div className="text-[11px] text-rose-200">No Double Bookings</div>
                </div>
                <div className="bg-black/20 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                  <div className="text-lg font-black text-white">Instant Alerts</div>
                  <div className="text-[11px] text-rose-200">Automated Emails</div>
                </div>
              </div>
            </div>

            {/* Right Hero Image Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-[#F59E0B]/40 bg-slate-900 group">
                <img
                  src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1000&q=80"
                  alt="Nowshera Family Clinic Center"
                  className="w-full h-80 sm:h-96 object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#5C1D24]/90 via-transparent to-black/20" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="px-2.5 py-1 rounded-md bg-[#064E3B] text-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                    Main Campus
                  </span>
                  <h3 className="text-base font-bold mt-1 text-white">State-of-the-Art Clinical Facility</h3>
                  <p className="text-xs text-rose-200 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Main Boulevard, Healthcare District, Nowshera
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Portal Access Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-[#B45309] text-xs font-bold uppercase">
            <LogIn className="w-3.5 h-3.5" /> Direct Portal Access
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Sign In to Your Respective Portal
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Select your account type below to access appointments, patient records, or administration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Patient Portal Card */}
          <div className="bg-white rounded-2xl p-6 border-2 border-[#1E3A8A]/30 hover:border-[#1E3A8A] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center mb-4 shadow-sm">
                <HeartPulse className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-[#1E3A8A]">
                Patients & Families
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-2">Patient Portal</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Book appointment slots with any of our 4 doctors, view your visit history, and reschedule appointments. Open to all registered patients.
              </p>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                id="portal-patient-signin-btn"
                onClick={() => onOpenLoginModal('patient')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#1E40AF] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In as Patient
              </button>
              <button
                id="portal-patient-register-btn"
                onClick={onOpenRegisterModal}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Register New Patient
              </button>
            </div>
          </div>

          {/* Doctor Portal Card */}
          <div className="bg-white rounded-2xl p-6 border-2 border-[#064E3B]/30 hover:border-[#064E3B] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#064E3B] text-white flex items-center justify-center mb-4 shadow-sm">
                <Stethoscope className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-[#064E3B]">
                Medical Practitioners
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-2">Doctor Clinical Portal</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Doctor dashboard to review booked appointments, confirm or complete patient visits, manage leaves, and record clinical prescriptions.
              </p>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                id="portal-doctor-signin-btn"
                onClick={() => onOpenLoginModal('doctor')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#064E3B] hover:bg-[#065F46] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In to Doctor Portal
              </button>
              <p className="text-[11px] text-center text-slate-500">
                Authorized resident practitioners only
              </p>
            </div>
          </div>

          {/* Admin Portal Card */}
          <div className="bg-white rounded-2xl p-6 border-2 border-[#800020]/30 hover:border-[#800020] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#800020] text-white flex items-center justify-center mb-4 shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-100 text-[#800020]">
                Management & Operations
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-2">Clinic Administration</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Full administrative control over appointments, doctor schedules, AI Doctor Credential generator, leaves, patient analytics, and reports.
              </p>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                id="portal-admin-signin-btn"
                onClick={() => onOpenLoginModal('admin')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#800020] hover:bg-[#5C1D24] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Sign In as Admin
              </button>
              <p className="text-[11px] text-center text-slate-500">
                Restricted to authorized clinic administration
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pictures About Clinic Facilities Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-[#800020] text-xs font-bold uppercase">
              <Building2 className="w-3.5 h-3.5" /> Clinic Tour & Facilities
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Pictures of Our Modern Clinic
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-md">
            Built to international standards with sterile consultation suites, high-tech diagnostics lab, and patient-first comfort.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {clinicGallery.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col"
            >
              <div className="relative h-48 overflow-hidden bg-slate-100">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase shadow-sm ${item.tagColor}`}>
                  {item.category}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-[#800020] transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-[#064E3B]">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#064E3B]" /> Sanitized & Certified
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4 Resident Specialists Roster */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#064E3B] text-xs font-bold uppercase">
              <Stethoscope className="w-3.5 h-3.5" /> Medical Team
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Our 4 Resident Specialist Doctors
            </h2>
          </div>
          <button
            onClick={() => onOpenLoginModal('patient')}
            className="text-xs font-bold text-[#800020] hover:text-[#5C1D24] flex items-center gap-1"
          >
            Sign in to schedule with these doctors <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {doctors.map((doc) => (
            <div
              key={doc.id}
              className={`bg-white rounded-2xl border-2 ${doc.color.split(' ')[0]} p-5 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between space-y-4`}
            >
              <div>
                <div className="relative h-44 rounded-xl overflow-hidden mb-3 bg-slate-100 border border-slate-200">
                  <img
                    src={doc.image}
                    alt={doc.name}
                    className="w-full h-full object-cover"
                  />
                  <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-bold shadow-xs ${doc.badgeBg}`}>
                    Active
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">{doc.name}</h3>
                  <div className={`text-xs font-bold ${doc.color.split(' ')[1]}`}>{doc.role}</div>
                  <p className="text-[11px] text-slate-500 font-medium">{doc.qualifications}</p>
                </div>

                <div className={`mt-3 p-2.5 rounded-xl ${doc.accentBg} text-xs space-y-1 border border-slate-200/60`}>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{doc.schedule}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <Award className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>{doc.experience}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenLoginModal('patient')}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-[#800020] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                Book with {doc.name.split(' ')[1]}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Emergency & Clinic Timings Info Footer Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="bg-[#064E3B] text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md border-2 border-[#F59E0B]">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F59E0B] text-[#064E3B] text-xs font-black uppercase">
              <Phone className="w-3.5 h-3.5" /> Urgent Care & Helplines
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight">
              Need Assistance or Have An Inquiry?
            </h3>
            <p className="text-xs text-emerald-100 max-w-xl">
              Nowshera Family Clinic is open Monday through Saturday from 09:00 AM to 07:00 PM. Our helpline is operational for appointment confirmations and emergency triage.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <button
              onClick={() => onOpenLoginModal('patient')}
              className="px-5 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#5C1D24] text-xs font-black shadow-md transition-all"
            >
              Sign In to Patient Portal
            </button>
            <button
              onClick={() => onOpenLoginModal('admin')}
              className="px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 transition-all"
            >
              Admin Access
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
