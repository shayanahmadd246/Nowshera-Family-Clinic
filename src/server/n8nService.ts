import { Appointment, User } from '../types.js';
import { db } from './db.js';

export const DEFAULT_N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://ai-skool-n8n-57b1748669d9.herokuapp.com/webhook-test/2524931a-79d2-4bb8-ad6f-880161b9fdfa';

export interface N8nWebhookResponse {
  success: boolean;
  statusCode?: number;
  message?: string;
  responseBody?: string;
  error?: string;
  timestamp: string;
}

export type AppointmentWebhookEvent =
  | 'appointment.booked'
  | 'appointment.confirmed'
  | 'appointment.rejected'
  | 'appointment.cancelled'
  | 'appointment.rescheduled'
  | 'appointment.completed'
  | 'appointment.no_show'
  | 'appointment.test_ping';

export interface SendAppointmentEventOptions {
  event: AppointmentWebhookEvent;
  action: string;
  appointment: Appointment;
  patient?: User | null;
  doctor?: User | null;
  actor?: {
    id: string;
    name: string;
    role: string;
  };
  reason?: string;
  notes?: string;
  customMetadata?: Record<string, any>;
}

/**
 * Universal dispatcher for all appointment lifecycle events to n8n webhook
 * and persistent recording in the SQLite database.
 */
export async function sendAppointmentEventToN8n(
  options: SendAppointmentEventOptions
): Promise<N8nWebhookResponse> {
  const { event, action, appointment, patient, doctor, actor, reason, notes, customMetadata } = options;
  const webhookUrl = process.env.N8N_WEBHOOK_URL || DEFAULT_N8N_WEBHOOK_URL;
  const timestamp = new Date().toISOString();

  // Ensure patient and doctor details are resolved from DB if not passed
  const resolvedPatient =
    patient || db.findUserById(appointment.patientId);
  const resolvedDoctor =
    doctor || db.findUserById(appointment.doctorId);

  // Construct standardized payload for n8n workflows
  const payload = {
    event,
    action,
    timestamp,
    source: 'Nowshera Family Clinic Web Portal',
    appointment: {
      id: appointment.id,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      reason: appointment.reason || 'General Medical Consultation',
      cancellationReason: appointment.cancellationReason || reason || null,
      notes: appointment.notes || notes || null,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    },
    patient: {
      id: appointment.patientId,
      name: appointment.patientName,
      email: appointment.patientEmail,
      phone: appointment.patientPhone || resolvedPatient?.phone || '',
    },
    doctor: {
      id: appointment.doctorId,
      name: appointment.doctorName,
      specialty: appointment.doctorSpecialty,
      email: resolvedDoctor?.email || '',
      phone: resolvedDoctor?.phone || '',
    },
    actor: actor || {
      id: resolvedDoctor?.id || appointment.doctorId,
      name: resolvedDoctor?.name || appointment.doctorName,
      role: 'system',
    },
    reason: reason || appointment.cancellationReason || undefined,
    notes: notes || appointment.notes || undefined,
    clinic: {
      name: 'Nowshera Family Clinic',
      location: 'Main Grand Trunk Rd, Nowshera, KP, Pakistan',
      phone: '+92 923 610990',
      email: 'care@nowshera.clinic',
    },
    metadata: customMetadata || {},
  };

  console.log(`[n8n Webhook] Dispatching event "${event}" (${action}) for apt #${appointment.id} to: ${webhookUrl}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NowsheraClinic-WebhookDispatcher/1.0',
        'X-Clinic-Event': event,
        'X-Clinic-Action': action,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let responseText = '';
    try {
      responseText = await res.text();
    } catch {
      responseText = '';
    }

    const success = res.ok;
    console.log(`[n8n Webhook] Response Status: ${res.status}, Body: ${responseText.substring(0, 100)}`);

    // Log delivery to SQLite audit log
    try {
      db.logAudit(
        `webhook_n8n_${event.replace('.', '_')}`,
        actor?.id || appointment.patientId,
        `n8n webhook ${event} (${action}) ${success ? 'delivered' : 'failed'} (HTTP ${res.status}) for apt #${appointment.id}`
      );
    } catch (dbErr) {
      console.warn('[n8n Webhook] SQLite audit log warning:', dbErr);
    }

    return {
      success,
      statusCode: res.status,
      responseBody: responseText.substring(0, 1000),
      message: success ? `Webhook ${event} successfully delivered to n8n` : `n8n returned HTTP ${res.status}`,
      timestamp,
    };
  } catch (err: any) {
    const isAbort = err.name === 'AbortError';
    const errorMsg = isAbort ? 'Webhook request timed out after 12s' : err.message || 'Unknown network error';
    console.error(`[n8n Webhook] Delivery failed for ${event}:`, errorMsg);

    try {
      db.logAudit(
        `webhook_n8n_${event.replace('.', '_')}_error`,
        actor?.id || appointment.patientId,
        `n8n webhook error for ${event} on apt #${appointment.id}: ${errorMsg}`
      );
    } catch {}

    return {
      success: false,
      error: errorMsg,
      timestamp,
    };
  }
}

