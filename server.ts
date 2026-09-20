import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db, hashPassword, sqliteDb } from './src/server/db.js';
import {
  authenticate,
  requireRole,
  createToken,
  AuthenticatedRequest,
} from './src/server/auth.js';
import {
  runAutomations,
  startAutomationWorker,
  formatDate,
  formatTime,
  parseDateTime,
} from './src/server/automation.js';
import {
  triageSymptomsWithAi,
  generateSoapNotesWithAi,
  generateClinicDatabaseInsightsWithAi,
  generateSqlFromNaturalLanguageWithAi,
} from './src/server/geminiService.js';
import {
  sendAppointmentBookingToN8n,
  sendAppointmentConfirmationToN8n,
  sendAppointmentRejectionToN8n,
  sendAppointmentCancellationToN8n,
  testN8nWebhook,
  DEFAULT_N8N_WEBHOOK_URL,
} from './src/server/n8nService.js';
import {
  Appointment,
  DoctorSchedule,
  DoctorStats,
  DoctorLeave,
  AdminDashboardData,
} from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to compute day name and day number
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function calculateSlots(
  doctorId: string,
  targetDateStr: string,
  now: Date,
  patientId?: string
): { slots: Array<{ startTime: string; endTime: string; isAvailable: boolean; reasonUnavailable?: string }>; message?: string } {
  const doctor = db.findUserById(doctorId);
  if (!doctor || doctor.role !== 'doctor') {
    return { slots: [], message: 'Doctor not found' };
  }
  if (doctor.isActive === false) {
    return { slots: [], message: 'This doctor is currently inactive and not accepting appointments.' };
  }

  // Parse target date (local date YYYY-MM-DD)
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  const dayOfWeek = targetDate.getDay();

  // Check if date is in the past (before today)
  const todayStr = formatDate(now);
  if (targetDateStr < todayStr) {
    return { slots: [], message: 'Cannot view or book slots for dates in the past.' };
  }

  // Check if doctor is on leave
  const leaves = db.getLeaves(doctorId);
  const isLeave = leaves.some((l) => l.date === targetDateStr);
  if (isLeave) {
    return { slots: [], message: 'Doctor is on leave on this date. No slots available.' };
  }

  // Get schedules for this day of the week
  const schedules = db.getSchedules(doctorId).filter((s) => s.dayOfWeek === dayOfWeek);
  if (schedules.length === 0) {
    return { slots: [], message: `Doctor does not have scheduled hours on ${DAY_NAMES[dayOfWeek]}s.` };
  }

  // Get existing active appointments for doctor on targetDate
  const allAppointments = db.getAppointments();
  const existingDoctorApts = allAppointments.filter(
    (a) => a.doctorId === doctorId && a.date === targetDateStr && a.status !== 'Cancelled' && a.status !== 'Rejected'
  );
  const doctorBookedTimes = new Set(existingDoctorApts.map((a) => a.startTime));

  // Get patient's existing active appointments on targetDate (across all doctors)
  const patientActiveApts = patientId
    ? allAppointments.filter(
        (a) => a.patientId === patientId && a.date === targetDateStr && a.status !== 'Cancelled' && a.status !== 'Rejected'
      )
    : [];
  const patientBookedMap = new Map(patientActiveApts.map((a) => [a.startTime, a]));

  const resultSlots: Array<{ startTime: string; endTime: string; isAvailable: boolean; reasonUnavailable?: string }> = [];

  for (const sch of schedules) {
    const [startH, startM] = sch.startTime.split(':').map(Number);
    const [endH, endM] = sch.endTime.split(':').map(Number);

    let currTotalMinutes = startH * 60 + startM;
    const endTotalMinutes = endH * 60 + endM;

    while (currTotalMinutes + 30 <= endTotalMinutes) {
      const slotH = Math.floor(currTotalMinutes / 60);
      const slotM = currTotalMinutes % 60;
      const slotStartTime = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`;

      const nextMinutes = currTotalMinutes + 30;
      const nextH = Math.floor(nextMinutes / 60);
      const nextM = nextMinutes % 60;
      const slotEndTime = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;

      // Check if slot time is in the past if date is today
      let isPast = false;
      if (targetDateStr === todayStr) {
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        if (currTotalMinutes <= currentTotalMinutes) {
          isPast = true;
        }
      }

      const isDoctorBooked = doctorBookedTimes.has(slotStartTime);
      const conflictingPatientApt = patientBookedMap.get(slotStartTime);

      let isAvailable = !isPast && !isDoctorBooked && !conflictingPatientApt;
      let reasonUnavailable: string | undefined;

      if (isPast) {
        reasonUnavailable = 'Time has passed';
      } else if (conflictingPatientApt) {
        if (conflictingPatientApt.doctorId === doctorId) {
          reasonUnavailable = `You already booked this slot (${conflictingPatientApt.status})`;
        } else {
          reasonUnavailable = `You have an appointment with ${conflictingPatientApt.doctorName} at this time`;
        }
      } else if (isDoctorBooked) {
        reasonUnavailable = 'Slot already booked';
      }

      resultSlots.push({
        startTime: slotStartTime,
        endTime: slotEndTime,
        isAvailable,
        reasonUnavailable,
      });

      currTotalMinutes += 30;
    }
  }

  // Sort slots by start time
  resultSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return { slots: resultSlots };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: db.getCurrentTime().toISOString() });
});

// Auth: Register (Patient - any name and email permitted)
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Name, email, phone, and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.findUserByEmail(normalizedEmail, 'patient');
  if (existing) {
    return res.status(409).json({ error: 'A patient account with this email already exists' });
  }

  const newUser = db.createUser({
    id: `usr_pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    role: 'patient',
    passwordHash: hashPassword(password),
    createdAt: db.getCurrentTime().toISOString(),
  });

  const token = createToken(newUser.id);
  const { passwordHash: _, ...safeUser } = newUser as any;
  res.status(201).json({ token, user: safeUser });
});

