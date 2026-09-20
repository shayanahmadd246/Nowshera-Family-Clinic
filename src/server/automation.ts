import { db } from './db.js';
import { Appointment } from '../types.js';

export interface AutomationRunResult {
  timestamp: string;
  cancelledPendingCount: number;
  remindersSentCount: number;
  details: string[];
}

export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function parseDateTime(dateStr: string, timeStr: string): Date {
  // dateStr is 'YYYY-MM-DD', timeStr is 'HH:MM'
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function runAutomations(): AutomationRunResult {
  const now = db.getCurrentTime();
  const nowFormattedDate = formatDate(now);
  const nowFormattedTime = formatTime(now);

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowFormattedDate = formatDate(tomorrow);

  const appointments = db.getAppointments();
  const details: string[] = [];
  let cancelledPendingCount = 0;
  let remindersSentCount = 0;

  // 1. Auto-cancel Pending appointments whose start time has arrived/passed
  for (const apt of appointments) {
    if (apt.status === 'Pending') {
      const aptStart = parseDateTime(apt.date, apt.startTime);
      if (aptStart.getTime() <= now.getTime()) {
        const updated = db.updateAppointment(apt.id, {
          status: 'Cancelled',
          cancellationReason: 'Cancelled automatically: Request was not confirmed by the doctor before the appointment start time.',
        });

        if (updated) {
          cancelledPendingCount++;
          const msg = `Auto-cancelled unconfirmed pending appointment #${apt.id.slice(-6)} for patient ${apt.patientName} with ${apt.doctorName} (Scheduled for ${apt.date} ${apt.startTime}).`;
          details.push(msg);

          // Email the patient
          db.logEmail({
            recipientEmail: apt.patientEmail,
            recipientName: apt.patientName,
            type: 'appointment_cancelled',
            subject: `Appointment Cancelled: Request with ${apt.doctorName} expired`,
            body: `Dear ${apt.patientName},\n\nYour requested appointment with ${apt.doctorName} on ${apt.date} at ${apt.startTime} was not confirmed before its start time and has been cancelled automatically.\n\nPlease sign in to book a new appointment at your convenience.\n\nBest regards,\nNowshera Family Clinic`,
            appointmentId: apt.id,
          });
        }
      }
    }
  }

  // 2. Send reminder email the day before a Confirmed appointment
  for (const apt of appointments) {
    if (apt.status === 'Confirmed' && !apt.reminderSent) {
      if (apt.date === tomorrowFormattedDate) {
        db.updateAppointment(apt.id, { reminderSent: true });
        remindersSentCount++;
        const msg = `Sent 24h reminder email to patient ${apt.patientName} for appointment #${apt.id.slice(-6)} with ${apt.doctorName} tomorrow at ${apt.startTime}.`;
        details.push(msg);

        db.logEmail({
          recipientEmail: apt.patientEmail,
          recipientName: apt.patientName,
          type: 'appointment_reminder',
          subject: `Reminder: Clinic Appointment Tomorrow with ${apt.doctorName} at ${apt.startTime}`,
          body: `Dear ${apt.patientName},\n\nThis is a friendly reminder that you have a confirmed appointment with ${apt.doctorName} (${apt.doctorSpecialty}) tomorrow, ${apt.date}, at ${apt.startTime}.\n\nLocation: Nowshera Family Clinic, Main Grand Trunk Rd, Nowshera.\n\nIf you need to reschedule or cancel, please do so at least 2 hours before your visit.\n\nWe look forward to seeing you!\n\nBest regards,\nNowshera Family Clinic Team`,
          appointmentId: apt.id,
        });
      }
    }
  }

  return {
    timestamp: now.toISOString(),
    cancelledPendingCount,
    remindersSentCount,
    details,
  };
}

// Start background cron worker
let intervalTimer: NodeJS.Timeout | null = null;
export function startAutomationWorker(intervalMs = 15000) {
  if (intervalTimer) clearInterval(intervalTimer);
  intervalTimer = setInterval(() => {
    try {
      runAutomations();
    } catch (e) {
      console.error('Automation worker error:', e);
    }
  }, intervalMs);
}
