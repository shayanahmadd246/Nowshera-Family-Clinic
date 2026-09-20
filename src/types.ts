export type UserRole = 'patient' | 'doctor' | 'admin';

export type AppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed'
  | 'No-show';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone: string;
  specialty?: string;
  isActive?: boolean; // For doctors
  setupPasswordToken?: string;
  createdAt: string;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayName: string;   // 'Monday', 'Tuesday', etc.
  startTime: string; // '09:00'
  endTime: string;   // '13:00'
}

export interface DoctorLeave {
  id: string;
  doctorId: string;
  date: string; // 'YYYY-MM-DD'
  reason?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // '09:00'
  endTime: string;   // '09:30'
  status: AppointmentStatus;
  reason?: string;
  notes?: string; // Clinical notes (only doctor who saw them and patient can read; admin cannot)
  cancellationReason?: string;
  reminderSent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailNotification {
  id: string;
  recipientEmail: string;
  recipientName: string;
  type:
    | 'doctor_welcome_set_password'
    | 'appointment_requested'
    | 'appointment_confirmed'
    | 'appointment_rejected'
    | 'appointment_cancelled'
    | 'appointment_reminder';
  subject: string;
  body: string;
  sentAt: string;
  appointmentId?: string;
  metadata?: Record<string, unknown>;
}

export interface DoctorStats {
  doctorId: string;
  doctorName: string;
  specialty: string;
  isActive: boolean;
  pending: number;
  confirmed: number;
  completed: number;
  noShow: number;
  cancelled: number;
  total: number;
}

export interface AdminDashboardData {
  todayDate: string;
  todayAppointmentsCount: number;
  todayAppointments: Appointment[];
  doctorStats: DoctorStats[];
  totalPatientsCount: number;
  totalDoctorsCount: number;
}

export interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reasonUnavailable?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TestCaseResult {
  id: number;
  title: string;
  description: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  logs: string[];
  error?: string;
}

export interface SqliteColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

export interface SqliteTableInfo {
  name: string;
  rowCount: number;
  columns: SqliteColumnInfo[];
}

export interface SqliteQueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

export interface SqliteDatabaseStats {
  filePath: string;
  fileSizeBytes: number;
  tableCount: number;
  totalRows: number;
  tables: SqliteTableInfo[];
  version: string;
  lastSyncedAt: string;
}

export interface AiSymptomTriageResult {
  recommendedDoctorId: string;
  recommendedDoctorName: string;
  specialty: string;
  urgencyLevel: 'Normal' | 'Priority' | 'Emergency';
  suggestedPreparation: string[];
  confidence: number;
  explanation: string;
}

export interface AiClinicalSoapNotes {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  recommendedPrescriptions: {
    drug: string;
    dosage: string;
    frequency: string;
    duration: string;
  }[];
  followUpDays?: number;
}

export interface AiClinicInsights {
  summary: string;
  workloadAlerts: string[];
  operationalRecommendations: string[];
  patientFlowTrends: string[];
}