// Auth: Login (Patient: any email; Doctor: their separate email & password; Admin: shayanahmadd246@gmail.com & shayan123)
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const AUTHORIZED_ADMIN_EMAIL = 'shayanahmadd246@gmail.com';

  // If attempting Admin sign-in with unauthorized email
  if (role === 'admin' && normalizedEmail !== AUTHORIZED_ADMIN_EMAIL) {
    return res.status(403).json({
      error: 'Admin portal access is restricted to the authorized administrator (shayanahmadd246@gmail.com).',
    });
  }

  // Look up user with optional role preference
  let user = db.findUserByEmail(normalizedEmail, role);
  if (!user) {
    user = db.findUserByEmail(normalizedEmail);
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or user not found. Please check your credentials.' });
  }

  // If user role is admin and email is not authorized admin
  if (user.role === 'admin' && normalizedEmail !== AUTHORIZED_ADMIN_EMAIL) {
    return res.status(403).json({
      error: 'Admin portal access is restricted to the authorized administrator account only.',
    });
  }

  // Validate password (supports hash, shayan123 for admin, direct doctor passwords, and passwordless newly created doctors)
  const hasNoPassword = user.role === 'doctor' && (!user.passwordHash || user.passwordHash === '');
  const isMatch =
    hasNoPassword ||
    (!hasNoPassword && password && user.passwordHash === hashPassword(password)) ||
    (user.role === 'admin' && normalizedEmail === AUTHORIZED_ADMIN_EMAIL && (password === 'shayan123' || password === 'admin123')) ||
    (user.role === 'doctor' && (
      !password ||
      (password && (
        (user.email === 'dr.ayesha@nowshera.clinic' && password === 'ayesha123') ||
        (user.email === 'dr.tariq@nowshera.clinic' && password === 'tariq123') ||
        (user.email === 'dr.fatima@nowshera.clinic' && password === 'fatima123') ||
        (user.email === 'dr.bilal@nowshera.clinic' && password === 'bilal123')
      ))
    ));

  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password. Please verify your credentials.' });
  }

  if (user.role === 'doctor' && user.isActive === false) {
    return res.status(403).json({
      error: 'This doctor account is currently deactivated. Please contact clinic administration.',
    });
  }

  const { passwordHash: _, ...safeUser } = user;
  const token = createToken(user.id);
  res.json({ token, user: safeUser });
});

// AI: Generate Doctor Profile & Credentials (Admin endpoint with Gemini API)
app.post('/api/ai/generate-doctor-credentials', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { specialty, doctorName } = req.body;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a medical healthcare credential system. Generate a realistic, distinct profile and login credentials for a new medical doctor in a hospital/clinic.
Specialty requested: ${specialty || 'Cardiology, Pediatrics, General Medicine, Dermatology, Orthopedics, Neurology'}
Preferred name or cue: ${doctorName || 'Suggest an authentic medical practitioner name'}

Return ONLY a JSON object with this exact structure:
{
  "name": "Dr. [Full Name]",
  "email": "dr.[firstname].[lastname]@nowshera.clinic",
  "password": "[secure human-readable password like 'ayesha@med123' or 'docTariq2026']",
  "specialty": "[Specialty]",
  "phone": "+92 300 [7 digits]",
  "qualifications": "MBBS, FCPS / MRCP / MD",
  "experience": "[e.g. 10+ Years Consultant]",
  "suggestedSchedule": {
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "startTime": "09:00",
    "endTime": "13:00"
  },
  "bio": "[1 sentence professional medical biography]"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        return res.json(parsed);
      }
    }
  } catch (err) {
    console.warn('AI generation error, using fallback doctor generator', err);
  }

  // Fallback intelligent doctor profile generator
  const fallbackNames = ['Dr. Zainab Tariq', 'Dr. Usman Qureshi', 'Dr. Mariam Farooq', 'Dr. Haris Javed', 'Dr. Noman Bashir'];
  const name = doctorName || fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
  const cleanName = name.replace(/^Dr\.\s*/i, '').toLowerCase().replace(/[^a-z0-9]/g, '.');
  const spec = specialty || 'General Physician';
  const genPassword = `${cleanName.split('.')[0]}@med${Math.floor(100 + Math.random() * 900)}`;

  res.json({
    name,
    email: `dr.${cleanName}@nowshera.clinic`,
    password: genPassword,
    specialty: spec,
    phone: `+92 300 ${Math.floor(1000000 + Math.random() * 9000000)}`,
    qualifications: 'MBBS, FCPS Specialist',
    experience: '8+ Years Clinical Experience',
    suggestedSchedule: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '09:00',
      endTime: '13:00',
    },
    bio: `Dedicated specialist providing comprehensive patient-centered ${spec.toLowerCase()} care and consultations.`,
  });
});

// Auth: Me
app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// Auth: Doctor Set Initial Password from Invite Token
app.post('/api/auth/set-doctor-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  const user = db.findUserByToken(token);
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired setup password link.' });
  }

  const updatedUser = db.updateUser(user.id, {
    passwordHash: hashPassword(password),
    setupPasswordToken: undefined,
  });

  if (!updatedUser) {
    return res.status(500).json({ error: 'Failed to update password' });
  }

  const sessionToken = createToken(updatedUser.id);
  res.json({ message: 'Password set successfully. You are now logged in.', token: sessionToken, user: updatedUser });
});

// Doctor List (for patients & admins)
app.get('/api/doctors', (req, res) => {
  const allUsers = db.getUsers();
  const doctors = allUsers
    .filter((u) => u.role === 'doctor')
    .map(({ passwordHash: _, ...d }) => d);
  res.json(doctors);
});

// Doctor Schedule (Public/Doctor/Admin)
app.get('/api/doctors/:id/schedules', (req, res) => {
  const schedules = db.getSchedules(req.params.id);
  res.json(schedules);
});

// Doctor Leaves (Public/Doctor/Admin)
app.get('/api/doctors/:id/leaves', (req, res) => {
  const leaves = db.getLeaves(req.params.id);
  res.json(leaves);
});

// Get Free 30-Minute Slots for Doctor on Date (with conflict detection for patient)
app.get('/api/doctors/:id/slots', (req, res) => {
  const doctorId = req.params.id;
  const dateStr = req.query.date as string;

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'Valid date in YYYY-MM-DD format is required' });
  }

  // Detect authenticated patient if provided in authorization header or query
  let patientId: string | undefined = req.query.patientId as string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = db.findUserByToken(token);
    if (user && user.role === 'patient') {
      patientId = user.id;
    }
  }

  const now = db.getCurrentTime();
  const result = calculateSlots(doctorId, dateStr, now, patientId);
  res.json(result);
});

// ----------------------------------------------------
// PATIENT APPOINTMENT BOOKING & MANAGEMENT
// ----------------------------------------------------

