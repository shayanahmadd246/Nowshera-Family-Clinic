import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { AdminDashboardData, User, Appointment, AiClinicInsights } from '../types';
import { formatTime12h, formatTimeRange12h } from '../lib/timeUtils';
import { SqliteDatabaseManager } from './SqliteDatabaseManager';
import {
  ShieldCheck,
  Users,
  Calendar,
  Clock,
  UserPlus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Power,
  Mail,
  Phone,
  Stethoscope,
  ChevronRight,
  Shield,
  FileX,
  Sparkles,
  KeyRound,
  Lock,
  Database,
  TrendingUp,
  Globe,
  Send,
  CheckCircle2,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'doctors' | 'patients' | 'all-appointments' | 'sqlite'>('dashboard');

  // Dashboard Data
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [aiInsights, setAiInsights] = useState<AiClinicInsights | null>(null);
  const [loadingAiInsights, setLoadingAiInsights] = useState(false);

  // Doctors State
  const [doctors, setDoctors] = useState<User[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorEmail, setNewDoctorEmail] = useState('');
  const [newDoctorPhone, setNewDoctorPhone] = useState('+92 300 ');
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState('');
  const [addDoctorLoading, setAddDoctorLoading] = useState(false);
  const [addDoctorSuccess, setAddDoctorSuccess] = useState<{ doctor: User; setupUrl: string; token: string } | null>(null);
  const [addDoctorError, setAddDoctorError] = useState<string | null>(null);

  // AI Doctor Generator State
  const [aiSpecialtyPrompt, setAiSpecialtyPrompt] = useState('');
  const [aiDoctorNamePrompt, setAiDoctorNamePrompt] = useState('');
  const [isGeneratingAiDoctor, setIsGeneratingAiDoctor] = useState(false);
  const [aiGeneratedDoctor, setAiGeneratedDoctor] = useState<{
    name: string;
    email: string;
    password?: string;
    specialty: string;
    phone: string;
    qualifications: string;
    experience: string;
    bio: string;
  } | null>(null);

  // Patients State
  const [patients, setPatients] = useState<Array<User & { totalAppointments: number; completedVisits: number }>>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);

  // All Appointments State
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [filterDoctorId, setFilterDoctorId] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [loadingAllAppointments, setLoadingAllAppointments] = useState(false);
  const [cancelModalApt, setCancelModalApt] = useState<Appointment | null>(null);
  const [adminCancelReason, setAdminCancelReason] = useState('');
  const [cancellingLoading, setCancellingLoading] = useState(false);

  // n8n Webhook State
  const [n8nStatus, setN8nStatus] = useState<{ webhookUrl: string; isConfigured: boolean; supportedEvents?: string[] } | null>(null);
  const [testingN8n, setTestingN8n] = useState(false);
  const [n8nTestResult, setN8nTestResult] = useState<{
    success: boolean;
    statusCode?: number;
    message?: string;
    responseBody?: string;
    error?: string;
    timestamp: string;
  } | null>(null);

  const loadN8nStatus = async () => {
    try {
      const data = await api.getN8nWebhookStatus();
      setN8nStatus(data);
    } catch (err) {
      console.error('Failed to load n8n webhook status', err);
    }
  };

  const handleTestN8nWebhook = async (eventType: string = 'appointment.test_ping') => {
    setTestingN8n(true);
    setN8nTestResult(null);
    try {
      const res = await api.testN8nWebhook(undefined, eventType);
      setN8nTestResult(res);
    } catch (err: any) {
      setN8nTestResult({
        success: false,
        error: err.message || 'Failed to dispatch test webhook to n8n',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setTestingN8n(false);
    }
  };

  const loadDashboard = async () => {
    setLoadingDashboard(true);
    try {
      const data = await api.getAdminDashboard();
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const loadAiInsights = async () => {
    setLoadingAiInsights(true);
    try {
      const data = await api.getAiClinicInsights();
      setAiInsights(data);
    } catch (err) {
      console.error('Failed to load AI clinic insights', err);
    } finally {
      setLoadingAiInsights(false);
    }
  };

  const loadDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const data = await api.getDoctors();
      setDoctors(data);
    } catch (err) {
      console.error('Failed to load doctors', err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadPatients = async (query = '') => {
    setLoadingPatients(true);
    try {
      const data = await api.getAdminPatients(query);
      setPatients(data);
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const loadAllAppointments = async () => {
    setLoadingAllAppointments(true);
    try {
      const params: any = {};
      if (filterDoctorId) params.doctorId = filterDoctorId;
      if (filterDate) params.date = filterDate;
      if (filterStatus) params.status = filterStatus;
      const data = await api.getAppointments(params);
      setAllAppointments(data);
    } catch (err) {
      console.error('Failed to load all appointments', err);
    } finally {
      setLoadingAllAppointments(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadDashboard();
      loadDoctors();
      loadAiInsights();
      loadN8nStatus();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
      loadAiInsights();
      loadN8nStatus();
    }
    if (activeTab === 'doctors') loadDoctors();
    if (activeTab === 'patients') loadPatients(patientSearch);
    if (activeTab === 'all-appointments') loadAllAppointments();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'all-appointments') {
      loadAllAppointments();
    }
  }, [filterDoctorId, filterDate, filterStatus]);

  const handleGenerateWithAi = async () => {
    setIsGeneratingAiDoctor(true);
    try {
      const result = await api.generateDoctorCredentials({
        specialty: aiSpecialtyPrompt,
        doctorName: aiDoctorNamePrompt,
      });
      setAiGeneratedDoctor(result);
      setNewDoctorName(result.name);
      setNewDoctorEmail(result.email);
      setNewDoctorSpecialty(result.specialty);
      setNewDoctorPhone(result.phone);
    } catch (err: any) {
      alert('AI Generation error: ' + (err.message || 'Could not reach AI model'));
    } finally {
      setIsGeneratingAiDoctor(false);
    }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddDoctorError(null);
    setAddDoctorSuccess(null);
    setAddDoctorLoading(true);
    try {
      const res = await api.createDoctor({
        name: newDoctorName,
        email: newDoctorEmail,
        phone: newDoctorPhone,
        specialty: newDoctorSpecialty,
      });

      setAddDoctorSuccess({
        doctor: res.doctor,
        setupUrl: res.setupUrl,
        token: res.setupPasswordToken,
      });
      setNewDoctorName('');
      setNewDoctorEmail('');
      setNewDoctorPhone('+92 300 ');
      setNewDoctorSpecialty('');
      await loadDoctors();
      await loadDashboard();
    } catch (err: any) {
      setAddDoctorError(err.message || 'Failed to add doctor');
    } finally {
      setAddDoctorLoading(false);
    }
  };

  const handleToggleDoctorStatus = async (doc: User) => {
    const newStatus = doc.isActive === false ? true : false;
    try {
      await api.toggleDoctorStatus(doc.id, newStatus);
      await loadDoctors();
      await loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to update doctor status');
    }
  };

  const handleAdminCancelAppointment = async () => {
    if (!cancelModalApt) return;
    setCancellingLoading(true);
    try {
      await api.cancelAppointment(cancelModalApt.id, adminCancelReason || 'Cancelled by Clinic Administration');
      setCancelModalApt(null);
      setAdminCancelReason('');
      await loadAllAppointments();
      await loadDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment');
    } finally {
      setCancellingLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner - Red Wine, Gold Accents */}
      <div className="bg-gradient-to-r from-[#5C1D24] via-[#800020] to-[#1E3A8A] rounded-2xl p-6 sm:p-8 text-white shadow-lg border-b-4 border-[#F59E0B]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#F59E0B] text-xs font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              Authorized Clinic Administration Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Nowshera Family Clinic Operations</h1>
            <p className="text-sm text-rose-100/90 mt-1 max-w-xl">
              Clinic dashboard, 4 resident doctors management, AI credential assistant, patient records, and real-time scheduling controls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-[#800020] shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
              }`}
            >
              <Clock className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('doctors')}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'doctors'
                  ? 'bg-white text-[#800020] shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
              }`}
            >
              <Stethoscope className="w-4 h-4 text-emerald-300" />
              4 Doctors ({doctors.length})
            </button>
            <button
              onClick={() => setActiveTab('patients')}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'patients'
                  ? 'bg-white text-[#800020] shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
              }`}
            >
              <Users className="w-4 h-4 text-blue-300" />
              Patients
            </button>
            <button
              onClick={() => setActiveTab('all-appointments')}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'all-appointments'
                  ? 'bg-white text-[#800020] shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
              }`}
            >
              <Calendar className="w-4 h-4 text-amber-300" />
              All Appointments
            </button>
            <button
              id="admin-sqlite-tab-btn"
              onClick={() => setActiveTab('sqlite')}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'sqlite'
                  ? 'bg-amber-400 text-stone-950 shadow-md font-extrabold'
                  : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-400/40'
              }`}
            >
              <Database className="w-4 h-4 text-amber-300" />
              SQLite Database
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: CLINIC DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top Metric Cards with 4 Theme Colors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border-2 border-[#800020]/30 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider text-[#800020]">Today&apos;s Appointments</span>
                <Calendar className="w-4 h-4 text-[#800020]" />
              </div>
              <div className="text-3xl font-black text-slate-900">
                {dashboard?.todayAppointmentsCount || 0}
              </div>
              <div className="text-[11px] text-slate-500">Date: {dashboard?.todayDate}</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border-2 border-[#064E3B]/30 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider text-[#064E3B]">4 Resident Doctors</span>
                <Stethoscope className="w-4 h-4 text-[#064E3B]" />
              </div>
              <div className="text-3xl font-black text-[#064E3B]">
                {doctors.filter((d) => d.isActive !== false).length}
              </div>
              <div className="text-[11px] text-slate-500">Active resident medical team</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border-2 border-[#1E3A8A]/30 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A]">Registered Patients</span>
                <Users className="w-4 h-4 text-[#1E3A8A]" />
              </div>
              <div className="text-3xl font-black text-[#1E3A8A]">
                {dashboard?.totalPatientsCount || 0}
              </div>
              <div className="text-[11px] text-slate-500">Patient registry records</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border-2 border-[#F59E0B]/50 shadow-xs space-y-2 bg-amber-50/40">
              <div className="flex items-center justify-between text-[#B45309]">
                <span className="text-xs font-bold uppercase tracking-wider">AI Doctor Assistant</span>
                <Sparkles className="w-4 h-4 text-[#B45309]" />
              </div>
              <div className="text-sm font-bold text-[#B45309]">
                Gemini AI Enabled
              </div>
              <div className="text-[11px] text-slate-600">AI Doctor Credential & Profile generator active</div>
            </div>
          </div>

          {/* AI Doctor Generator Quick Feature Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-rose-50 to-blue-50 rounded-2xl p-5 border-2 border-[#F59E0B] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#F59E0B] text-[#5C1D24] text-[10px] font-black uppercase">
                <Sparkles className="w-3 h-3" /> AI Assistant
              </div>
              <h3 className="text-sm font-bold text-slate-900">Need to onboard a new Doctor via AI Assistant?</h3>
              <p className="text-xs text-slate-600">
                Generate complete doctor qualifications, clinical specialties, and weekly shifts automatically with Gemini AI.
              </p>
            </div>
            <button
              onClick={() => {
                setShowAddDoctorModal(true);
                handleGenerateWithAi();
              }}
              className="px-4 py-2 bg-[#800020] hover:bg-[#5C1D24] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shrink-0"
            >
              <Sparkles className="w-4 h-4 text-[#F59E0B]" />
              Generate Doctor Profile by AI
            </button>
          </div>

          {/* AI Automated Clinic Intelligence Card */}
          <div className="bg-gradient-to-br from-stone-900 via-rose-950 to-stone-900 rounded-2xl p-6 text-white border border-rose-900/60 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                    Automated AI Clinic Intelligence
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono">
                      SQLite Synced
                    </span>
                  </h3>
                  <p className="text-xs text-stone-400">
                    Real-time operational analysis generated automatically by AI from your SQLite database
                  </p>
                </div>
              </div>
              <button
                onClick={loadAiInsights}
                disabled={loadingAiInsights}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 border border-stone-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAiInsights ? 'animate-spin' : ''}`} />
                {loadingAiInsights ? 'Analyzing...' : 'Refresh AI Insights'}
              </button>
            </div>

            {aiInsights ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-2">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Operational Summary
                  </div>
                  <p className="text-stone-300 leading-relaxed">{aiInsights.summary}</p>
                </div>

                <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-2">
                  <div className="font-bold text-sky-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-sky-400" /> Workload & Doctor Alerts
                  </div>
                  <ul className="space-y-1 text-stone-300">
                    {aiInsights.workloadAlerts.map((alert, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{alert}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-2">
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" /> AI Recommendations
                  </div>
                  <ul className="space-y-1 text-stone-300">
                    {aiInsights.operationalRecommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-stone-400 text-xs">
                {loadingAiInsights ? 'AI is analyzing SQLite records...' : 'Click "Refresh AI Insights" to generate real-time clinic analytics.'}
              </div>
            )}
          </div>

          {/* Doctor Activity / Workload Breakdown Table */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">4 Resident Doctors Status & Appointment Breakdown</h2>
                <p className="text-xs text-slate-500">
                  Real-time breakdown of appointments across all 4 clinic doctors.
                </p>
              </div>
              <button
                onClick={loadDashboard}
                disabled={loadingDashboard}
                className="text-xs font-bold text-[#800020] hover:text-[#5C1D24] flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDashboard ? 'animate-spin' : ''}`} /> Refresh Data
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px]">
                    <th className="p-3">Doctor</th>
                    <th className="p-3">Specialty</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Pending</th>
                    <th className="p-3 text-center">Confirmed</th>
                    <th className="p-3 text-center">Completed</th>
                    <th className="p-3 text-center">No-Show</th>
                    <th className="p-3 text-center">Cancelled</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dashboard?.doctorStats.map((stat) => (
                    <tr key={stat.doctorId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{stat.doctorName}</td>
                      <td className="p-3 text-slate-600">{stat.specialty}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            stat.isActive
                              ? 'bg-emerald-100 text-[#064E3B] border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {stat.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-amber-600">{stat.pending}</td>
                      <td className="p-3 text-center font-bold text-[#064E3B]">{stat.confirmed}</td>
                      <td className="p-3 text-center font-bold text-[#1E3A8A]">{stat.completed}</td>
                      <td className="p-3 text-center font-bold text-slate-600">{stat.noShow}</td>
                      <td className="p-3 text-center font-bold text-rose-600">{stat.cancelled}</td>
                      <td className="p-3 text-right font-black text-slate-900">{stat.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* n8n Webhook Workflow Integration Card */}
          <div className="bg-gradient-to-r from-stone-900 via-[#1E3A8A]/90 to-stone-900 rounded-2xl p-5 sm:p-6 text-white border border-blue-500/30 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center text-orange-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">n8n Doctor Confirmation Webhook</h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Active & Connected
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Automatically dispatches confirmed booking data to n8n whenever a doctor confirms an appointment.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleTestN8nWebhook('appointment.confirmed')}
                  disabled={testingN8n}
                  className="px-4 py-2 bg-[#F59E0B] hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-black flex items-center gap-2 transition shadow-sm"
                  title="Send test doctor confirmation event to n8n"
                >
                  <Send className={`w-3.5 h-3.5 ${testingN8n ? 'animate-bounce' : ''}`} />
                  {testingN8n ? 'Dispatching to n8n...' : 'Send Test Doctor Confirmation'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Webhook URL</span>
                <p className="font-mono text-[11px] text-amber-300 break-all select-all">
                  {n8nStatus?.webhookUrl || 'https://ai-skool-n8n-57b1748669d9.herokuapp.com/webhook-test/2524931a-79d2-4bb8-ad6f-880161b9fdfa'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trigger Rule</span>
                <p className="font-mono text-[11px] text-emerald-300">
                  Doctor Confirmation (Confirmed)
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Dispatched only when doctor confirms appointment</p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SQLite Database Storage</span>
                <p className="font-mono text-[11px] text-emerald-300">
                  Saved in appointments & audit_logs
                </p>
                <p className="text-[10px] text-slate-400">All confirmations persist in SQLite database</p>
              </div>
            </div>

            {/* Test result display */}
            {n8nTestResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition ${
                  n8nTestResult.success
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                }`}
              >
                {n8nTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {n8nTestResult.success ? 'n8n Webhook Received Successfully!' : 'n8n Webhook Dispatch Notice'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(n8nTestResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[11px]">
                    {n8nTestResult.message || n8nTestResult.error}
                    {n8nTestResult.statusCode && ` (HTTP ${n8nTestResult.statusCode})`}
                  </p>
                  {n8nTestResult.responseBody && (
                    <div className="mt-1 font-mono text-[10px] bg-black/50 p-2 rounded text-slate-300 overflow-x-auto">
                      Response: {n8nTestResult.responseBody}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DOCTOR MANAGEMENT & AI CREDENTIALS */}
      {activeTab === 'doctors' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">4 Resident Doctors Registry</h2>
              <p className="text-xs text-slate-500">
                Manage active practitioner status, clinical specialties, and onboard new clinic specialists.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowAddDoctorModal(true);
                  handleGenerateWithAi();
                }}
                className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#5C1D24] rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                AI Doctor Profile
              </button>
              <button
                onClick={() => setShowAddDoctorModal(true)}
                className="px-4 py-2 bg-[#800020] hover:bg-[#5C1D24] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                Add / Onboard Doctor
              </button>
            </div>
          </div>

          {/* Doctor List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {doctors.map((doc) => {
              const isActive = doc.isActive !== false;
              return (
                <div
                  key={doc.id}
                  className="p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#800020]/50 transition-all shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${
                          isActive ? 'bg-[#064E3B] text-white' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        <Stethoscope className="w-6 h-6" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{doc.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-[#064E3B] border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {isActive ? 'Active Resident' : 'Deactivated'}
                          </span>
                        </div>
                        <div className="text-xs text-[#800020] font-bold">{doc.specialty}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleDoctorStatus(doc)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 ${
                        isActive
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>

                  {/* Profile info block */}
                  <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-200">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-medium text-slate-500 flex items-center gap-1">
                        <Stethoscope className="w-3.5 h-3.5 text-[#064E3B]" /> Department / Specialty:
                      </span>
                      <span className="font-bold text-slate-800">{doc.specialty}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-medium text-slate-500 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-[#064E3B]" /> Contact Phone:
                      </span>
                      <span className="font-semibold text-slate-800">{doc.phone}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PATIENT DIRECTORY */}
      {activeTab === 'patients' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Clinic Patient Directory</h2>
              <p className="text-xs text-slate-500">
                View registered patients and booking activity. Clinical notes remain strictly confidential.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  loadPatients(e.target.value);
                }}
                placeholder="Search by name, email, phone..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#800020]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px]">
                  <th className="p-3">Patient Name</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3">Phone Number</th>
                  <th className="p-3 text-center">Total Bookings</th>
                  <th className="p-3 text-center">Completed Visits</th>
                  <th className="p-3">Registered On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{p.name}</td>
                    <td className="p-3 text-[#1E3A8A] font-medium">{p.email}</td>
                    <td className="p-3 text-slate-600">{p.phone}</td>
                    <td className="p-3 text-center font-bold text-slate-800">{p.totalAppointments}</td>
                    <td className="p-3 text-center font-bold text-[#064E3B]">{p.completedVisits}</td>
                    <td className="p-3 text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ALL APPOINTMENTS MASTER SCHEDULE */}
      {activeTab === 'all-appointments' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Clinic Master Appointment Records</h2>
              <p className="text-xs text-slate-500">
                Filtered overview across all 4 doctors, dates, and booking states.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterDoctorId}
                onChange={(e) => setFilterDoctorId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white"
              >
                <option value="">All 4 Doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white"
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Completed">Completed</option>
                <option value="No-show">No-Show</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px]">
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Doctor</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      {apt.date} • {formatTime12h(apt.startTime)}
                    </td>
                    <td className="p-3 font-semibold text-slate-800">{apt.patientName}</td>
                    <td className="p-3 text-[#800020] font-medium">{apt.doctorName}</td>
                    <td className="p-3 text-slate-500 max-w-xs truncate">{apt.reason || 'General checkup'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border">
                        {apt.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {apt.status !== 'Cancelled' && apt.status !== 'Completed' && (
                        <button
                          onClick={() => setCancelModalApt(apt)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SQLITE DATABASE EXPLORER & MANAGEMENT */}
      {activeTab === 'sqlite' && <SqliteDatabaseManager token={api.getToken() || ''} />}

      {/* AI Doctor Modal & Onboarding */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4 border-2 border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#800020] text-[#F59E0B] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">AI Doctor Profile Assistant</h3>
                  <p className="text-[11px] text-slate-500">Auto-fill qualifications, specialty, and schedule with Gemini AI</p>
                </div>
              </div>
              <button onClick={() => setShowAddDoctorModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            {/* AI Prompt Box */}
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#B45309]" /> AI Generator Controls
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#F59E0B] text-[#5C1D24] rounded font-black">
                  Powered by Gemini
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={aiSpecialtyPrompt}
                  onChange={(e) => setAiSpecialtyPrompt(e.target.value)}
                  placeholder="Specialty (e.g., Neurology)"
                  className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
                <input
                  type="text"
                  value={aiDoctorNamePrompt}
                  onChange={(e) => setAiDoctorNamePrompt(e.target.value)}
                  placeholder="Doctor Name Cue (optional)"
                  className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>
              <button
                type="button"
                disabled={isGeneratingAiDoctor}
                onClick={handleGenerateWithAi}
                className="w-full py-2 bg-[#800020] hover:bg-[#5C1D24] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 text-[#F59E0B] ${isGeneratingAiDoctor ? 'animate-spin' : ''}`} />
                {isGeneratingAiDoctor ? 'Generating Doctor Profile...' : 'Auto-Generate Doctor Profile with AI'}
              </button>
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Doctor Full Name</label>
                <input
                  type="text"
                  required
                  value={newDoctorName}
                  onChange={(e) => setNewDoctorName(e.target.value)}
                  placeholder="E.g., Dr. Zainab Tariq"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#800020]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Medical Specialty</label>
                <input
                  type="text"
                  required
                  value={newDoctorSpecialty}
                  onChange={(e) => setNewDoctorSpecialty(e.target.value)}
                  placeholder="E.g., Cardiology, Pediatrics, General Medicine"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#800020]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Doctor Email (for System Identification)</label>
                <input
                  type="email"
                  required
                  value={newDoctorEmail}
                  onChange={(e) => setNewDoctorEmail(e.target.value)}
                  placeholder="dr.specialist@nowshera.clinic"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#800020]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  required
                  value={newDoctorPhone}
                  onChange={(e) => setNewDoctorPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#800020]"
                />
              </div>

              {addDoctorError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {addDoctorError}
                </div>
              )}

              {addDoctorSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Doctor Created & Added to Registry!
                  </div>
                  <p>
                    Practitioner account configured and ready for clinical scheduling.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDoctorModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={addDoctorLoading}
                  className="px-4 py-2 bg-[#800020] hover:bg-[#5C1D24] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  {addDoctorLoading ? 'Adding...' : 'Save Doctor to Clinic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Cancel Modal */}
      {cancelModalApt && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileX className="w-5 h-5 text-rose-600" />
              Admin Emergency Cancellation
            </h3>

            <p className="text-xs text-slate-600">
              Cancel booking for patient <strong>{cancelModalApt.patientName}</strong> with <strong>{cancelModalApt.doctorName}</strong> on <strong>{cancelModalApt.date} at {cancelModalApt.startTime}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Cancellation</label>
              <input
                type="text"
                value={adminCancelReason}
                onChange={(e) => setAdminCancelReason(e.target.value)}
                placeholder="E.g., Doctor emergency surgery, clinic maintenance"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalApt(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleAdminCancelAppointment}
                disabled={cancellingLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                {cancellingLoading ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
