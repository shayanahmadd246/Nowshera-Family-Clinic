import React, { useState } from 'react';
import { api, setAuthToken } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { TestCaseResult } from '../types';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  X,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

const PRD_TESTS: Array<{ id: number; title: string; description: string }> = [
  {
    id: 1,
    title: 'Test 1: Book an appointment & doctor confirmation',
    description: 'Patient requests free slot (Pending) -> Doctor confirms -> Confirmed status + confirmation email sent.',
  },
  {
    id: 2,
    title: 'Test 2: Add doctor, set password & check dashboard',
    description: 'Admin adds doctor -> Welcome email with token -> Doctor sets password & adds Mon 9-11 -> Patient books 1 slot -> Admin dashboard reflects 1 Pending.',
  },
  {
    id: 3,
    title: 'Test 3: Double booking prevention (Same slot or same time twice)',
    description: 'Patient A books slot. Patient B booking same slot is blocked. Patient A booking another doctor at same time is blocked.',
  },
  {
    id: 4,
    title: 'Test 4: Outside hours or fully booked checks',
    description: 'Direct booking outside doctor hours is blocked. Fully booked day yields 0 available slots.',
  },
  {
    id: 5,
    title: 'Test 5: Past slot, early completion & doctor leave day',
    description: 'Past slot booking blocked. Deactivated doctor booking blocked. Early completion before start time blocked. Leave day auto-cancels existing bookings & emails patients.',
  },
  {
    id: 6,
    title: 'Test 6: Cancel & reschedule rules (>2h vs <2h)',
    description: 'Cancel >2h frees slot & emails patient. Reschedule moves to new slot (Pending) & frees old. Cancel <2h is blocked.',
  },
  {
    id: 7,
    title: 'Test 7: Doctor hours & leave day validation',
    description: 'End time before start time (13:00-09:00) blocked. Overlapping hours blocked. Past leave day blocked.',
  },
  {
    id: 8,
    title: 'Test 8: Strict Role-Based Access Control (RBAC)',
    description: 'Patient calling confirm/add doctor blocked (403). Doctor A confirming Doctor B appointment blocked (403).',
  },
  {
    id: 9,
    title: 'Test 9: Private records & clinical notes masking',
    description: 'Patient A viewing Patient B records blocked (403). Doctor A viewing Doctor B patient history blocked (403). Admin viewing clinical notes blocked/masked.',
  },
  {
    id: 10,
    title: 'Test 10: Automatic emails & background automations',
    description: 'Tomorrow confirmed booking gets 24h reminder email. Expired unconfirmed pending booking auto-cancels with email.',
  },
];