// Request Appointment (Patient)
app.post('/api/appointments', authenticate, requireRole('patient'), (req: AuthenticatedRequest, res: Response) => {
  const patient = req.user!;
  const { doctorId, date, startTime, reason } = req.body;

  if (!doctorId || !date || !startTime) {
    return res.status(400).json({ error: 'Doctor, date, and startTime are required' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format (must be YYYY-MM-DD)' });
  }

  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    return res.status(400).json({ error: 'Invalid startTime format (must be HH:MM)' });
  }

  const doctor = db.findUserById(doctorId);
  if (!doctor || doctor.role !== 'doctor') {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  if (doctor.isActive === false) {
    return res.status(400).json({ error: 'This doctor is inactive and not accepting new appointments.' });
  }

  const now = db.getCurrentTime();
  const todayStr = formatDate(now);

  // Check past date
  if (date < todayStr) {
    return res.status(400).json({ error: 'Cannot book appointments in the past.' });
  }

  // Check past time today
  if (date === todayStr) {
    const aptStart = parseDateTime(date, startTime);
    if (aptStart.getTime() <= now.getTime()) {
      return res.status(400).json({ error: 'Cannot book a slot whose time has already passed.' });
    }
  }

  // Check doctor leave
  const leaves = db.getLeaves(doctorId);
  if (leaves.some((l) => l.date === date)) {
    return res.status(400).json({ error: 'Doctor is on leave on this date.' });
  }

  // Check doctor working hours if schedules exist
  const [y, m, d] = date.split('-').map(Number);
  const targetDayOfWeek = new Date(y, m - 1, d).getDay();
  const schedules = db.getSchedules(doctorId).filter((s) => s.dayOfWeek === targetDayOfWeek);

  const [reqH, reqM] = startTime.split(':').map(Number);
  const reqStartMinutes = reqH * 60 + reqM;
  const reqEndMinutes = reqStartMinutes + 30;

  if (schedules.length > 0) {
    const isWithinHours = schedules.some((s) => {
      const [sH, sM] = s.startTime.split(':').map(Number);
      const [eH, eM] = s.endTime.split(':').map(Number);
      const schStart = sH * 60 + sM;
      const schEnd = eH * 60 + eM;
      return reqStartMinutes >= schStart && reqEndMinutes <= schEnd;
    });

    if (!isWithinHours) {
      return res.status(400).json({
        error: `Requested slot (${startTime}) is outside ${doctor.name}'s scheduled working hours on ${DAY_NAMES[targetDayOfWeek]}.`,
      });
    }
  }

  // Calculate endTime
  const endH = Math.floor(reqEndMinutes / 60);
  const endM = reqEndMinutes % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  const allAppointments = db.getAppointments();

  // Rule 1: No double bookings for the doctor
  const doctorConflict = allAppointments.find(
    (a) =>
      a.doctorId === doctorId &&
      a.date === date &&
      a.startTime === startTime &&
      a.status !== 'Cancelled' &&
      a.status !== 'Rejected'
  );

  if (doctorConflict) {
    return res.status(409).json({
      error: 'This time slot is already booked or held by another patient. Please choose a different slot.',
    });
  }

  // Rule 2: A patient cannot have two appointments at the same time, even with different doctors
  const patientConflict = allAppointments.find(
    (a) =>
      a.patientId === patient.id &&
      a.date === date &&
      a.startTime === startTime &&
      a.status !== 'Cancelled' &&
      a.status !== 'Rejected'
  );

  if (patientConflict) {
    return res.status(409).json({
      error: `You already have an appointment scheduled at ${startTime} on ${date} with ${patientConflict.doctorName}. You cannot book two appointments at the same time.`,
    });
  }

  // Create appointment with status Pending
  const newAppointment: Appointment = {
    id: `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    patientId: patient.id,
    patientName: patient.name,
    patientEmail: patient.email,
    patientPhone: patient.phone,
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorSpecialty: doctor.specialty || 'General Physician',
    date,
    startTime,
    endTime,
    status: 'Pending',
    reason: reason ? String(reason).trim() : undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const created = db.createAppointment(newAppointment);

  // Log notification to patient (Booking is Pending; n8n is triggered ONLY when doctor confirms)
  db.logEmail({
    recipientEmail: patient.email,
    recipientName: patient.name,
    type: 'appointment_requested',
    subject: `Appointment Requested with ${doctor.name} on ${date} at ${startTime}`,
    body: `Dear ${patient.name},\n\nYour appointment request with ${doctor.name} for ${date} at ${startTime} has been submitted and is currently PENDING doctor confirmation.\n\nYour slot is reserved while awaiting confirmation. You will receive an email once the doctor reviews your request.\n\nBest regards,\nNowshera Family Clinic`,
    appointmentId: created.id,
  });

  res.status(201).json(created);
});

// Get Appointments (RBAC Protected)
app.get('/api/appointments', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const allAppointments = db.getAppointments();

  if (user.role === 'patient') {
    // Only patient's own appointments
    const patientApts = allAppointments.filter((a) => a.patientId === user.id);
    return res.json(patientApts);
  }

  if (user.role === 'doctor') {
    // Only doctor's own appointments
    const doctorApts = allAppointments.filter((a) => a.doctorId === user.id);
    return res.json(doctorApts);
  }

  if (user.role === 'admin') {
    // Admin sees all appointments, but CANNOT read clinical notes! (PRD mandate)
    let filtered = allAppointments;

    if (req.query.doctorId) {
      filtered = filtered.filter((a) => a.doctorId === req.query.doctorId);
    }
    if (req.query.date) {
      filtered = filtered.filter((a) => a.date === req.query.date);
    }
    if (req.query.status) {
      filtered = filtered.filter((a) => a.status === req.query.status);
    }

    // Strip clinical notes for admin privacy protection
    const sanitized = filtered.map(({ notes: _, ...rest }) => ({
      ...rest,
      notes: undefined, // Hidden from admin
    }));

    return res.json(sanitized);
  }

  return res.status(403).json({ error: 'Unauthorized role' });
});

// Get Specific Appointment by ID
app.get('/api/appointments/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const apt = db.findAppointmentById(req.params.id);

  if (!apt) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  // Access check
  if (user.role === 'patient') {
    if (apt.patientId !== user.id) {
      return res.status(403).json({ error: 'Access denied: You can only view your own appointments.' });
    }
    return res.json(apt);
  }

  if (user.role === 'doctor') {
    if (apt.doctorId !== user.id) {
      return res.status(403).json({ error: 'Access denied: You can only view your own appointments.' });
    }
    return res.json(apt);
  }

  if (user.role === 'admin') {
    // Admin can view appointment metadata, but notes are stripped
    const { notes: _, ...sanitized } = apt;
    return res.json(sanitized);
  }

  return res.status(403).json({ error: 'Forbidden' });
});

// Cancel Appointment (Patient, Doctor, or Admin)
app.post('/api/appointments/:id/cancel', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const apt = db.findAppointmentById(req.params.id);

  if (!apt) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (apt.status === 'Cancelled' || apt.status === 'Rejected') {
    return res.status(400).json({ error: `Appointment is already ${apt.status.toLowerCase()}.` });
  }

  const now = db.getCurrentTime();
  const aptStart = parseDateTime(apt.date, apt.startTime);

  // If patient is cancelling:
  if (user.role === 'patient') {
    if (apt.patientId !== user.id) {
      return res.status(403).json({ error: 'Access denied: You can only cancel your own appointments.' });
    }

    // 2-hour cancellation rule
    const hoursDifference = (aptStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursDifference < 2) {
      return res.status(400).json({
        error: 'Appointments cannot be cancelled less than 2 hours before the scheduled start time.',
      });
    }
  }

  // If doctor is cancelling:
  if (user.role === 'doctor' && apt.doctorId !== user.id) {
    return res.status(403).json({ error: 'Access denied: You can only cancel your own appointments.' });
  }

  const cancellationReason = req.body.reason || `Cancelled by ${user.role} (${user.name})`;

  const updated = db.updateAppointment(apt.id, {
    status: 'Cancelled',
    cancellationReason,
  });

  // Dispatch cancellation to n8n asynchronously
  if (updated) {
    sendAppointmentCancellationToN8n(
      updated,
      { id: user.id, name: user.name, role: user.role },
      cancellationReason
    ).catch((err) => {
      console.error('[n8n Webhook] Cancellation dispatch error:', err);
    });
  }

  // Send cancellation email to patient
  db.logEmail({
    recipientEmail: apt.patientEmail,
    recipientName: apt.patientName,
    type: 'appointment_cancelled',
    subject: `Appointment Cancelled: ${apt.doctorName} on ${apt.date} at ${apt.startTime}`,
    body: `Dear ${apt.patientName},\n\nYour appointment with ${apt.doctorName} on ${apt.date} at ${apt.startTime} has been cancelled.\n\nReason: ${cancellationReason}\n\nThe time slot has been released.\n\nBest regards,\nNowshera Family Clinic`,
    appointmentId: apt.id,
  });

  res.json({ message: 'Appointment cancelled successfully', appointment: updated });
});

// Reschedule Appointment (Patient)
app.post('/api/appointments/:id/reschedule', authenticate, requireRole('patient'), (req: AuthenticatedRequest, res: Response) => {
  const patient = req.user!;
  const apt = db.findAppointmentById(req.params.id);

  if (!apt) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (apt.patientId !== patient.id) {
    return res.status(403).json({ error: 'Access denied: You can only reschedule your own appointments.' });
  }

  if (apt.status !== 'Pending' && apt.status !== 'Confirmed') {
    return res.status(400).json({ error: `Cannot reschedule an appointment with status ${apt.status}.` });
  }

  const now = db.getCurrentTime();
  const oldStart = parseDateTime(apt.date, apt.startTime);

  // 2-hour rule on old appointment
  const hoursDifference = (oldStart.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursDifference < 2) {
    return res.status(400).json({
      error: 'Appointments cannot be rescheduled less than 2 hours before the start time.',
    });
  }

  const { newDate, newStartTime } = req.body;
  if (!newDate || !newStartTime) {
    return res.status(400).json({ error: 'newDate and newStartTime are required' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    return res.status(400).json({ error: 'Invalid newDate format (YYYY-MM-DD)' });
  }

  const todayStr = formatDate(now);
  if (newDate < todayStr) {
    return res.status(400).json({ error: 'Cannot reschedule to a past date.' });
  }

  if (newDate === todayStr) {
    const newStartDt = parseDateTime(newDate, newStartTime);
    if (newStartDt.getTime() <= now.getTime()) {
      return res.status(400).json({ error: 'Cannot reschedule to a past time slot.' });
    }
  }

  // Check doctor leave
  const leaves = db.getLeaves(apt.doctorId);
  if (leaves.some((l) => l.date === newDate)) {
    return res.status(400).json({ error: 'Doctor is on leave on the selected date.' });
  }

  // Check working hours
  const [y, m, d] = newDate.split('-').map(Number);
  const targetDayOfWeek = new Date(y, m - 1, d).getDay();
  const schedules = db.getSchedules(apt.doctorId).filter((s) => s.dayOfWeek === targetDayOfWeek);

  const [reqH, reqM] = newStartTime.split(':').map(Number);
  const reqStartMinutes = reqH * 60 + reqM;
  const reqEndMinutes = reqStartMinutes + 30;

  const isWithinHours = schedules.some((s) => {
    const [sH, sM] = s.startTime.split(':').map(Number);
    const [eH, eM] = s.endTime.split(':').map(Number);
    const schStart = sH * 60 + sM;
    const schEnd = eH * 60 + eM;
    return reqStartMinutes >= schStart && reqEndMinutes <= schEnd && (reqStartMinutes - schStart) % 30 === 0;
  });

  if (!isWithinHours) {
    return res.status(400).json({
      error: `Selected slot (${newStartTime}) is outside doctor working hours on ${DAY_NAMES[targetDayOfWeek]}.`,
    });
  }

  const allAppointments = db.getAppointments();

  // Check new slot availability (ignoring the current appointment itself)
  const slotConflict = allAppointments.find(
    (a) =>
      a.id !== apt.id &&
      a.doctorId === apt.doctorId &&
      a.date === newDate &&
      a.startTime === newStartTime &&
      a.status !== 'Cancelled' &&
      a.status !== 'Rejected'
  );

  if (slotConflict) {
    return res.status(409).json({ error: 'The requested new slot is already booked or held by another patient.' });
  }

  // Check patient conflict at new time
  const patientConflict = allAppointments.find(
    (a) =>
      a.id !== apt.id &&
      a.patientId === patient.id &&
      a.date === newDate &&
      a.startTime === newStartTime &&
      a.status !== 'Cancelled' &&
      a.status !== 'Rejected'
  );

  if (patientConflict) {
    return res.status(409).json({
      error: `You already have another appointment scheduled at ${newStartTime} on ${newDate}.`,
    });
  }

  const endH = Math.floor(reqEndMinutes / 60);
  const endM = reqEndMinutes % 60;
  const newEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  const updated = db.updateAppointment(apt.id, {
    date: newDate,
    startTime: newStartTime,
    endTime: newEndTime,
    status: 'Pending', // Rescheduled appointment returns to Pending for doctor confirmation
    reminderSent: false,
  });

  // Log email to patient
  db.logEmail({
    recipientEmail: patient.email,
    recipientName: patient.name,
    type: 'appointment_requested',
    subject: `Appointment Rescheduled: ${apt.doctorName} on ${newDate} at ${newStartTime}`,
    body: `Dear ${patient.name},\n\nYour appointment with ${apt.doctorName} has been moved to ${newDate} at ${newStartTime}.\n\nYour previous slot has been released, and the new slot is held pending doctor confirmation.\n\nBest regards,\nNowshera Family Clinic`,
    appointmentId: apt.id,
  });

  res.json({ message: 'Appointment rescheduled successfully. Status set to Pending.', appointment: updated });
});

// ----------------------------------------------------
// DOCTOR ACTIONS: CONFIRM, REJECT, COMPLETE, NO-SHOW, NOTES
// ----------------------------------------------------

// Confirm Appointment (Doctor)
app.post('/api/appointments/:id/confirm', authenticate, requireRole('doctor'), (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const apt = db.findAppointmentById(req.params.id);

  if (!apt) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (apt.doctorId !== doctor.id) {
    return res.status(403).json({ error: 'Access denied: You can only confirm appointments assigned to you.' });
  }

  if (apt.status !== 'Pending') {
    return res.status(400).json({ error: `Cannot confirm appointment with status ${apt.status}.` });
  }

  const updated = db.updateAppointment(apt.id, { status: 'Confirmed' });

  // Dispatch confirmation to n8n asynchronously
  if (updated) {
    sendAppointmentConfirmationToN8n(updated, doctor).catch((err) => {
      console.error('[n8n Webhook] Confirmation dispatch error:', err);
    });
  }

  // Confirmation email to patient
  db.logEmail({
    recipientEmail: apt.patientEmail,
    recipientName: apt.patientName,
    type: 'appointment_confirmed',
    subject: `Appointment Confirmed with ${doctor.name} on ${apt.date} at ${apt.startTime}`,
    body: `Dear ${apt.patientName},\n\nGreat news! Dr. ${doctor.name} has CONFIRMED your appointment on ${apt.date} at ${apt.startTime}.\n\nLocation: Nowshera Family Clinic, Main Grand Trunk Rd, Nowshera.\n\nPlease arrive 10 minutes prior to your scheduled time.\n\nBest regards,\nNowshera Family Clinic`,
    appointmentId: apt.id,
  });

  res.json({ message: 'Appointment confirmed successfully', appointment: updated });
});

// Reject Appointment (Doctor)
app.post('/api/appointments/:id/reject', authenticate, requireRole('doctor'), (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const apt = db.findAppointmentById(req.params.id);

  if (!apt) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (apt.doctorId !== doctor.id) {
    return res.status(403).json({ error: 'Access denied: You can only reject appointments assigned to you.' });
  }

  if (apt.status !== 'Pending') {
    return res.status(400).json({ error: `Cannot reject appointment with status ${apt.status}.` });
  }

  const reason = req.body.reason || 'Doctor unavailable at requested time';

  const updated = db.updateAppointment(apt.id, {
    status: 'Rejected',
    cancellationReason: reason,
  });

  // Dispatch rejection to n8n asynchronously
  if (updated) {
    sendAppointmentRejectionToN8n(updated, doctor, reason).catch((err) => {
      console.error('[n8n Webhook] Rejection dispatch error:', err);
    });
  }

  // Rejection email to patient
  db.logEmail({
    recipientEmail: apt.patientEmail,
    recipientName: apt.patientName,
    type: 'appointment_rejected',
    subject: `Appointment Request Declined by ${doctor.name}`,
    body: `Dear ${apt.patientName},\n\nDr. ${doctor.name} was unable to accept your appointment request for ${apt.date} at ${apt.startTime}.\n\nReason: ${reason}\n\nThe time slot has been released. Please visit our website to select an alternative slot.\n\nBest regards,\nNowshera Family Clinic`,
    appointmentId: apt.id,
  });

  res.json({ message: 'Appointment rejected', appointment: updated });
});

// Complete Appointment (Doctor)
app.post('/api/appointments/:id/complete', authenticate, requireRole('doctor'), (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const apt = db.findAppointmentById(req.params.id);

  if (!apt) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (apt.doctorId !== doctor.id) {
    return res.status(403).json({ error: 'Access denied: You can only complete your own appointments.' });
  }

  const now = db.getCurrentTime();
  const aptStart = parseDateTime(apt.date, apt.startTime);

  // Early completion check: Must not be before visit start time
  if (now.getTime() < aptStart.getTime()) {
    return res.status(400).json({
      error: 'Cannot mark an appointment Completed before its scheduled visit start time.',
    });
  }

  const { notes } = req.body;

  const updated = db.updateAppointment(apt.id, {
    status: 'Completed',
    notes: notes ? String(notes).trim() : apt.notes,
  });

  res.json({ message: 'Appointment marked as Completed', appointment: updated });
});

// Mark No-Show (Doctor)
app.post('/api/appointments/:id/no-show', authenticate, requireRole('doctor'), (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const apt = db.findAppointmentById(req.params.id);

  if (!apt) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (apt.doctorId !== doctor.id) {
    return res.status(403).json({ error: 'Access denied: You can only mark your own appointments.' });
  }

  const now = db.getCurrentTime();
  const aptStart = parseDateTime(apt.date, apt.startTime);

  // Early no-show check: Must not be before visit start time
  if (now.getTime() < aptStart.getTime()) {
    return res.status(400).json({
      error: 'Cannot mark an appointment as No-show before its scheduled visit start time.',
    });
  }

  const { notes } = req.body;

  const updated = db.updateAppointment(apt.id, {
    status: 'No-show',
    notes: notes ? String(notes).trim() : apt.notes,
  });

  res.json({ message: 'Appointment marked as No-show', appointment: updated });
});

// Add / Update Clinical Notes (Doctor)
app.patch('/api/appointments/:id/notes', authenticate, requireRole('doctor'), (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const apt = db.findAppointmentById(req.params.id);

  if (!apt) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (apt.doctorId !== doctor.id) {
    return res.status(403).json({ error: 'Access denied: You can only add notes to your own appointments.' });
  }

  const { notes } = req.body;
  if (notes === undefined) {
    return res.status(400).json({ error: 'notes field is required' });
  }

  const updated = db.updateAppointment(apt.id, { notes: String(notes).trim() });
  res.json({ message: 'Notes updated', appointment: updated });
});

// Doctor Views Patient History (Doctor role only; must have seen or be assigned to this patient)
app.get('/api/doctor/patients/:patientId/history', authenticate, requireRole('doctor'), (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const patientId = req.params.patientId;

  const allAppointments = db.getAppointments();

  // Test Case 9 Check: Doctor A cannot open Doctor B's patient history if Doctor A has no appointments with this patient!
  const doctorPatientApts = allAppointments.filter(
    (a) => a.doctorId === doctor.id && a.patientId === patientId
  );

  if (doctorPatientApts.length === 0) {
    return res.status(403).json({
      error: 'Access denied: You do not have permission to view patient records for a patient you have not treated.',
    });
  }

  const patient = db.findUserById(patientId);
  const safePatient = patient
    ? { id: patient.id, name: patient.name, email: patient.email, phone: patient.phone }
    : undefined;

  // Return this doctor's appointments with this patient, including visit notes
  doctorPatientApts.sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));

  res.json({
    patient: safePatient,
    appointments: doctorPatientApts,
  });
});

// ----------------------------------------------------
// DOCTOR SCHEDULE & LEAVE MANAGEMENT
// ----------------------------------------------------

// Add Doctor Working Hours
app.post('/api/doctor/schedules', authenticate, requireRole('doctor'), (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const { dayOfWeek, startTime, endTime } = req.body;

  if (dayOfWeek === undefined || !startTime || !endTime) {
    return res.status(400).json({ error: 'dayOfWeek, startTime, and endTime are required' });
  }

  const dayNum = Number(dayOfWeek);
  if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
    return res.status(400).json({ error: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' });
  }

  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return res.status(400).json({ error: 'Time format must be HH:MM' });
  }

  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  const startMin = sH * 60 + sM;
  const endMin = eH * 60 + eM;

  // Test Case 7: End time must be after start time (like 13:00 - 09:00 blocked)
  if (endMin <= startMin) {
    return res.status(400).json({
      error: 'End time must be after start time. (e.g., 09:00 to 13:00).',
    });
  }

  // Must be in 30-min increments
  if ((endMin - startMin) % 30 !== 0 || (startMin % 30 !== 0) || (endMin % 30 !== 0)) {
    return res.status(400).json({
      error: 'Working hours must start and end on 30-minute increments (:00 or :30).',
    });
  }

  // Test Case 7: Overlapping hours check for the same doctor on the same day
  const existing = db.getSchedules(doctor.id).filter((s) => s.dayOfWeek === dayNum);
  const hasOverlap = existing.some((s) => {
    const [curSH, curSM] = s.startTime.split(':').map(Number);
    const [curEH, curEM] = s.endTime.split(':').map(Number);
    const curStart = curSH * 60 + curSM;
    const curEnd = curEH * 60 + curEM;
    return Math.max(startMin, curStart) < Math.min(endMin, curEnd);
  });

  if (hasOverlap) {
    return res.status(400).json({
      error: `These hours (${startTime} - ${endTime}) overlap with existing working hours you have already added on ${DAY_NAMES[dayNum]}.`,
    });
  }

  const newSchedule: DoctorSchedule = {
    id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    doctorId: doctor.id,
    dayOfWeek: dayNum,
    dayName: DAY_NAMES[dayNum],
    startTime,
    endTime,
  };

  const saved = db.addSchedule(newSchedule);
  res.status(201).json(saved);
});

// Delete Doctor Schedule
app.delete('/api/doctor/schedules/:id', authenticate, requireRole('doctor'), (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const deleted = db.deleteSchedule(req.params.id, doctor.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Schedule not found or not owned by you' });
  }
  res.json({ message: 'Schedule removed' });
});

// Add Doctor Leave Day
app.post('/api/doctor/leaves', authenticate, requireRole('doctor'), (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const { date, reason } = req.body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Valid date in YYYY-MM-DD format is required' });
  }

  const now = db.getCurrentTime();
  const todayStr = formatDate(now);

  // Test Case 7: Leave day in the past is blocked
  if (date < todayStr) {
    return res.status(400).json({
      error: 'Cannot add a leave day in the past.',
    });
  }

  const existingLeaves = db.getLeaves(doctor.id);
  if (existingLeaves.some((l) => l.date === date)) {
    return res.status(409).json({ error: 'You are already marked on leave on this date.' });
  }

  const newLeave: DoctorLeave = {
    id: `leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    doctorId: doctor.id,
    date,
    reason: reason ? String(reason).trim() : 'Scheduled Leave',
    createdAt: now.toISOString(),
  };

  const savedLeave = db.addLeave(newLeave);

  // Test Case 5 / PRD Mandate: Cancel all Pending and Confirmed appointments on this leave day and email patients!
  const allAppointments = db.getAppointments();
  const affectedAppointments = allAppointments.filter(
    (a) => a.doctorId === doctor.id && a.date === date && (a.status === 'Pending' || a.status === 'Confirmed')
  );

  for (const apt of affectedAppointments) {
    const updatedApt = db.updateAppointment(apt.id, {
      status: 'Cancelled',
      cancellationReason: `Doctor Leave: Dr. ${doctor.name} is on leave on ${date}.`,
    });

    if (updatedApt) {
      sendAppointmentCancellationToN8n(
        updatedApt,
        { id: doctor.id, name: doctor.name, role: 'doctor' },
        updatedApt.cancellationReason
      ).catch((err) => {
        console.error('[n8n Webhook] Leave cancellation dispatch error:', err);
      });
    }

    db.logEmail({
      recipientEmail: apt.patientEmail,
      recipientName: apt.patientName,
      type: 'appointment_cancelled',
      subject: `Appointment Cancelled: Dr. ${doctor.name} is on leave on ${date}`,
      body: `Dear ${apt.patientName},\n\nWe regret to inform you that your appointment with Dr. ${doctor.name} on ${date} at ${apt.startTime} has been cancelled because the doctor is on scheduled leave.\n\nPlease log in to our portal to choose another date or an alternative doctor.\n\nWe apologize for any inconvenience.\n\nBest regards,\nNowshera Family Clinic`,
      appointmentId: apt.id,
    });
  }

  res.status(201).json({
    leave: savedLeave,
    cancelledAppointmentsCount: affectedAppointments.length,
  });
});

// Delete Doctor Leave Day
app.delete('/api/doctor/leaves/:id', authenticate, requireRole('doctor'), (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const deleted = db.deleteLeave(req.params.id, doctor.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Leave record not found or not owned by you' });
  }
  res.json({ message: 'Leave day removed' });
});

// ----------------------------------------------------
// ADMIN CONTROLS & DASHBOARD
// ----------------------------------------------------

// Admin: Add New Doctor
app.post('/api/admin/doctors', authenticate, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { name, email, phone, specialty } = req.body;

  if (!name || !email || !specialty) {
    return res.status(400).json({ error: 'Name, email, and specialty are required' });
  }

  const existing = db.findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'A user with this email already exists' });
  }

  const setupPasswordToken = `setpwd_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  const newDoctor = db.createUser({
    id: `usr_doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone ? phone.trim() : '+92 300 0000000',
    role: 'doctor',
    specialty: specialty.trim(),
    isActive: true,
    passwordHash: '', // Unset until doctor sets it via link
    setupPasswordToken,
    createdAt: db.getCurrentTime().toISOString(),
  });

  // Send welcome / set password email
  const setupUrl = `/set-password?token=${setupPasswordToken}&email=${encodeURIComponent(newDoctor.email)}`;
  db.logEmail({
    recipientEmail: newDoctor.email,
    recipientName: newDoctor.name,
    type: 'doctor_welcome_set_password',
    subject: `Welcome to Nowshera Family Clinic - Set Your Doctor Account Password`,
    body: `Dear Dr. ${newDoctor.name},\n\nYou have been added as a practitioner at Nowshera Family Clinic (${newDoctor.specialty}).\n\nPlease use the following link to set your account password and configure your weekly availability:\n\n${setupUrl}\n\nToken: ${setupPasswordToken}\n\nWelcome to the team!\n\nBest regards,\nClinic Administration`,
  });

  res.status(201).json({ doctor: newDoctor, setupPasswordToken, setupUrl });
});

