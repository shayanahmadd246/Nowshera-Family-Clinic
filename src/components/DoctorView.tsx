import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Appointment, DoctorSchedule, DoctorLeave } from '../types';
import { formatTime12h, formatTimeRange12h } from '../lib/timeUtils';
import {
  Stethoscope,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  User,
  History,
  FileText,
  CalendarOff,
  UserX,
  Phone,
  Mail,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { num: 1, name: 'Monday' },
  { num: 2, name: 'Tuesday' },
  { num: 3, name: 'Wednesday' },
  { num: 4, name: 'Thursday' },
  { num: 5, name: 'Friday' },
  { num: 6, name: 'Saturday' },
  { num: 0, name: 'Sunday' },
];

export const DoctorView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'requests' | 'schedule' | 'availability'>('requests');

  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingApts, setLoadingApts] = useState(false);

  // Schedules & Leaves state
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Add Schedule Form
  const [newDayOfWeek, setNewDayOfWeek] = useState<number>(1);
  const [newStartTime, setNewStartTime] = useState<string>('09:00');
  const [newEndTime, setNewEndTime] = useState<string>('13:00');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [addingSchedule, setAddingSchedule] = useState(false);

  // Add Leave Form
  const [newLeaveDate, setNewLeaveDate] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [newLeaveReason, setNewLeaveReason] = useState<string>('Annual Medical Leave');
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [addingLeave, setAddingLeave] = useState(false);
  const [leaveImpactCount, setLeaveImpactCount] = useState<number | null>(null);

  // Actions on Appointments
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [completingApt, setCompletingApt] = useState<Appointment | null>(null);
  const [visitNotes, setVisitNotes] = useState<string>('');
  const [completingLoading, setCompletingLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [aiSoapLoading, setAiSoapLoading] = useState(false);

  // Patient History Modal
  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null);
  const [patientHistoryData, setPatientHistoryData] = useState<{
    patient?: { id: string; name: string; email: string; phone: string };
    appointments: Appointment[];
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadAppointments = async () => {
    if (!user) return;
    setLoadingApts(true);
    try {
      const data = await api.getAppointments();
      setAppointments(data);
    } catch (err) {
      console.error('Failed to load doctor appointments', err);
    } finally {
      setLoadingApts(false);
    }
  };

  const loadAvailability = async () => {
    if (!user) return;
    setLoadingAvailability(true);
    try {
      const [schs, lvs] = await Promise.all([
        api.getDoctorSchedules(user.id),
        api.getDoctorLeaves(user.id),
      ]);
      setSchedules(schs);
      setLeaves(lvs);
    } catch (err) {
      console.error('Failed to load availability', err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'doctor') {
      loadAppointments();
      loadAvailability();
    }
  }, [user]);

  // Confirm Request
  const handleConfirmRequest = async (aptId: string) => {
    setActionLoadingId(aptId);
    setActionError(null);
    try {
      await api.confirmAppointment(aptId);
      await loadAppointments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to confirm appointment');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject Request
  const handleRejectRequest = async (aptId: string) => {
    const reason = window.prompt('Enter reason for declining appointment (optional):', 'Doctor unavailable at this hour');
    if (reason === null) return; // User pressed Cancel

    setActionLoadingId(aptId);
    setActionError(null);
    try {
      await api.rejectAppointment(aptId, reason);
      await loadAppointments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject appointment');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Complete Visit
  const handleOpenCompleteModal = (apt: Appointment) => {
    setCompletingApt(apt);
    setVisitNotes(apt.notes || '');
    setActionError(null);
  };

  const handleSubmitComplete = async (isNoShow = false) => {
    if (!completingApt) return;
    setCompletingLoading(true);
    setActionError(null);
    try {
      if (isNoShow) {
        await api.markNoShowAppointment(completingApt.id, visitNotes);
      } else {
        await api.completeAppointment(completingApt.id, visitNotes);
      }
      setCompletingApt(null);
      setVisitNotes('');
      await loadAppointments();
    } catch (err: any) {
      setActionError(err.message || 'Failed to finish visit');
    } finally {
      setCompletingLoading(false);
    }
  };

  // Patient History View
  const handleViewPatientHistory = async (patientId: string) => {
    setHistoryPatientId(patientId);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await api.getPatientHistoryForDoctor(patientId);
      setPatientHistoryData(data);
    } catch (err: any) {
      setHistoryError(err.message || 'Failed to load patient history');
      setPatientHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Add Schedule
  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);
    setAddingSchedule(true);
    try {
      await api.addDoctorSchedule({
        dayOfWeek: Number(newDayOfWeek),
        startTime: newStartTime,
        endTime: newEndTime,
      });
      await loadAvailability();
    } catch (err: any) {
      setScheduleError(err.message || 'Failed to add working hours');
    } finally {
      setAddingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await api.deleteDoctorSchedule(id);
      await loadAvailability();
    } catch (err: any) {
      setScheduleError(err.message || 'Failed to remove schedule');
    }
  };

  // Add Leave
  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveError(null);
    setLeaveImpactCount(null);
    setAddingLeave(true);
    try {
      const res = await api.addDoctorLeave({
        date: newLeaveDate,
        reason: newLeaveReason,
      });
      setLeaveImpactCount(res.cancelledAppointmentsCount);
      await loadAvailability();
      await loadAppointments();
    } catch (err: any) {
      setLeaveError(err.message || 'Failed to add leave date');
    } finally {
      setAddingLeave(false);
    }
  };

  const handleDeleteLeave = async (id: string) => {
    try {
      await api.deleteDoctorLeave(id);
      await loadAvailability();
    } catch (err: any) {
      setLeaveError(err.message || 'Failed to remove leave date');
    }
  };

  const handleGenerateAiSoap = async () => {
    if (!completingApt) return;
    setAiSoapLoading(true);
    try {
      const res = await api.generateSoapNotes({
        patientName: completingApt.patientName,
        visitReason: completingApt.reason || 'General medical follow-up',
        clinicalObservations: visitNotes || undefined,
      });

      const formatted = `[AI GENERATED CLINICAL SOAP NOTES]

SUBJECTIVE:
${res.subjective}

OBJECTIVE:
${res.objective}

ASSESSMENT:
${res.assessment}

PLAN:
${res.plan}

${res.recommendedPrescriptions && res.recommendedPrescriptions.length > 0 ? `RECOMMENDED RX:
${res.recommendedPrescriptions.map((p) => `• ${p.drug} (${p.dosage}, ${p.frequency}, ${p.duration})`).join('\n')}` : ''}`;

      setVisitNotes(formatted);
    } catch (err: any) {
      alert('AI SOAP Generation error: ' + (err.message || 'Unable to generate notes'));
    } finally {
      setAiSoapLoading(false);
    }
  };

  // Check if start time has arrived
  const hasVisitStarted = (apt: Appointment): boolean => {
    const now = new Date();
    const [y, m, d] = apt.date.split('-').map(Number);
    const [h, min] = apt.startTime.split(':').map(Number);
    const aptStart = new Date(y, m - 1, d, h, min);
    return now.getTime() >= aptStart.getTime();
  };

  const pendingRequests = appointments.filter((a) => a.status === 'Pending');
  const confirmedAppointments = appointments.filter((a) => a.status === 'Confirmed');
  const todayStr = new Date().toISOString().split('T')[0];
  const todayVisits = appointments.filter((a) => a.date === todayStr && a.status !== 'Cancelled' && a.status !== 'Rejected');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-1">
              <Stethoscope className="w-4 h-4" />
              Doctor Practitioner Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {user?.name}
            </h1>
            <p className="text-sm text-emerald-100/80 mt-1 max-w-xl">
              {user?.specialty || 'General Practitioner'} • Manage consultation requests, set your weekly hours & leave dates, and record clinical notes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-3.5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'requests'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'bg-emerald-800/60 text-white hover:bg-emerald-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              Requests ({pendingRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-3.5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'schedule'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'bg-emerald-800/60 text-white hover:bg-emerald-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Schedule & Visits ({confirmedAppointments.length})
            </button>
            <button
              onClick={() => setActiveTab('availability')}
              className={`px-3.5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'availability'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'bg-emerald-800/60 text-white hover:bg-emerald-800'
              }`}
            >
              <CalendarOff className="w-4 h-4" />
              Hours & Leaves
            </button>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Error: </span>
            {actionError}
          </div>
        </div>
      )}

      {/* TAB 1: PENDING REQUESTS */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Pending Appointment Requests</h2>
              <p className="text-xs text-slate-500">
                Patients have held these 30-min slots. Confirm or reject each request.
              </p>
            </div>
            <button
              onClick={loadAppointments}
              disabled={loadingApts}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingApts ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingApts ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading requests...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-xs font-semibold text-slate-700">No pending requests</p>
              <p className="text-[11px] text-slate-400 mt-0.5">All booking requests have been reviewed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{apt.patientName}</span>
                      <button
                        onClick={() => handleViewPatientHistory(apt.patientId)}
                        className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold underline flex items-center gap-0.5"
                      >
                        <History className="w-3 h-3" /> View History
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-semibold text-slate-900">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" /> {apt.date}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-slate-900">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" /> {formatTime12h(apt.startTime)} – {formatTime12h(apt.endTime)}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Phone className="w-3 h-3" /> {apt.patientPhone}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Mail className="w-3 h-3" /> {apt.patientEmail}
                      </span>
                    </div>

                    {apt.reason && (
                      <p className="text-xs text-slate-700 italic pt-1">
                        Reason for Visit: &quot;{apt.reason}&quot;
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRejectRequest(apt.id)}
                      disabled={actionLoadingId === apt.id}
                      className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleConfirmRequest(apt.id)}
                      disabled={actionLoadingId === apt.id}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirm Booking
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SCHEDULE & VISITS */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Doctor Schedule & Clinical Visits</h2>
              <p className="text-xs text-slate-500">
                Mark visits Completed or No-show once their scheduled time has started, and document clinical notes.
              </p>
            </div>
            <button
              onClick={loadAppointments}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Appointments List */}
          <div className="space-y-3">
            {appointments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                No appointments found for your profile.
              </div>
            ) : (
              appointments.map((apt) => {
                const isConfirmed = apt.status === 'Confirmed';
                const isCompleted = apt.status === 'Completed';
                const isNoShow = apt.status === 'No-show';
                const isCancelled = apt.status === 'Cancelled' || apt.status === 'Rejected';
                const isPending = apt.status === 'Pending';
                const started = hasVisitStarted(apt);

                return (
                  <div
                    key={apt.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{apt.patientName}</span>
                        <button
                          onClick={() => handleViewPatientHistory(apt.patientId)}
                          className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold underline flex items-center gap-0.5"
                        >
                          <History className="w-3 h-3" /> History
                        </button>

                        {/* Badges */}
                        {isConfirmed && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            Confirmed
                          </span>
                        )}
                        {isPending && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            Pending Request
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            Completed
                          </span>
                        )}
                        {isNoShow && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                            No-show
                          </span>
                        )}
                        {isCancelled && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                            {apt.status}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-semibold text-slate-900">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" /> {apt.date}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-slate-900">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" /> {formatTime12h(apt.startTime)} – {formatTime12h(apt.endTime)}
                        </span>
                        <span className="text-slate-500">Phone: {apt.patientPhone}</span>
                      </div>

                      {apt.reason && (
                        <p className="text-xs text-slate-600 italic">Chief Complaint: &quot;{apt.reason}&quot;</p>
                      )}

                      {apt.notes && (
                        <div className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1">
                          <strong>Doctor Notes:</strong> {apt.notes}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isConfirmed && (
                        <>
                          <button
                            onClick={() => handleOpenCompleteModal(apt)}
                            disabled={!started}
                            title={!started ? 'Can only complete once visit start time arrives' : 'Mark completed and enter notes'}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Finish Visit & Notes
                          </button>
                        </>
                      )}

                      {(isCompleted || isNoShow) && (
                        <button
                          onClick={() => handleOpenCompleteModal(apt)}
                          className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Edit Notes
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AVAILABILITY & LEAVE SETTINGS */}
      {activeTab === 'availability' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Hours */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                Weekly Working Hours
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Patients will see 30-minute booking slots generated automatically from these hours.
              </p>
            </div>

            {/* Add Schedule Form */}
            <form onSubmit={handleAddSchedule} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Add Working Hours</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Day of Week</label>
                  <select
                    value={newDayOfWeek}
                    onChange={(e) => setNewDayOfWeek(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.num} value={d.num}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    step="1800"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Time</label>
                  <input
                    type="time"
                    step="1800"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  />
                </div>
              </div>

              {scheduleError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {scheduleError}
                </div>
              )}

              <button
                type="submit"
                disabled={addingSchedule}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Working Hours
              </button>
            </form>

            {/* Current Schedules */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Working Intervals</h3>
              {schedules.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No hours set. Patients will see no slots.</p>
              ) : (
                schedules.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{s.dayName}</span>: {formatTimeRange12h(s.startTime, s.endTime)}
                    </div>
                    <button
                      onClick={() => handleDeleteSchedule(s.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                      title="Remove hours"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leave Days */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-rose-600" />
                Doctor Leave Days
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Adding a leave day marks you unavailable. Any pending/confirmed appointments on that date are cancelled automatically, and patients receive email notifications.
              </p>
            </div>

            {/* Add Leave Form */}
            <form onSubmit={handleAddLeave} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Schedule Leave Date</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Leave Date</label>
                  <input
                    type="date"
                    min={todayStr}
                    value={newLeaveDate}
                    onChange={(e) => setNewLeaveDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Reason (Optional)</label>
                  <input
                    type="text"
                    value={newLeaveReason}
                    onChange={(e) => setNewLeaveReason(e.target.value)}
                    placeholder="E.g., Medical Conference, Vacation"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  />
                </div>
              </div>

              {leaveError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {leaveError}
                </div>
              )}

              {leaveImpactCount !== null && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  Leave marked for <strong>{newLeaveDate}</strong>. Cancelled <strong>{leaveImpactCount}</strong> existing patient booking(s) and dispatched automated emails.
                </div>
              )}

              <button
                type="submit"
                disabled={addingLeave}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Leave Date
              </button>
            </form>

            {/* Current Leaves */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Scheduled Leaves</h3>
              {leaves.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No scheduled leaves.</p>
              ) : (
                leaves.map((l) => (
                  <div
                    key={l.id}
                    className="p-3 bg-white rounded-xl border border-rose-200 flex items-center justify-between text-xs hover:border-rose-300 transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{l.date}</span>: {l.reason || 'Leave'}
                    </div>
                    <button
                      onClick={() => handleDeleteLeave(l.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                      title="Remove leave date"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Complete / No-Show Modal */}
      {completingApt && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Complete Visit & Clinical Record
              </h3>
              <button onClick={() => setCompletingApt(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
              <p>Patient: <strong className="text-slate-900">{completingApt.patientName}</strong></p>
              <p>Scheduled: <strong className="text-slate-900">{completingApt.date} at {completingApt.startTime}</strong></p>
              {completingApt.reason && <p>Chief Complaint: &quot;{completingApt.reason}&quot;</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Clinical Diagnosis, Advice & Notes
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAiSoap}
                  disabled={aiSoapLoading}
                  className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-amber-600 ${aiSoapLoading ? 'animate-spin' : ''}`} />
                  {aiSoapLoading ? 'Generating SOAP...' : 'Auto-Generate SOAP Notes (AI)'}
                </button>
              </div>
              <textarea
                rows={5}
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                placeholder="Enter patient diagnosis, prescribed lifestyle advice, or observations (or click Auto-Generate above)..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-[11px]"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Confidential: Only you and the patient can read these clinical notes.
              </p>
            </div>

            {actionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSubmitComplete(true)}
                disabled={completingLoading}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Mark No-Show
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCompletingApt(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitComplete(false)}
                  disabled={completingLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  {completingLoading ? 'Saving...' : 'Mark Completed & Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient History Modal */}
      {historyPatientId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                Patient Medical History with You
              </h3>
              <button onClick={() => setHistoryPatientId(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-xs text-slate-500">Retrieving patient records...</div>
            ) : historyError ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="font-bold">Access Denied</p>
                  <p>{historyError}</p>
                </div>
              </div>
            ) : patientHistoryData ? (
              <div className="space-y-4 flex-1 overflow-y-auto">
                {patientHistoryData.patient && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-wrap gap-4">
                    <span>Name: <strong className="text-slate-900">{patientHistoryData.patient.name}</strong></span>
                    <span>Email: <strong className="text-slate-900">{patientHistoryData.patient.email}</strong></span>
                    <span>Phone: <strong className="text-slate-900">{patientHistoryData.patient.phone}</strong></span>
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Past Consultations ({patientHistoryData.appointments.length})
                  </h4>

                  {patientHistoryData.appointments.map((apt) => (
                    <div key={apt.id} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{apt.date} at {apt.startTime}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {apt.status}
                        </span>
                      </div>
                      {apt.reason && <p className="text-slate-600">Complaint: {apt.reason}</p>}
                      {apt.notes && (
                        <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100 text-slate-800">
                          <strong>Physician Notes:</strong> {apt.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setHistoryPatientId(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
