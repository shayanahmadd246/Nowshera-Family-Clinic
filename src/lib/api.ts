import {
  User,
  UserRole,
  DoctorSchedule,
  DoctorLeave,
  Appointment,
  EmailNotification,
  AdminDashboardData,
  TimeSlot,
  AuthResponse,
} from '../types';

let currentToken: string | null = localStorage.getItem('clinic_token');

export function setAuthToken(token: string | null) {
  currentToken = token;
  if (token) {
    localStorage.setItem('clinic_token', token);
  } else {
    localStorage.removeItem('clinic_token');
  }
}

export function getAuthToken(): string | null {
  return currentToken || localStorage.getItem('clinic_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || response.statusText };
    }
  }

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMessage);
    (err as any).status = response.status;
    (err as any).data = data;
    throw err;
  }

  return data as T;
}

export const api = {
  // Health
  getHealth: () => request<{ status: string; time: string }>('/api/health'),

  // Auth
  register: (body: { name: string; email: string; phone: string; password: string }) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string; role?: UserRole }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  getMe: () => request<{ user: User }>('/api/auth/me'),

  setDoctorPassword: (body: { token: string; password: string }) =>
    request<{ message: string; user: User; token: string }>('/api/auth/set-doctor-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Doctors & Availability
  getDoctors: () => request<User[]>('/api/doctors'),

  getDoctorSchedules: (doctorId: string) =>
    request<DoctorSchedule[]>(`/api/doctors/${doctorId}/schedules`),

  getDoctorLeaves: (doctorId: string) =>
    request<DoctorLeave[]>(`/api/doctors/${doctorId}/leaves`),

  getDoctorSlots: (doctorId: string, date: string) =>
    request<{ slots: TimeSlot[]; message?: string }>(`/api/doctors/${doctorId}/slots?date=${date}`),

  addDoctorSchedule: (body: { dayOfWeek: number; startTime: string; endTime: string }) =>
    request<DoctorSchedule>('/api/doctor/schedules', { method: 'POST', body: JSON.stringify(body) }),

  deleteDoctorSchedule: (id: string) =>
    request<{ message: string }>(`/api/doctor/schedules/${id}`, { method: 'DELETE' }),

  addDoctorLeave: (body: { date: string; reason?: string }) =>
    request<{ leave: DoctorLeave; cancelledAppointmentsCount: number }>('/api/doctor/leaves', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteDoctorLeave: (id: string) =>
    request<{ message: string }>(`/api/doctor/leaves/${id}`, { method: 'DELETE' }),

  // Appointments
  requestAppointment: (body: { doctorId: string; date: string; startTime: string; reason?: string }) =>
    request<Appointment>('/api/appointments', { method: 'POST', body: JSON.stringify(body) }),

  getAppointments: (params?: { doctorId?: string; date?: string; status?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<Appointment[]>(`/api/appointments${query ? `?${query}` : ''}`);
  },

  getAppointmentById: (id: string) => request<Appointment>(`/api/appointments/${id}`),

  cancelAppointment: (id: string, reason?: string) =>
    request<{ message: string; appointment: Appointment }>(`/api/appointments/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  rescheduleAppointment: (id: string, body: { newDate: string; newStartTime: string }) =>
    request<{ message: string; appointment: Appointment }>(`/api/appointments/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Doctor Actions
  confirmAppointment: (id: string) =>
    request<{ message: string; appointment: Appointment }>(`/api/appointments/${id}/confirm`, {
      method: 'POST',
    }),

  rejectAppointment: (id: string, reason?: string) =>
    request<{ message: string; appointment: Appointment }>(`/api/appointments/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  completeAppointment: (id: string, notes?: string) =>
    request<{ message: string; appointment: Appointment }>(`/api/appointments/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  markNoShowAppointment: (id: string, notes?: string) =>
    request<{ message: string; appointment: Appointment }>(`/api/appointments/${id}/no-show`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  updateAppointmentNotes: (id: string, notes: string) =>
    request<{ message: string; appointment: Appointment }>(`/api/appointments/${id}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    }),

  getPatientHistoryForDoctor: (patientId: string) =>
    request<{ patient?: { id: string; name: string; email: string; phone: string }; appointments: Appointment[] }>(
      `/api/doctor/patients/${patientId}/history`
    ),

  // Admin Controls
  createDoctor: (body: { name: string; email: string; phone?: string; specialty: string }) =>
    request<{ doctor: User; setupPasswordToken: string; setupUrl: string }>('/api/admin/doctors', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  generateDoctorCredentials: (body: { specialty?: string; doctorName?: string }) =>
    request<{
      name: string;
      email: string;
      password?: string;
      specialty: string;
      phone: string;
      qualifications: string;
      experience: string;
      suggestedSchedule: { days: string[]; startTime: string; endTime: string };
      bio: string;
    }>('/api/ai/generate-doctor-credentials', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  toggleDoctorStatus: (doctorId: string, isActive: boolean) =>
    request<{ message: string; doctor: User }>(`/api/admin/doctors/${doctorId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  getAdminPatients: (q?: string) =>
    request<Array<User & { totalAppointments: number; completedVisits: number; lastVisitDate: string | null }>>(
      `/api/admin/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`
    ),

  getAdminDashboard: () => request<AdminDashboardData>('/api/admin/dashboard'),

  // Email Notifications & Automations
  getEmails: () => request<EmailNotification[]>('/api/emails'),

  runAutomations: () =>
    request<{ timestamp: string; cancelledPendingCount: number; remindersSentCount: number; details: string[] }>(
      '/api/automations/run',
      { method: 'POST' }
    ),

  // Test Harness
  resetDatabase: () => request<{ message: string }>('/api/test/reset', { method: 'POST' }),

  setTimeOffset: (offsetMs: number) =>
    request<{ currentTime: string; offsetMs: number }>('/api/test/set-time-offset', {
      method: 'POST',
      body: JSON.stringify({ offsetMs }),
    }),

  getToken: () => getAuthToken(),

  // Automated AI
  triageSymptoms: (body: { symptoms: string; patientAge?: number }) =>
    request<import('../types').AiSymptomTriageResult>('/api/ai/triage', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  generateSoapNotes: (body: { patientName: string; visitReason: string; clinicalObservations?: string }) =>
    request<import('../types').AiClinicalSoapNotes>('/api/ai/soap-notes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getAiClinicInsights: () =>
    request<import('../types').AiClinicInsights>('/api/admin/ai/insights'),

  // n8n Webhook Integration
  getN8nWebhookStatus: () =>
    request<{ webhookUrl: string; isConfigured: boolean; supportedEvents: string[] }>('/api/integrations/n8n/status'),

  testN8nWebhook: (webhookUrl?: string, eventType?: string) =>
    request<{
      success: boolean;
      statusCode?: number;
      message?: string;
      responseBody?: string;
      error?: string;
      timestamp: string;
    }>('/api/integrations/n8n/test', {
      method: 'POST',
      body: JSON.stringify({ webhookUrl, eventType }),
    }),
};