// Admin: Toggle Doctor Status (Activate / Deactivate)
app.patch('/api/admin/doctors/:id/status', authenticate, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive must be a boolean' });
  }

  const doctor = db.findUserById(req.params.id);
  if (!doctor || doctor.role !== 'doctor') {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  const updated = db.updateUser(doctor.id, { isActive });
  res.json({ message: `Doctor ${isActive ? 'activated' : 'deactivated'} successfully`, doctor: updated });
});

// Admin: View & Search Patients
app.get('/api/admin/patients', authenticate, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase();
  const allUsers = db.getUsers();
  const allAppointments = db.getAppointments();

  const patients = allUsers
    .filter((u) => u.role === 'patient')
    .filter((u) => !query || u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || u.phone.includes(query))
    .map(({ passwordHash: _, ...p }) => {
      const patientApts = allAppointments.filter((a) => a.patientId === p.id);
      return {
        ...p,
        totalAppointments: patientApts.length,
        completedVisits: patientApts.filter((a) => a.status === 'Completed').length,
        lastVisitDate: patientApts.find((a) => a.status === 'Completed')?.date || null,
      };
    });

  res.json(patients);
});

// Admin: Clinic Dashboard Stats
app.get('/api/admin/dashboard', authenticate, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const now = db.getCurrentTime();
  const todayDate = formatDate(now);

  const allUsers = db.getUsers();
  const allAppointments = db.getAppointments();

  const doctors = allUsers.filter((u) => u.role === 'doctor');
  const patients = allUsers.filter((u) => u.role === 'patient');

  // Today's appointments (notes stripped for admin)
  const todayAppointments = allAppointments
    .filter((a) => a.date === todayDate)
    .map(({ notes: _, ...rest }) => rest);

  // Per doctor stats across all time / current
  const doctorStats: DoctorStats[] = doctors.map((doc) => {
    const docApts = allAppointments.filter((a) => a.doctorId === doc.id);
    return {
      doctorId: doc.id,
      doctorName: doc.name,
      specialty: doc.specialty || 'General',
      isActive: doc.isActive !== false,
      pending: docApts.filter((a) => a.status === 'Pending').length,
      confirmed: docApts.filter((a) => a.status === 'Confirmed').length,
      completed: docApts.filter((a) => a.status === 'Completed').length,
      noShow: docApts.filter((a) => a.status === 'No-show').length,
      cancelled: docApts.filter((a) => a.status === 'Cancelled' || a.status === 'Rejected').length,
      total: docApts.length,
    };
  });

  const dashboard: AdminDashboardData = {
    todayDate,
    todayAppointmentsCount: todayAppointments.length,
    todayAppointments: todayAppointments as any,
    doctorStats,
    totalPatientsCount: patients.length,
    totalDoctorsCount: doctors.length,
  };

  res.json(dashboard);
});

