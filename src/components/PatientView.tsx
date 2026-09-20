import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { User, Appointment, TimeSlot, DoctorSchedule, AiSymptomTriageResult } from '../types';
import { formatTime12h, formatTimeRange12h } from '../lib/timeUtils';
import {
  Calendar,
  Clock,
  UserCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  CalendarDays,
  Stethoscope,
  Phone,
  CalendarX,
  Shield,
  Check,
  Users,
  Sparkles,
  Zap,
} from 'lucide-react';

export const PatientView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'book' | 'directory' | 'my-appointments'>('book');

  // Booking state
  const [doctors, setDoctors] = useState<User[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [manualSlotInput, setManualSlotInput] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<Appointment | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // AI Triage State
  const [aiTriageResult, setAiTriageResult] = useState<AiSymptomTriageResult | null>(null);
  const [aiTriageLoading, setAiTriageLoading] = useState(false);

  // Doctors Weekly Schedules for Directory View
  const [doctorSchedulesMap, setDoctorSchedulesMap] = useState<Record<string, DoctorSchedule[]>>({});
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Action Modals
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [reschedulingAppointment, setReschedulingAppointment] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<string | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const [viewingNotesAppointment, setViewingNotesAppointment] = useState<Appointment | null>(null);

  // Load doctors
  const loadDoctors = async () => {
    try {
      const data = await api.getDoctors();
      setDoctors(data);
      const activeDocs = data.filter((d) => d.isActive !== false);
      if (activeDocs.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(activeDocs[0].id);
      }
    } catch (err) {
      console.error('Failed to load doctors', err);
    }
  };

  // Load schedules for Directory
  const loadDirectorySchedules = async () => {
    setLoadingDirectory(true);
    try {
      const docs = await api.getDoctors();
      setDoctors(docs);
      const map: Record<string, DoctorSchedule[]> = {};
      await Promise.all(
        docs.map(async (doc) => {
          try {
            const schs = await api.getDoctorSchedules(doc.id);
            map[doc.id] = schs;
          } catch (e) {
            map[doc.id] = [];
          }
        })
      );
      setDoctorSchedulesMap(map);
    } catch (err) {
      console.error('Failed to load directory schedules', err);
    } finally {
      setLoadingDirectory(false);
    }
  };

  // Load slots for selected doctor & date
  const loadSlots = async () => {
    if (!selectedDoctorId || !selectedDate) return;
    setSlotsLoading(true);
    setSlotsMessage(null);
    setSelectedSlot(null);
    setBookingError(null);
    try {
      const res = await api.getDoctorSlots(selectedDoctorId, selectedDate);
      setSlots(res.slots || []);
      setSlotsMessage(res.message || null);
    } catch (err: any) {
      setSlotsMessage(err.message || 'Failed to calculate available slots.');
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  // Load patient appointments
  const loadAppointments = async () => {
    if (!user) return;
    setAppointmentsLoading(true);
    try {
      const data = await api.getAppointments();
      setAppointments(data);
    } catch (err) {
      console.error('Failed to load appointments', err);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    if (activeTab === 'directory') {
      loadDirectorySchedules();
    } else if (activeTab === 'my-appointments') {
      loadAppointments();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedDoctorId && selectedDate) {
      loadSlots();
    }
  }, [selectedDoctorId, selectedDate]);

  // Handle appointment submission
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDate || !selectedSlot) {
      setBookingError('Please select a doctor, date, and available time slot.');
      return;
    }

    setBookingLoading(true);
    setBookingError(null);
    try {
      const created = await api.requestAppointment({
        doctorId: selectedDoctorId,
        date: selectedDate,
        startTime: selectedSlot,
        reason,
      });

      setBookingSuccess(created);
      setReason('');
      setSelectedSlot(null);
      await loadSlots();
      await loadAppointments();
    } catch (err: any) {
      setBookingError(err.message || 'Could not request appointment. Slot may have been taken.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Reschedule Slots loader
  const loadRescheduleSlots = async (docId: string, date: string) => {
    if (!docId || !date) return;
    setRescheduleSlotsLoading(true);
    setRescheduleError(null);
    try {
      const res = await api.getDoctorSlots(docId, date);
      setRescheduleSlots(res.slots || []);
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to load slots');
      setRescheduleSlots([]);
    } finally {
      setRescheduleSlotsLoading(false);
    }
  };

  const handleOpenReschedule = (apt: Appointment) => {
    setReschedulingAppointment(apt);
    setRescheduleDate(apt.date);
    setRescheduleSelectedSlot(null);
    setRescheduleError(null);
    loadRescheduleSlots(apt.doctorId, apt.date);
  };

  const handleConfirmReschedule = async () => {
    if (!reschedulingAppointment || !rescheduleDate || !rescheduleSelectedSlot) {
      setRescheduleError('Please choose a date and time slot.');
      return;
    }
    setRescheduleLoading(true);
    setRescheduleError(null);
    try {
      await api.rescheduleAppointment(reschedulingAppointment.id, {
        newDate: rescheduleDate,
        newStartTime: rescheduleSelectedSlot,
      });
      setReschedulingAppointment(null);
      await loadAppointments();
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to reschedule appointment');
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingAppointment) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      await api.cancelAppointment(cancellingAppointment.id, cancelReason || 'Patient cancelled');
      setCancellingAppointment(null);
      setCancelReason('');
      await loadAppointments();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel appointment');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleAiTriage = async () => {
    if (!reason.trim()) {
      alert('Please enter your symptoms or reason for visit first.');
      return;
    }
    setAiTriageLoading(true);
    try {
      const res = await api.triageSymptoms({ symptoms: reason });
      setAiTriageResult(res);

      // Auto-match doctor if recommended
      if (res.recommendedDoctorName || res.specialty) {
        const matched = doctors.find((d) =>
          (res.recommendedDoctorName && d.name.toLowerCase().includes(res.recommendedDoctorName.toLowerCase())) ||
          (res.specialty && d.specialty?.toLowerCase().includes(res.specialty.toLowerCase()))
        );
        if (matched && matched.isActive !== false) {
          setSelectedDoctorId(matched.id);
        }
      }
    } catch (err: any) {
      console.error('AI Triage error:', err);
    } finally {
      setAiTriageLoading(false);
    }
  };

  // Check if appointment is within 2 hours of start time
  const isWithinTwoHours = (apt: Appointment): boolean => {
    const now = new Date();
    const [y, m, d] = apt.date.split('-').map(Number);
    const [h, min] = apt.startTime.split(':').map(Number);
    const aptStart = new Date(y, m - 1, d, h, min);
    const diffHours = (aptStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours < 2;
  };

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  const filteredAppointments = appointments.filter((apt) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return apt.status === 'Pending' || apt.status === 'Confirmed';
    if (statusFilter === 'completed') return apt.status === 'Completed';
    if (statusFilter === 'cancelled') return apt.status === 'Cancelled' || apt.status === 'Rejected';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-1">
              <Stethoscope className="w-4 h-4" />
              Nowshera Family Clinic • Patient Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome, {user?.name || 'Patient'}
            </h1>
            <p className="text-sm text-teal-100/80 mt-1 max-w-2xl">
              Book consultations with our 5 resident medical specialists, explore verified weekly schedules, and manage your clinical visits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="tab-book-btn"
              onClick={() => setActiveTab('book')}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'book'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'bg-teal-900/60 text-white hover:bg-teal-900/90'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Book Appointment
            </button>
            <button
              id="tab-directory-btn"
              onClick={() => setActiveTab('directory')}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'directory'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'bg-teal-900/60 text-white hover:bg-teal-900/90'
              }`}
            >
              <Users className="w-4 h-4" />
              Doctors Directory
            </button>
            <button
              id="tab-my-appointments-btn"
              onClick={() => setActiveTab('my-appointments')}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === 'my-appointments'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'bg-teal-900/60 text-white hover:bg-teal-900/90'
              }`}
            >
              <FileText className="w-4 h-4" />
              My Appointments ({appointments.length})
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: BOOK APPOINTMENT */}
      {activeTab === 'book' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Doctor Selection & Details */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-teal-600" />
                  1. Select Doctor
                </h2>
                <span className="text-xs text-slate-500 font-semibold">{doctors.length} Doctors</span>
              </div>

              <div className="space-y-2.5">
                {doctors.map((doc) => {
                  const isSelected = doc.id === selectedDoctorId;
                  const isInactive = doc.isActive === false;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => {
                        if (!isInactive) {
                          setSelectedDoctorId(doc.id);
                          setBookingSuccess(null);
                        }
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between ${
                        isInactive
                          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'border-teal-500 bg-teal-50/50 shadow-xs ring-1 ring-teal-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                            isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Stethoscope className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            {doc.name}
                            {isInactive && (
                              <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-semibold">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-teal-700 font-medium">{doc.specialty}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {doc.phone}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                          isSelected
                            ? 'bg-teal-600 text-white'
                            : isInactive
                            ? 'bg-slate-200 text-slate-500'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'Selected' : isInactive ? 'Inactive' : 'Select'}
                      </span>
                    </div>
                  );
                })}

                {doctors.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500">Loading doctors...</div>
                )}
              </div>
            </div>

            {/* Doctor Info & Policy Card */}
            {selectedDoctor && (
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-xs text-slate-600 space-y-2.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                  <Shield className="w-4 h-4 text-teal-600" />
                  Selected Practitioner Information
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <p className="text-slate-900 font-bold text-xs">{selectedDoctor.name}</p>
                  <p className="text-teal-700 font-semibold">{selectedDoctor.specialty}</p>
                  <p className="text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedDoctor.phone}</p>
                </div>
                <div className="space-y-1 text-[11px] text-slate-500 pt-1">
                  <p>• Every working period is divided into <strong>30-minute appointment slots</strong>.</p>
                  <p>• Patients can only select slots that fall inside the doctor&apos;s working hours.</p>
                  <p>• The ending time of a shift is not bookable.</p>
                  <p>• Slots are immediately reserved in <strong>Pending</strong> status until confirmed.</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Date & Slot Selection & Request Form */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-teal-600" />
                  2. Choose Date & Available 30-Minute Slot
                </h2>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Appointment Date</label>
                    <input
                      id="appointment-date-picker"
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setBookingSuccess(null);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={loadSlots}
                    disabled={slotsLoading}
                    className="self-end px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${slotsLoading ? 'animate-spin' : ''}`} />
                    Refresh Slots
                  </button>
                </div>
              </div>

              {/* Slot Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-800">
                      {selectedDoctor ? selectedDoctor.name : 'Doctor'} —{' '}
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </label>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-teal-500" /> Available
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-300" /> Booked / Past
                    </span>
                  </div>
                </div>

                {slotsLoading ? (
                  <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                    Checking doctor working hours & reservations...
                  </div>
                ) : slotsMessage && slots.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        {slotsMessage.toLowerCase().includes('leave') ? 'Doctor on Leave' : 'No Scheduled Hours'}
                      </p>
                      <p>{slotsMessage}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {slots.map((slot) => {
                        const isSelected = selectedSlot === slot.startTime;
                        const formattedTime = formatTime12h(slot.startTime);
                        const isPatientConflict = slot.reasonUnavailable?.toLowerCase().includes('you have an appointment') || slot.reasonUnavailable?.toLowerCase().includes('you already booked');
                        const isBooked = !isPatientConflict && (slot.reasonUnavailable?.toLowerCase().includes('booked') || slot.reasonUnavailable?.toLowerCase().includes('already'));
                        const isPast = slot.reasonUnavailable?.toLowerCase().includes('passed');

                        return (
                          <button
                            key={slot.startTime}
                            type="button"
                            disabled={!slot.isAvailable}
                            onClick={() => setSelectedSlot(slot.startTime)}
                            title={slot.reasonUnavailable || undefined}
                            className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                              isSelected
                                ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-500 ring-offset-1 font-bold'
                                : slot.isAvailable
                                ? 'bg-white hover:bg-teal-50 border-teal-200 text-slate-900 shadow-2xs'
                                : isPatientConflict
                                ? 'bg-amber-50/70 border-amber-300 text-amber-900 cursor-not-allowed'
                                : isBooked
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                                : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                            }`}
                          >
                            <span className="font-bold text-xs">
                              {formattedTime}
                            </span>
                            <span
                              className={`text-[10px] mt-1 px-1.5 py-0.5 rounded font-semibold ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : slot.isAvailable
                                  ? 'bg-teal-50 text-teal-700'
                                  : isPatientConflict
                                  ? 'bg-amber-100 text-amber-800'
                                  : isBooked
                                  ? 'bg-rose-50 text-rose-600'
                                  : isPast
                                  ? 'bg-slate-200 text-slate-500'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {isSelected
                                ? 'Selected'
                                : slot.isAvailable
                                ? 'Available'
                                : isPatientConflict
                                ? 'Your Conflict'
                                : isBooked
                                ? 'Booked'
                                : isPast
                                ? 'Past'
                                : 'Unavailable'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {slots.some((s) => s.reasonUnavailable?.toLowerCase().includes('you have an appointment')) && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>Slots marked &quot;Your Conflict&quot; cannot be booked because you already have an appointment scheduled with another doctor at that time.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Manual Time Slot Input Feature */}
              <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    Or Type / Enter Manual Time Slot (Custom Time)
                  </label>
                  {selectedSlot && (
                    <span className="text-[11px] font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                      Selected: {formatTime12h(selectedSlot)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={manualSlotInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualSlotInput(val);
                      if (val) {
                        setSelectedSlot(val);
                      }
                    }}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (manualSlotInput) {
                        setSelectedSlot(manualSlotInput);
                      }
                    }}
                    className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-2xs"
                  >
                    Set Manual Slot
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  You can select a preset 30-minute slot above or type any custom time slot manually (e.g. 10:15).
                </p>
              </div>

              {/* Booking Request Form */}
              <form onSubmit={handleBookAppointment} className="border-t border-slate-200 pt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Reason for Visit / Symptoms
                    </label>
                    <button
                      type="button"
                      onClick={handleAiTriage}
                      disabled={aiTriageLoading || !reason.trim()}
                      className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-amber-600 ${aiTriageLoading ? 'animate-spin' : ''}`} />
                      {aiTriageLoading ? 'Triage in Progress...' : 'AI Doctor Match & Triage'}
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="E.g., High fever for 2 days with rash, chest tightness and shortness of breath, acne flare up..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* AI Triage Card */}
                {aiTriageResult && (
                  <div className="p-3.5 bg-gradient-to-r from-amber-50 via-teal-50/40 to-blue-50/40 border border-amber-300/80 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        AI Clinical Triage Assessment ({Math.round(aiTriageResult.confidence * 100)}% match)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          aiTriageResult.urgencyLevel === 'Emergency'
                            ? 'bg-rose-100 text-rose-800'
                            : aiTriageResult.urgencyLevel === 'Priority'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        Urgency: {aiTriageResult.urgencyLevel}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed">{aiTriageResult.explanation}</p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60 text-[11px]">
                      <span className="font-semibold text-slate-600">Recommended Specialist:</span>
                      <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                        {aiTriageResult.recommendedDoctorName}
                      </span>
                      {aiTriageResult.specialty && (
                        <span className="text-slate-500 font-medium">({aiTriageResult.specialty})</span>
                      )}
                    </div>

                    {aiTriageResult.suggestedPreparation && aiTriageResult.suggestedPreparation.length > 0 && (
                      <div className="pt-1 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700">Prepare for visit: </span>
                        {aiTriageResult.suggestedPreparation.join(' • ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {bookingError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Booking Blocked: </span>
                      {bookingError}
                    </div>
                  </div>
                )}

                {/* Success Banner */}
                {bookingSuccess && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                    <div className="font-bold text-emerald-800 flex items-center gap-1.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Appointment Requested Successfully!
                    </div>
                    <p>
                      Your slot for <strong>{bookingSuccess.date}</strong> at <strong>{formatTime12h(bookingSuccess.startTime)}</strong> with <strong>{bookingSuccess.doctorName}</strong> is reserved and awaiting doctor confirmation.
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      An email notification has been dispatched to {bookingSuccess.patientEmail}.
                    </p>
                  </div>
                )}

                <button
                  id="confirm-booking-btn"
                  type="submit"
                  disabled={bookingLoading || !selectedSlot}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {bookingLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Holding Slot & Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {selectedSlot
                        ? `Confirm & Request Slot (${formatTime12h(selectedSlot)})`
                        : 'Select an Available Slot Above'}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOCTORS DIRECTORY (Public Doctors Page) */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="border-b border-slate-200 pb-4 mb-6">
              <h2 className="text-lg font-bold text-slate-900">Nowshera Family Clinic Medical Staff</h2>
              <p className="text-xs text-slate-500">
                Complete weekly availability schedules and 30-minute consultation slots for our 5 licensed practitioners.
              </p>
            </div>

            {loadingDirectory ? (
              <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                Loading doctors & schedules...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {doctors.map((doc, idx) => {
                  const docSchedules = doctorSchedulesMap[doc.id] || [];
                  return (
                    <div
                      key={doc.id}
                      className="bg-slate-50/70 rounded-2xl border border-slate-200 p-5 flex flex-col justify-between space-y-4 hover:border-teal-300 transition-all shadow-2xs"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                              {idx + 1}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm">{doc.name}</h3>
                              <p className="text-xs font-semibold text-teal-700">{doc.specialty}</p>
                              <p className="text-[11px] text-slate-500">{doc.phone}</p>
                            </div>
                          </div>
                          {doc.isActive !== false ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                              Inactive
                            </span>
                          )}
                        </div>

                        <div className="border-t border-slate-200 pt-3">
                          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                            Weekly Availability Schedule:
                          </p>

                          {docSchedules.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No schedules set.</p>
                          ) : (
                            <div className="space-y-1.5 text-xs">
                              {docSchedules
                                .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                                .map((s) => (
                                  <div
                                    key={s.id}
                                    className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-white border border-slate-200"
                                  >
                                    <span className="font-semibold text-slate-800">{s.dayName}</span>
                                    <span className="text-teal-700 font-medium">
                                      {formatTimeRange12h(s.startTime, s.endTime)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedDoctorId(doc.id);
                          setActiveTab('book');
                        }}
                        disabled={doc.isActive === false}
                        className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1.5"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Book with {doc.name.split(' ')[1] || 'Doctor'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MY APPOINTMENTS */}
      {activeTab === 'my-appointments' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">My Appointments History</h2>
              <p className="text-xs text-slate-500">Track pending confirmations, upcoming visits, and completed medical notes.</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({appointments.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'active' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'completed' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setStatusFilter('cancelled')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === 'cancelled' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancelled
              </button>
            </div>
          </div>

          {appointmentsLoading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
              Loading appointments...
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">No appointments found</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
                You do not have any appointments under this filter.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((apt) => {
                const isPending = apt.status === 'Pending';
                const isConfirmed = apt.status === 'Confirmed';
                const isCompleted = apt.status === 'Completed';
                const isCancelled = apt.status === 'Cancelled' || apt.status === 'Rejected';
                const isNoShow = apt.status === 'No-show';
                const tooLateToCancel = isWithinTwoHours(apt);

                return (
                  <div
                    key={apt.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{apt.doctorName}</span>
                        <span className="text-xs text-teal-700 font-medium">({apt.doctorSpecialty})</span>

                        {/* Status Badges */}
                        {isPending && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending Review
                          </span>
                        )}
                        {isConfirmed && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Confirmed
                          </span>
                        )}
                        {isCompleted && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Completed
                          </span>
                        )}
                        {isCancelled && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> {apt.status}
                          </span>
                        )}
                        {isNoShow && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> No-show
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-medium text-slate-900">
                          <Calendar className="w-3.5 h-3.5 text-teal-600" />
                          {apt.date}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-slate-900">
                          <Clock className="w-3.5 h-3.5 text-teal-600" />
                          {formatTime12h(apt.startTime)} – {formatTime12h(apt.endTime)} (30 min)
                        </span>
                        {apt.reason && (
                          <span className="text-slate-500 italic">
                            Reason: &quot;{apt.reason}&quot;
                          </span>
                        )}
                      </div>

                      {apt.cancellationReason && (
                        <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-100">
                          <strong>Cancellation Note:</strong> {apt.cancellationReason}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isCompleted && apt.notes && (
                        <button
                          onClick={() => setViewingNotesAppointment(apt)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Doctor Notes
                        </button>
                      )}

                      {(isPending || isConfirmed) && (
                        <>
                          <button
                            onClick={() => handleOpenReschedule(apt)}
                            disabled={tooLateToCancel}
                            title={tooLateToCancel ? 'Cannot reschedule less than 2 hours before start' : 'Move to a different slot'}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => {
                              setCancellingAppointment(apt);
                              setCancelReason('');
                              setCancelError(null);
                            }}
                            disabled={tooLateToCancel}
                            title={tooLateToCancel ? 'Cannot cancel less than 2 hours before start' : 'Cancel appointment'}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cancel Modal */}
      {cancellingAppointment && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarX className="w-5 h-5 text-rose-600" />
                Cancel Appointment
              </h3>
              <button
                onClick={() => setCancellingAppointment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to cancel your appointment with <strong>{cancellingAppointment.doctorName}</strong> on <strong>{cancellingAppointment.date}</strong> at <strong>{formatTime12h(cancellingAppointment.startTime)}</strong>?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for cancellation (Optional)</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="E.g., Schedule conflict, feeling better..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {cancelError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {cancelError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingAppointment(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedulingAppointment && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                Reschedule Appointment
              </h3>
              <button
                onClick={() => setReschedulingAppointment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Current slot: <strong>{reschedulingAppointment.date} at {formatTime12h(reschedulingAppointment.startTime)}</strong> with <strong>{reschedulingAppointment.doctorName}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select New Date</label>
              <input
                type="date"
                value={rescheduleDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setRescheduleDate(e.target.value);
                  loadRescheduleSlots(reschedulingAppointment.doctorId, e.target.value);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select New 30-Minute Slot</label>
              {rescheduleSlotsLoading ? (
                <div className="py-4 text-center text-xs text-slate-500">Checking availability...</div>
              ) : rescheduleSlots.length === 0 ? (
                <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-500 text-center">
                  No available slots on this date.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                  {rescheduleSlots.map((slot) => {
                    const isSelected = rescheduleSelectedSlot === slot.startTime;
                    const isPatientConflict = slot.reasonUnavailable?.toLowerCase().includes('you have an appointment') || slot.reasonUnavailable?.toLowerCase().includes('you already booked');
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        disabled={!slot.isAvailable}
                        onClick={() => setRescheduleSelectedSlot(slot.startTime)}
                        title={slot.reasonUnavailable || undefined}
                        className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 ring-2 ring-teal-500'
                            : slot.isAvailable
                            ? 'bg-white hover:bg-teal-50 border-slate-300 text-slate-800'
                            : isPatientConflict
                            ? 'bg-amber-50 text-amber-800 border-amber-200 cursor-not-allowed'
                            : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <div>{formatTime12h(slot.startTime)}</div>
                        {!slot.isAvailable && isPatientConflict && (
                          <div className="text-[9px] font-normal text-amber-700 truncate">Conflict</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {rescheduleError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {rescheduleError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReschedulingAppointment(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep Current Slot
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={rescheduleLoading || !rescheduleSelectedSlot}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                {rescheduleLoading ? 'Updating...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Notes Viewer Modal */}
      {viewingNotesAppointment && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                Doctor Visit Clinical Notes
              </h3>
              <button
                onClick={() => setViewingNotesAppointment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>Doctor: <strong className="text-slate-800">{viewingNotesAppointment.doctorName}</strong> ({viewingNotesAppointment.doctorSpecialty})</p>
              <p>Date & Time: <strong className="text-slate-800">{viewingNotesAppointment.date} at {formatTime12h(viewingNotesAppointment.startTime)}</strong></p>
            </div>

            <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-xl text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              <span className="font-bold text-teal-900 block mb-1">Clinical Record & Advice:</span>
              {viewingNotesAppointment.notes || 'No notes were recorded for this visit.'}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingNotesAppointment(null)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Close Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