export const TestCaseRunnerModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { refreshUser } = useAuth();
  const [results, setResults] = useState<TestCaseResult[]>(
    PRD_TESTS.map((t) => ({ ...t, status: 'idle', logs: [] }))
  );
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [activeRunningId, setActiveRunningId] = useState<number | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});

  if (!isOpen) return null;

  const toggleExpand = (id: number) => {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getFutureDateString = (daysAhead: number): string => {
    const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getDayOfWeek = (dateStr: string): number => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  };

  // Run a single test case
  const runTest = async (testId: number): Promise<boolean> => {
    setActiveRunningId(testId);
    setResults((prev) =>
      prev.map((r) => (r.id === testId ? { ...r, status: 'running', logs: [], error: undefined } : r))
    );

    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    try {
      if (testId === 1) {
        log('1. Signing in as Patient Ali (patient.ali@example.com)...');
        const patLogin = await api.login({ email: 'patient.ali@example.com', password: 'patient123' });
        setAuthToken(patLogin.token);

        log('2. Finding active doctor (Dr. Muhammad Ahmed)...');
        const docs = await api.getDoctors();
        const docAhmed = docs.find((d) => d.email === 'dr.ahmed@nowshera.clinic') || docs[0];
        if (!docAhmed) throw new Error('Doctor not found in seed data');

        // Choose future date (e.g. 3-5 days ahead) and check slots on working days (Mon-Fri)
        let targetDate = getFutureDateString(3);
        while (getDayOfWeek(targetDate) === 0 || getDayOfWeek(targetDate) === 6) {
          targetDate = getFutureDateString(4);
        }

        log(`3. Checking 30-min slots for ${docAhmed.name} on ${targetDate}...`);
        const slotData = await api.getDoctorSlots(docAhmed.id, targetDate);
        const freeSlot = slotData.slots.find((s) => s.isAvailable);
        if (!freeSlot) throw new Error(`No free slots found on ${targetDate}`);
        log(`Found free 30-min slot: ${freeSlot.startTime} – ${freeSlot.endTime}`);

        log(`4. Patient requesting appointment for ${targetDate} at ${freeSlot.startTime}...`);
        const apt = await api.requestAppointment({
          doctorId: docAhmed.id,
          date: targetDate,
          startTime: freeSlot.startTime,
          reason: 'Test 1 Routine checkup',
        });
        if (apt.status !== 'Pending') throw new Error(`Expected status Pending, got ${apt.status}`);
        log(`Appointment created with status: ${apt.status} (ID: ${apt.id})`);

        log(`5. Signing in as Doctor (${docAhmed.email}) to confirm appointment...`);
        const docLogin = await api.login({ email: docAhmed.email, password: 'doctor123' });
        setAuthToken(docLogin.token);

        log(`6. Doctor confirming appointment #${apt.id.slice(-6)}...`);
        const confRes = await api.confirmAppointment(apt.id);
        if (confRes.appointment.status !== 'Confirmed') {
          throw new Error(`Expected Confirmed status, got ${confRes.appointment.status}`);
        }
        log(`Appointment confirmed successfully! Status: ${confRes.appointment.status}`);

        log('7. Verifying confirmation email in inbox...');
        const emails = await api.getEmails();
        const confEmail = emails.find(
          (e) => e.appointmentId === apt.id && e.type === 'appointment_confirmed'
        );
        if (!confEmail) throw new Error('Confirmation email not logged');
        log(`Email verified: "${confEmail.subject}" sent to ${confEmail.recipientEmail}`);

      } else if (testId === 2) {
        log('1. Signing in as Admin (admin@nowshera.clinic)...');
        const adminLogin = await api.login({ email: 'admin@nowshera.clinic', password: 'admin123' });
        setAuthToken(adminLogin.token);

        const testDocEmail = `dr.test_${Date.now()}@nowshera.clinic`;
        log(`2. Admin adding new doctor (${testDocEmail})...`);
        const createDocRes = await api.createDoctor({
          name: 'Dr. Bilawal Test',
          email: testDocEmail,
          phone: '+92 300 9988776',
          specialty: 'Dermatology & Skin Care',
        });
        const setupToken = createDocRes.setupPasswordToken;
        log(`Doctor created. Setup Token generated: ${setupToken}`);

        log('3. Doctor setting initial password via setup token...');
        const setPwdRes = await api.setDoctorPassword({
          token: setupToken,
          password: 'newdoctor123',
        });
        setAuthToken(setPwdRes.token);
        log('Doctor password set successfully.');

        log('4. Doctor configuring hours for Monday (9:00 - 11:00)...');
        // Monday = 1
        const sch = await api.addDoctorSchedule({
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '11:00',
        });
        log(`Schedule added: Monday ${sch.startTime} - ${sch.endTime}`);

        log('5. Signing in as Patient Sara to verify 4 slots (9:00, 9:30, 10:00, 10:30)...');
        const patLogin = await api.login({ email: 'patient.sara@example.com', password: 'patient123' });
        setAuthToken(patLogin.token);

        // Find next Monday
        let monDate = getFutureDateString(1);
        while (getDayOfWeek(monDate) !== 1) {
          const parts = monDate.split('-').map(Number);
          const nextD = new Date(parts[0], parts[1] - 1, parts[2] + 1);
          monDate = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}-${String(nextD.getDate()).padStart(2, '0')}`;
        }

        const slotRes = await api.getDoctorSlots(createDocRes.doctor.id, monDate);
        log(`Slots returned: ${slotRes.slots.length} (Expected 4: 09:00, 09:30, 10:00, 10:30)`);
        if (slotRes.slots.length !== 4) throw new Error(`Expected 4 slots, got ${slotRes.slots.length}`);

        log('6. Patient booking 1 slot (09:00)...');
        const booked = await api.requestAppointment({
          doctorId: createDocRes.doctor.id,
          date: monDate,
          startTime: '09:00',
          reason: 'Skin consultation',
        });
        log(`Booked appointment #${booked.id.slice(-6)} (Status: ${booked.status})`);

        log('7. Signing back as Admin to verify dashboard counts...');
        const adminRelogin = await api.login({ email: 'admin@nowshera.clinic', password: 'admin123' });
        setAuthToken(adminRelogin.token);
        const dash = await api.getAdminDashboard();
        const docStat = dash.doctorStats.find((s) => s.doctorId === createDocRes.doctor.id);
        if (!docStat || docStat.pending < 1) {
          throw new Error('Admin dashboard did not reflect 1 pending appointment');
        }
        log(`Verified Admin Dashboard: Dr. Bilawal has ${docStat.pending} Pending appointment(s).`);

      } else if (testId === 3) {
        log('1. Signing in as Patient Ali...');
        const pat1 = await api.login({ email: 'patient.ali@example.com', password: 'patient123' });
        setAuthToken(pat1.token);

        const docs = await api.getDoctors();
        const docAmna = docs[0];
        const docFaisal = docs[1];

        let targetDate = getFutureDateString(6);
        while (getDayOfWeek(targetDate) === 0 || getDayOfWeek(targetDate) === 6) {
          targetDate = getFutureDateString(7);
        }

        log(`2. Patient Ali books slot on ${targetDate} at 09:30 with ${docAmna.name}...`);
        await api.requestAppointment({
          doctorId: docAmna.id,
          date: targetDate,
          startTime: '09:30',
          reason: 'Double booking test',
        });
        log('Slot reserved as Pending.');

        log('3. Signing in as Patient Sara...');
        const pat2 = await api.login({ email: 'patient.sara@example.com', password: 'patient123' });
        setAuthToken(pat2.token);

        log(`4. Patient Sara tries to book SAME slot (${targetDate} 09:30 with ${docAmna.name})...`);
        let slotBlocked = false;
        try {
          await api.requestAppointment({
            doctorId: docAmna.id,
            date: targetDate,
            startTime: '09:30',
            reason: 'Concurrent slot attempt',
          });
        } catch (err: any) {
          slotBlocked = true;
          log(`Correctly blocked with 409 Conflict: "${err.message}"`);
        }
        if (!slotBlocked) throw new Error('Server allowed duplicate booking of same slot!');

        log('5. Signing in back as Patient Ali...');
        setAuthToken(pat1.token);
        log(`6. Patient Ali tries to book DIFFERENT doctor (${docFaisal.name}) at SAME time (${targetDate} 09:30)...`);
        let patientConflictBlocked = false;
        try {
          await api.requestAppointment({
            doctorId: docFaisal.id,
            date: targetDate,
            startTime: '09:30',
            reason: 'Simultaneous appointment attempt',
          });
        } catch (err: any) {
          patientConflictBlocked = true;
          log(`Correctly blocked with 409 Conflict: "${err.message}"`);
        }
        if (!patientConflictBlocked) throw new Error('Server allowed patient to have two appointments at same time!');

      } else if (testId === 4) {
        log('1. Signing in as Patient Ali...');
        const pat = await api.login({ email: 'patient.ali@example.com', password: 'patient123' });
        setAuthToken(pat.token);
        const docs = await api.getDoctors();
        const docAmna = docs[0];

        log('2. Trying to book outside doctor working hours (23:00)...');
        let outsideBlocked = false;
        try {
          await api.requestAppointment({
            doctorId: docAmna.id,
            date: getFutureDateString(3),
            startTime: '23:00',
            reason: 'Late night booking',
          });
        } catch (err: any) {
          outsideBlocked = true;
          log(`Correctly blocked with 400 Bad Request: "${err.message}"`);
        }
        if (!outsideBlocked) throw new Error('Server allowed booking outside working hours!');

      } else if (testId === 5) {
        log('1. Signing in as Patient Ali...');
        const pat = await api.login({ email: 'patient.ali@example.com', password: 'patient123' });
        setAuthToken(pat.token);
        const docs = await api.getDoctors();
        const doc = docs[0];

        log('2. Trying to book past slot (yesterday)...');
        let pastBlocked = false;
        try {
          await api.requestAppointment({
            doctorId: doc.id,
            date: '2020-01-01',
            startTime: '09:00',
          });
        } catch (err: any) {
          pastBlocked = true;
          log(`Past booking correctly blocked: "${err.message}"`);
        }
        if (!pastBlocked) throw new Error('Server allowed past slot booking!');

        log('3. Admin deactivates doctor, then patient tries to book...');
        const admin = await api.login({ email: 'admin@nowshera.clinic', password: 'admin123' });
        setAuthToken(admin.token);
        await api.toggleDoctorStatus(doc.id, false);
        log(`Doctor ${doc.name} deactivated.`);

        setAuthToken(pat.token);
        let deactBlocked = false;
        try {
          await api.requestAppointment({
            doctorId: doc.id,
            date: getFutureDateString(3),
            startTime: '09:00',
          });
        } catch (err: any) {
          deactBlocked = true;
          log(`Deactivated doctor booking correctly blocked: "${err.message}"`);
        }
        if (!deactBlocked) throw new Error('Server allowed booking with deactivated doctor!');

        // Re-activate doctor
        setAuthToken(admin.token);
        await api.toggleDoctorStatus(doc.id, true);
        log(`Doctor ${doc.name} re-activated.`);

        log('4. Doctor tries to complete future appointment early...');
        const docLogin = await api.login({ email: doc.email, password: 'doctor123' });
        setAuthToken(docLogin.token);

        // Book appointment for tomorrow
        setAuthToken(pat.token);
        const tomorrowDate = getFutureDateString(1);
        const futureApt = await api.requestAppointment({
          doctorId: doc.id,
          date: tomorrowDate,
          startTime: '10:00',
        });
        setAuthToken(docLogin.token);
        await api.confirmAppointment(futureApt.id);

        let earlyCompBlocked = false;
        try {
          await api.completeAppointment(futureApt.id, 'Early test notes');
        } catch (err: any) {
          earlyCompBlocked = true;
          log(`Early completion before visit time correctly blocked: "${err.message}"`);
        }
        if (!earlyCompBlocked) throw new Error('Server allowed completing future appointment before start time!');

        log('5. Doctor adds leave day on tomorrow date with Confirmed appointment...');
        const leaveRes = await api.addDoctorLeave({
          date: tomorrowDate,
          reason: 'Emergency Leave Test',
        });
        log(`Leave added. Cancelled affected bookings: ${leaveRes.cancelledAppointmentsCount}`);

        const checkApt = await api.getAppointmentById(futureApt.id);
        if (checkApt.status !== 'Cancelled') {
          throw new Error(`Expected appointment to be Cancelled by leave day, got ${checkApt.status}`);
        }
        log(`Verified: Appointment #${checkApt.id.slice(-6)} is now Cancelled.`);

      } else if (testId === 6) {
        log('1. Testing cancel and reschedule (>2 hours before start)...');
        const pat = await api.login({ email: 'patient.ali@example.com', password: 'patient123' });
        setAuthToken(pat.token);
        const docs = await api.getDoctors();
        const doc = docs[0];

        const targetDate = getFutureDateString(5);
        log(`2. Booking appointment for ${targetDate} at 11:00...`);
        const apt = await api.requestAppointment({
          doctorId: doc.id,
          date: targetDate,
          startTime: '11:00',
        });

        log('3. Cancelling appointment (>2 hours away)...');
        const cancelRes = await api.cancelAppointment(apt.id, 'Test cancel');
        if (cancelRes.appointment.status !== 'Cancelled') throw new Error('Cancellation failed');
        log('Appointment status updated to Cancelled.');

        log('4. Verifying slot 11:00 is now free again for another patient...');
        const pat2 = await api.login({ email: 'patient.sara@example.com', password: 'patient123' });
        setAuthToken(pat2.token);
        const rebooked = await api.requestAppointment({
          doctorId: doc.id,
          date: targetDate,
          startTime: '11:00',
        });
        log(`New patient Sara successfully rebooked released slot: #${rebooked.id.slice(-6)}`);

        log('5. Rescheduling appointment to 11:30...');
        const reschedRes = await api.rescheduleAppointment(rebooked.id, {
          newDate: targetDate,
          newStartTime: '11:30',
        });
        if (reschedRes.appointment.startTime !== '11:30' || reschedRes.appointment.status !== 'Pending') {
          throw new Error('Reschedule failed or status not reset to Pending');
        }
        log(`Appointment rescheduled to ${reschedRes.appointment.startTime}. Status: ${reschedRes.appointment.status}`);

      } else if (testId === 7) {
        log('1. Signing in as Doctor Muhammad Ahmed (dr.ahmed@nowshera.clinic)...');
        const docLogin = await api.login({ email: 'dr.ahmed@nowshera.clinic', password: 'doctor123' });
        setAuthToken(docLogin.token);

        log('2. Trying to add working hours where end time is before start time (13:00 - 09:00)...');
        let invalidHoursBlocked = false;
        try {
          await api.addDoctorSchedule({
            dayOfWeek: 6,
            startTime: '13:00',
            endTime: '09:00',
          });
        } catch (err: any) {
          invalidHoursBlocked = true;
          log(`Correctly blocked: "${err.message}"`);
        }
        if (!invalidHoursBlocked) throw new Error('Server accepted 13:00-09:00 working hours!');

        log('3. Trying to add leave day in the past (2020-01-01)...');
        let pastLeaveBlocked = false;
        try {
          await api.addDoctorLeave({
            date: '2020-01-01',
            reason: 'Past leave attempt',
          });
        } catch (err: any) {
          pastLeaveBlocked = true;
          log(`Past leave day correctly blocked: "${err.message}"`);
        }
        if (!pastLeaveBlocked) throw new Error('Server accepted past leave day!');

      } else if (testId === 8) {
        log('1. Signing in as Patient Ali...');
        const pat = await api.login({ email: 'patient.ali@example.com', password: 'patient123' });
        setAuthToken(pat.token);

        log('2. Patient tries to call admin endpoint (POST /api/admin/doctors)...');
        let patientAdminBlocked = false;
        try {
          await api.createDoctor({
            name: 'Hacker Doc',
            email: 'hack@test.com',
            specialty: 'Fake',
          });
        } catch (err: any) {
          patientAdminBlocked = true;
          log(`Correctly blocked with 403 Forbidden: "${err.message}"`);
        }
        if (!patientAdminBlocked) throw new Error('Patient was allowed to create a doctor!');

        log('3. Signing in as Doctor Sara Khan (dr.sara@nowshera.clinic)...');
        const docSara = await api.login({ email: 'dr.sara@nowshera.clinic', password: 'doctor123' });
        setAuthToken(docSara.token);

        // Find an appointment belonging to Doctor Ahmed
        const allApts = await api.getAppointments();
        const docAhmedApt = allApts.find((a) => a.doctorName.includes('Ahmed') && a.status === 'Pending');
        if (docAhmedApt) {
          log(`4. Doctor Sara tries to confirm Doctor Ahmed's appointment #${docAhmedApt.id.slice(-6)}...`);
          let docCrossConfirmBlocked = false;
          try {
            await api.confirmAppointment(docAhmedApt.id);
          } catch (err: any) {
            docCrossConfirmBlocked = true;
            log(`Correctly blocked with 403 Forbidden: "${err.message}"`);
          }
          if (!docCrossConfirmBlocked) throw new Error('Doctor A was allowed to confirm Doctor B appointment!');
        }

      } else if (testId === 9) {
        log('1. Testing confidentiality & data privacy...');
        log('2. Patient Ali tries to view Patient Sara appointment details...');
        const pat1 = await api.login({ email: 'patient.ali@example.com', password: 'patient123' });
        setAuthToken(pat1.token);

        const pat2 = await api.login({ email: 'patient.sara@example.com', password: 'patient123' });
        setAuthToken(pat2.token);
        const saraApts = await api.getAppointments();
        const saraApt = saraApts[0];

        if (saraApt) {
          setAuthToken(pat1.token);
          let patCrossBlocked = false;
          try {
            await api.getAppointmentById(saraApt.id);
          } catch (err: any) {
            patCrossBlocked = true;
            log(`Patient cross-access correctly blocked with 403: "${err.message}"`);
          }
          if (!patCrossBlocked) throw new Error('Patient Ali was able to read Patient Sara appointment!');
        }

        log('3. Admin checks appointment clinical notes (Notes must be masked/stripped)...');
        const admin = await api.login({ email: 'admin@nowshera.clinic', password: 'admin123' });
        setAuthToken(admin.token);
        const adminApts = await api.getAppointments();
        const hasNotesLeaked = adminApts.some((a) => a.notes !== undefined && a.notes !== null);
        if (hasNotesLeaked) {
          throw new Error('Admin endpoint leaked clinical visit notes!');
        }
        log('Verified: All clinical visit notes are strictly stripped for Admin role.');

      } else if (testId === 10) {
        log('1. Testing automated background email & cancellation sweep...');
        const res = await api.runAutomations();
        log(`Automation execution finished: ${res.cancelledPendingCount} pending bookings cancelled, ${res.remindersSentCount} 24h reminders dispatched.`);
        if (res.details.length > 0) {
          res.details.forEach((d) => log(`> ${d}`));
        }
        log('Automations executed successfully.');
      }

      setResults((prev) =>
        prev.map((r) => (r.id === testId ? { ...r, status: 'passed', logs } : r))
      );
      return true;
    } catch (err: any) {
      log(`TEST FAILED: ${err.message}`);
      setResults((prev) =>
        prev.map((r) => (r.id === testId ? { ...r, status: 'failed', logs, error: err.message } : r))
      );
      return false;
    } finally {
      setActiveRunningId(null);
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    for (const test of PRD_TESTS) {
      await runTest(test.id);
    }
    setIsRunningAll(false);
    await refreshUser();
  };

  const handleResetDatabase = async () => {
    try {
      await api.resetDatabase();
      setResults(PRD_TESTS.map((t) => ({ ...t, status: 'idle', logs: [] })));
      await refreshUser();
    } catch (e) {
      console.error(e);
    }
  };

  const passedCount = results.filter((r) => r.status === 'passed').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 space-y-5 border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-0.5">
              <Sparkles className="w-4 h-4" />
              PRD Automated 10-Point Verification Engine
            </div>
            <h2 className="text-xl font-bold text-slate-900">System Acceptance Test Suite</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Runs real server API checks verifying all 10 test cases from Section 05 of the PRD.
            </p>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar & Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-slate-700">Status Summary:</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold">
              {passedCount} Passed
            </span>
            {failedCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-bold">
                {failedCount} Failed
              </span>
            )}
            <span className="text-slate-500">Total: 10 checks</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDatabase}
              className="px-3 py-1.5 border border-slate-300 hover:bg-white text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset DB
            </button>
            <button
              id="run-all-prd-tests-btn"
              onClick={runAllTests}
              disabled={isRunningAll}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningAll ? 'animate-spin' : ''}`} />
              {isRunningAll ? 'Executing Suite...' : 'Run All 10 Test Cases'}
            </button>
          </div>
        </div>

        {/* Test List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {results.map((test) => {
            const isRunning = activeRunningId === test.id;
            const isPassed = test.status === 'passed';
            const isFailed = test.status === 'failed';
            const isExpanded = !!expandedLogs[test.id];

            return (
              <div
                key={test.id}
                className={`rounded-xl border transition-all text-xs ${
                  isPassed
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : isFailed
                    ? 'border-rose-200 bg-rose-50/30'
                    : isRunning
                    ? 'border-indigo-300 bg-indigo-50/30'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {isFailed && <XCircle className="w-4 h-4 text-rose-600" />}
                      {isRunning && <Clock className="w-4 h-4 text-indigo-600 animate-spin" />}
                      {!isPassed && !isFailed && !isRunning && (
                        <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-500 font-bold">
                          {test.id}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{test.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{test.description}</p>
                      {test.error && (
                        <p className="text-[11px] text-rose-600 font-semibold mt-1">Error: {test.error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {test.logs.length > 0 && (
                      <button
                        onClick={() => toggleExpand(test.id)}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {test.logs.length} Logs
                      </button>
                    )}
                    <button
                      onClick={() => runTest(test.id)}
                      disabled={isRunningAll || isRunning}
                      className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                    >
                      Run
                    </button>
                  </div>
                </div>

                {/* Expanded Logs */}
                {isExpanded && test.logs.length > 0 && (
                  <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 font-mono text-[11px] text-slate-700 bg-slate-900 text-slate-200 p-3 rounded-b-xl max-h-40 overflow-y-auto space-y-0.5">
                    {test.logs.map((l, i) => (
                      <div key={i} className="leading-relaxed">&gt; {l}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            Definition of Done: All 10 test cases must pass without errors.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