// ----------------------------------------------------
// SQLITE DATABASE EXPLORER & MANAGEMENT ENDPOINTS
// ----------------------------------------------------

// SQLite: Database Metrics & Schema Info (Admin)
app.get('/api/admin/sqlite/stats', authenticate, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = sqliteDb.getDatabaseStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch SQLite stats' });
  }
});

// SQLite: Execute Raw SQL Query (Admin)
app.post('/api/admin/sqlite/query', authenticate, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'SQL query string is required' });
  }

  try {
    const result = sqliteDb.executeSql(query);
    sqliteDb.logAiInteraction('sqlite_query', query, JSON.stringify(result));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'SQL execution failed' });
  }
});

// SQLite: Browse Table Rows (Admin)
app.get('/api/admin/sqlite/table/:tableName', authenticate, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const tableName = req.params.tableName;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;

  try {
    const query = `SELECT * FROM "${tableName.replace(/"/g, '""')}" LIMIT ${limit} OFFSET ${offset};`;
    const result = sqliteDb.executeSql(query);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to read table' });
  }
});

// SQLite: Download Binary Database File (Admin)
app.get('/api/admin/sqlite/download', authenticate, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const binary = sqliteDb.getDatabaseBinary();
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', 'attachment; filename="clinic_database.sqlite"');
    res.send(binary);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to download SQLite file' });
  }
});