/**
 * Backward compatibility helper for patient booking
 */
export async function sendAppointmentBookingToN8n(
  appointment: Appointment,
  patient?: User | null,
  doctor?: User | null
): Promise<N8nWebhookResponse> {
  return sendAppointmentEventToN8n({
    event: 'appointment.booked',
    action: 'NEW_PATIENT_BOOKING',
    appointment,
    patient,
    doctor,
    actor: patient
      ? { id: patient.id, name: patient.name, role: 'patient' }
      : { id: appointment.patientId, name: appointment.patientName, role: 'patient' },
  });
}

/**
 * Helper for Doctor Confirmation to n8n
 */
export async function sendAppointmentConfirmationToN8n(
  appointment: Appointment,
  doctor?: User | null
): Promise<N8nWebhookResponse> {
  return sendAppointmentEventToN8n({
    event: 'appointment.confirmed',
    action: 'DOCTOR_CONFIRMATION',
    appointment,
    doctor,
    actor: doctor
      ? { id: doctor.id, name: doctor.name, role: 'doctor' }
      : { id: appointment.doctorId, name: appointment.doctorName, role: 'doctor' },
  });
}

/**
 * Helper for Doctor Rejection to n8n
 */
export async function sendAppointmentRejectionToN8n(
  appointment: Appointment,
  doctor?: User | null,
  reason?: string
): Promise<N8nWebhookResponse> {
  return sendAppointmentEventToN8n({
    event: 'appointment.rejected',
    action: 'DOCTOR_REJECTION',
    appointment,
    doctor,
    reason,
    actor: doctor
      ? { id: doctor.id, name: doctor.name, role: 'doctor' }
      : { id: appointment.doctorId, name: appointment.doctorName, role: 'doctor' },
  });
}

/**
 * Helper for Appointment Cancellation to n8n (Doctor, Patient, Admin, or Auto)
 */
export async function sendAppointmentCancellationToN8n(
  appointment: Appointment,
  actor?: { id: string; name: string; role: string },
  reason?: string
): Promise<N8nWebhookResponse> {
  return sendAppointmentEventToN8n({
    event: 'appointment.cancelled',
    action: actor?.role === 'doctor' ? 'DOCTOR_CANCELLATION' : 'APPOINTMENT_CANCELLED',
    appointment,
    actor,
    reason: reason || appointment.cancellationReason,
  });
}

/**
 * Sends a test ping payload to verify n8n webhook connectivity.
 */
export async function testN8nWebhook(
  customUrl?: string,
  eventType: AppointmentWebhookEvent = 'appointment.test_ping'
): Promise<N8nWebhookResponse> {
  const webhookUrl = customUrl || process.env.N8N_WEBHOOK_URL || DEFAULT_N8N_WEBHOOK_URL;
  const timestamp = new Date().toISOString();

  const testPayload = {
    event: eventType,
    action: 'TEST_CONNECTION',
    timestamp,
    source: 'Nowshera Family Clinic Web Portal - Integration Test',
    appointment: {
      id: 'apt_test_' + Date.now().toString(36),
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '10:30',
      status: eventType === 'appointment.confirmed' ? 'Confirmed' : eventType === 'appointment.rejected' ? 'Rejected' : 'Pending',
      reason: 'Automated n8n Integration Test Ping',
      cancellationReason: eventType === 'appointment.rejected' ? 'Doctor unavailable at requested time' : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    patient: {
      id: 'usr_pat_test',
      name: 'Ali Raza (Test Patient)',
      email: 'patient.ali@example.com',
      phone: '+92 300 4445566',
    },
    doctor: {
      id: 'usr_doc_ayesha',
      name: 'Dr. Ayesha Siddiqui',
      specialty: 'Cardiologist',
      email: 'dr.ayesha@nowshera.clinic',
      phone: '+92 300 1234501',
    },
    clinic: {
      name: 'Nowshera Family Clinic',
      location: 'Main Grand Trunk Rd, Nowshera, KP, Pakistan',
      phone: '+92 923 610990',
      email: 'care@nowshera.clinic',
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NowsheraClinic-WebhookDispatcher/1.0',
        'X-Clinic-Event': eventType,
        'X-Clinic-Action': 'TEST_CONNECTION',
      },
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseText = await res.text();

    return {
      success: res.ok,
      statusCode: res.status,
      responseBody: responseText.substring(0, 1000),
      message: res.ok ? `Test webhook (${eventType}) received by n8n successfully!` : `n8n returned HTTP ${res.status}`,
      timestamp,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Webhook test timed out after 10s' : err.message,
      timestamp,
    };
  }
}