// SQLite: Export Database as JSON (Admin)
app.get('/api/admin/sqlite/export-json', authenticate, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = sqliteDb.exportToJson();
    res.setHeader('Content-Disposition', 'attachment; filename="clinic_backup.json"');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to export SQLite database' });
  }
});

// SQLite: Reset Database to Default Seed State (Admin)
app.post('/api/admin/sqlite/reset', authenticate, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    sqliteDb.resetDatabase();
    res.json({ message: 'SQLite database reset to default schema and seed records successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reset SQLite database' });
  }
});

// SQLite: Generate SQL Query from Natural Language with Gemini AI (Admin)
app.post('/api/admin/sqlite/ai-generate-query', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { question } = req.body;
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    const result = await generateSqlFromNaturalLanguageWithAi(question);
    sqliteDb.logAiInteraction('ai_sql_generator', question, JSON.stringify(result));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate SQL' });
  }
});

// ----------------------------------------------------
// AUTOMATED AI ENDPOINTS (AUTOMATIC AI PATIENT TRIAGE & CLINICAL NOTES)
// ----------------------------------------------------

// AI: Automated Symptom Triage & Resident Doctor Match (Public/Patient)
app.post('/api/ai/triage', async (req: Request, res: Response) => {
  const { symptoms, patientAge } = req.body;
  if (!symptoms || typeof symptoms !== 'string') {
    return res.status(400).json({ error: 'Symptoms description is required' });
  }

  try {
    const triageResult = await triageSymptomsWithAi(symptoms, patientAge ? Number(patientAge) : undefined);
    sqliteDb.logAiInteraction('symptom_triage', symptoms, JSON.stringify(triageResult));
    res.json(triageResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to triage symptoms' });
  }
});

// AI: Automated SOAP Notes & Prescriptions (Doctor Role)
app.post('/api/ai/soap-notes', authenticate, requireRole('doctor'), async (req: AuthenticatedRequest, res: Response) => {
  const doctor = req.user!;
  const { patientName, visitReason, clinicalObservations } = req.body;

  if (!patientName || !visitReason) {
    return res.status(400).json({ error: 'patientName and visitReason are required' });
  }

  try {
    const notesResult = await generateSoapNotesWithAi(
      doctor.name,
      doctor.specialty || 'General Physician',
      patientName,
      visitReason,
      clinicalObservations
    );
    sqliteDb.logAiInteraction('doctor_soap_notes', `${patientName}: ${visitReason}`, JSON.stringify(notesResult));
    res.json(notesResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate SOAP notes' });
  }
});

// AI: Automated Clinic Operations Intelligence (Admin Role)
app.get('/api/admin/ai/insights', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allAppointments = db.getAppointments();
    const stats = sqliteDb.getDatabaseStats();
    const allUsers = db.getUsers();
    const doctors = allUsers.filter((u) => u.role === 'doctor');

    const summaryData = {
      totalAppointments: allAppointments.length,
      pendingCount: allAppointments.filter((a) => a.status === 'Pending').length,
      confirmedCount: allAppointments.filter((a) => a.status === 'Confirmed').length,
      completedCount: allAppointments.filter((a) => a.status === 'Completed').length,
      cancelledCount: allAppointments.filter((a) => a.status === 'Cancelled' || a.status === 'Rejected').length,
      doctorBreakdown: doctors.map((d) => ({
        name: d.name,
        specialty: d.specialty,
        count: allAppointments.filter((a) => a.doctorId === d.id).length,
      })),
      sqliteTableStats: stats.tables.map((t) => ({ table: t.name, rows: t.rowCount })),
    };

    const insights = await generateClinicDatabaseInsightsWithAi(summaryData);
    sqliteDb.logAiInteraction('admin_clinic_insights', 'automated_run', JSON.stringify(insights));
    res.json(insights);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate clinic insights' });
  }
});

// ----------------------------------------------------
// N8N WEBHOOK INTEGRATIONS
// ----------------------------------------------------

// n8n Webhook Status
app.get('/api/integrations/n8n/status', (req: Request, res: Response) => {
  const currentUrl = process.env.N8N_WEBHOOK_URL || DEFAULT_N8N_WEBHOOK_URL;
  res.json({
    webhookUrl: currentUrl,
    isConfigured: Boolean(currentUrl),
    supportedEvents: [
      'appointment.booked',
      'appointment.confirmed',
      'appointment.rejected',
      'appointment.cancelled',
      'appointment.rescheduled',
    ],
  });
});

// n8n Webhook Test Dispatch (Admin/Test)
app.post('/api/integrations/n8n/test', async (req: Request, res: Response) => {
  const { webhookUrl, eventType } = req.body;
  try {
    const result = await testN8nWebhook(webhookUrl, eventType || 'appointment.test_ping');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trigger test n8n webhook' });
  }
});

// ----------------------------------------------------
// EMAILS & AUTOMATIONS & TEST HARNESS
// ----------------------------------------------------

// Get Emails (Filtered by role)
app.get('/api/emails', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (user.role === 'admin') {
    return res.json(db.getEmails());
  }
  return res.json(db.getEmails(user.email));
});

// Run Automations On Demand
app.post('/api/automations/run', (req, res) => {
  const result = runAutomations();
  res.json(result);
});

// System time offset manipulation for tests
app.post('/api/test/set-time-offset', (req, res) => {
  const { offsetMs } = req.body;
  if (typeof offsetMs !== 'number') {
    return res.status(400).json({ error: 'offsetMs must be a number' });
  }
  db.setSystemTimeOffset(offsetMs);
  res.json({ currentTime: db.getCurrentTime().toISOString(), offsetMs });
});

// Reset database for test suite
app.post('/api/test/reset', (req, res) => {
  db.resetDatabase();
  res.json({ message: 'Database reset to default seed state' });
});

// Start the periodic automation cron worker
startAutomationWorker(15000);

// ----------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// ----------------------------------------------------
async function startServer() {
  await sqliteDb.ready();
  console.log('SQLite Clinic Database initialized and ready.');

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nowshera Family Clinic server running on http://localhost:${PORT}`);
  });
}

startServer();
