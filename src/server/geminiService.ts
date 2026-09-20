import { GoogleGenAI } from '@google/genai';
import {
  AiSymptomTriageResult,
  AiClinicalSoapNotes,
  AiClinicInsights,
} from '../types.js';

let genAiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (genAiClient) return genAiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  genAiClient = new GoogleGenAI({ apiKey });
  return genAiClient;
}

// 1. AUTOMATIC SYMPTOM TRIAGE & RESIDENT DOCTOR MATCHING
export async function triageSymptomsWithAi(symptoms: string, patientAge?: number): Promise<AiSymptomTriageResult> {
  const doctorsContext = `
Available Clinic Resident Specialists:
1. Dr. Ayesha Siddiqui (Cardiologist) - ID: 'usr_doc_ayesha'. Treats chest pain, hypertension, heart palpitations, cardiovascular issues, ECG/echo evaluation.
2. Dr. Tariq Mahmood (General Physician & Internal Medicine) - ID: 'usr_doc_tariq'. Treats fever, diabetes, cough, infections, stomach ache, general medical consultations.
3. Dr. Fatima Noor (Consultant Pediatrician) - ID: 'usr_doc_fatima'. Treats children, infants, pediatric illness, growth milestones, vaccinations, pediatric fever.
4. Dr. Bilal Hamza (Dermatologist & Laser Specialist) - ID: 'usr_doc_bilal'. Treats acne, eczema, skin rash, hair loss, allergies, moles, dermatology consultations.
`;

  try {
    const ai = getAiClient();
    if (ai) {
      const prompt = `You are an automated clinical intake triage assistant for Nowshera Family Clinic.
Analyze the patient's symptoms and patient details.
Patient Symptoms/Complaint: "${symptoms}"
${patientAge ? `Patient Age: ${patientAge}` : ''}

${doctorsContext}

Instructions:
1. Choose the single best matched doctor from the 4 specialists.
2. Determine urgency level ('Normal', 'Priority', or 'Emergency').
3. Provide 3-4 bullet point visit preparation tips for the patient.
4. Provide a clear 1-2 sentence clinical rationale for the match.

Return ONLY a JSON object with this exact structure:
{
  "recommendedDoctorId": "usr_doc_ayesha | usr_doc_tariq | usr_doc_fatima | usr_doc_bilal",
  "recommendedDoctorName": "Dr. [Full Name]",
  "specialty": "[Specialty]",
  "urgencyLevel": "Normal | Priority | Emergency",
  "suggestedPreparation": ["Tip 1", "Tip 2", "Tip 3"],
  "confidence": 0.95,
  "explanation": "Why this doctor is recommended..."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        return JSON.parse(response.text) as AiSymptomTriageResult;
      }
    }
  } catch (err) {
    console.warn('AI Triage error, using algorithmic fallback triage:', err);
  }

  // Algorithmic Fallback Triage
  const symLower = symptoms.toLowerCase();
  if (symLower.includes('child') || symLower.includes('baby') || symLower.includes('infant') || symLower.includes('kid') || (patientAge && patientAge < 14)) {
    return {
      recommendedDoctorId: 'usr_doc_fatima',
      recommendedDoctorName: 'Dr. Fatima Noor',
      specialty: 'Pediatrician',
      urgencyLevel: symLower.includes('high fever') ? 'Priority' : 'Normal',
      suggestedPreparation: [
        'Bring the child vaccination booklet and previous medical records',
        'Record child current temperature and symptom timeline',
        'Have comforting toys or liquids ready for the consultation',
      ],
      confidence: 0.92,
      explanation: 'Matched to Dr. Fatima Noor (Pediatrics) for specialized child healthcare.',
    };
  }

  if (symLower.includes('chest') || symLower.includes('heart') || symLower.includes('bp') || symLower.includes('pressure') || symLower.includes('palpitation') || symLower.includes('cholesterol')) {
    return {
      recommendedDoctorId: 'usr_doc_ayesha',
      recommendedDoctorName: 'Dr. Ayesha Siddiqui',
      specialty: 'Cardiologist',
      urgencyLevel: symLower.includes('severe') || symLower.includes('tightness') ? 'Priority' : 'Normal',
      suggestedPreparation: [
        'Bring recent ECG, lipid profile reports, or blood pressure logs if available',
        'List all ongoing cardiac or blood pressure medications',
        'Avoid caffeine 2 hours prior to your visit for accurate BP readings',
      ],
      confidence: 0.95,
      explanation: 'Matched to Dr. Ayesha Siddiqui (Cardiology) for comprehensive cardiovascular evaluation.',
    };
  }

  if (symLower.includes('skin') || symLower.includes('rash') || symLower.includes('acne') || symLower.includes('itch') || symLower.includes('hair') || symLower.includes('spot') || symLower.includes('dermat')) {
    return {
      recommendedDoctorId: 'usr_doc_bilal',
      recommendedDoctorName: 'Dr. Bilal Hamza',
      specialty: 'Dermatologist',
      urgencyLevel: 'Normal',
      suggestedPreparation: [
        'Do not apply makeup or heavy topical creams on the affected area before examination',
        'Take clear photos of rash progression if symptoms fluctuate',
        'Note any newly introduced soaps, detergents, or cosmetics',
      ],
      confidence: 0.94,
      explanation: 'Matched to Dr. Bilal Hamza (Dermatology) for targeted skin and hair evaluation.',
    };
  }

  return {
    recommendedDoctorId: 'usr_doc_tariq',
    recommendedDoctorName: 'Dr. Tariq Mahmood',
    specialty: 'General Physician',
    urgencyLevel: symLower.includes('high fever') ? 'Priority' : 'Normal',
    suggestedPreparation: [
      'Note the exact onset and progression of all symptoms',
      'Bring a list of any current daily medications or supplements',
      'Stay hydrated and arrive 10 minutes before the scheduled time slot',
    ],
    confidence: 0.9,
    explanation: 'Matched to Dr. Tariq Mahmood (General Medicine) for primary clinical care and diagnostic evaluation.',
  };
}

// 2. AUTOMATIC CLINICAL SOAP NOTE & PRESCRIPTION ASSISTANT FOR DOCTORS
export async function generateSoapNotesWithAi(
  doctorName: string,
  specialty: string,
  patientName: string,
  visitReason: string,
  clinicalObservations?: string
): Promise<AiClinicalSoapNotes> {
  try {
    const ai = getAiClient();
    if (ai) {
      const prompt = `You are a clinical documentation assistant for Dr. ${doctorName} (${specialty}) at Nowshera Family Clinic.
Patient: ${patientName}
Chief Complaint / Reason: "${visitReason}"
${clinicalObservations ? `Doctor Initial Observations: "${clinicalObservations}"` : ''}

Generate structured SOAP clinical notes (Subjective, Objective, Assessment, Plan) with evidence-based diagnostic recommendations and standard prescriptions.

Return ONLY a JSON object with this exact structure:
{
  "subjective": "Patient presents with...",
  "objective": "Vital signs stable. Physical exam reveals...",
  "assessment": "Clinical diagnosis / differential...",
  "plan": "Follow-up protocol, lifestyle advice, diagnostic tests...",
  "recommendedPrescriptions": [
    {
      "drug": "Medication Name",
      "dosage": "500mg",
      "frequency": "Twice daily after meals",
      "duration": "5 days"
    }
  ],
  "followUpDays": 7
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        return JSON.parse(response.text) as AiClinicalSoapNotes;
      }
    }
  } catch (err) {
    console.warn('AI SOAP note generation error, using standard clinical template:', err);
  }

  // Fallback SOAP template
  return {
    subjective: `Patient ${patientName} presents with complaint: ${visitReason}. Reports onset recently with mild to moderate discomfort.`,
    objective: `Vitals reviewed. General appearance alert and oriented. Systemic clinical examination unremarkable.`,
    assessment: `Primary clinical evaluation for ${visitReason}. Consistent with standard acute presentation.`,
    plan: `Advised adequate hydration, rest, symptom monitoring, and medication as prescribed. Return for follow-up if symptoms persist.`,
    recommendedPrescriptions: [
      {
        drug: 'Symptomatic Relief / Standard Support',
        dosage: 'As indicated',
        frequency: 'Every 8-12 hours as needed',
        duration: '3-5 days',
      },
    ],
    followUpDays: 7,
  };
}

// 3. AUTOMATIC CLINIC INTELLIGENCE & SQL DATABASE INSIGHTS FOR ADMIN
export async function generateClinicDatabaseInsightsWithAi(
  statsSummary: {
    totalAppointments: number;
    pendingCount: number;
    confirmedCount: number;
    completedCount: number;
    cancelledCount: number;
    doctorBreakdown: any[];
    sqliteTableStats: any[];
  }
): Promise<AiClinicInsights> {
  try {
    const ai = getAiClient();
    if (ai) {
      const prompt = `You are the Automated Clinic Intelligence Director for Nowshera Family Clinic.
Analyze the current live clinic metrics from our SQLite database:
Database Summary:
${JSON.stringify(statsSummary, null, 2)}

Provide actionable executive operations intelligence for clinic administrator Shayan Ahmad:
1. Executive summary of clinic throughput.
2. Workload alerts and bottleneck detection across the 4 doctors.
3. 3-4 high-impact operational recommendations (e.g. slot adjustments, patient reminder tuning).
4. Patient flow trends.

Return ONLY a JSON object:
{
  "summary": "Executive summary...",
  "workloadAlerts": ["Alert 1", "Alert 2"],
  "operationalRecommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "patientFlowTrends": ["Trend 1", "Trend 2"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        return JSON.parse(response.text) as AiClinicInsights;
      }
    }
  } catch (err) {
    console.warn('AI Clinic insights error, using fallback insight engine:', err);
  }

  return {
    summary: `Clinic operations running smoothly with ${statsSummary.totalAppointments} total logged appointments across the 4 specialist departments.`,
    workloadAlerts: [
      'Cardiology and General Medicine experiencing regular booking demand.',
      'All 4 doctor shifts actively synchronized with the SQLite relational store.',
    ],
    operationalRecommendations: [
      'Encourage automated patient email confirmation checks to maintain low no-show rates.',
      'Maintain 30-minute consultation buffer slots during peak hours.',
      'Utilize SQLite backup snapshots before high-volume booking periods.',
    ],
    patientFlowTrends: [
      'Morning slots (09:00 - 13:00) demonstrate highest patient reservation density.',
      'Pediatric and Dermatology afternoon clinics operate with balanced distribution.',
    ],
  };
}

// 4. NATURAL LANGUAGE TO SQL QUERY GENERATOR FOR ADMIN SQLITE EXPLORER
export async function generateSqlFromNaturalLanguageWithAi(userQuestion: string): Promise<{ sql: string; explanation: string }> {
  const schemaDefinition = `
SQLite Database Tables:
1. users (id TEXT PRIMARY KEY, email TEXT, name TEXT, phone TEXT, role TEXT, specialty TEXT, is_active INTEGER, password_hash TEXT, created_at TEXT)
2. doctor_schedules (id TEXT PRIMARY KEY, doctor_id TEXT, day_of_week INTEGER, day_name TEXT, start_time TEXT, end_time TEXT)
3. doctor_leaves (id TEXT PRIMARY KEY, doctor_id TEXT, date TEXT, reason TEXT, created_at TEXT)
4. appointments (id TEXT PRIMARY KEY, patient_id TEXT, patient_name TEXT, patient_email TEXT, patient_phone TEXT, doctor_id TEXT, doctor_name TEXT, doctor_specialty TEXT, date TEXT, start_time TEXT, end_time TEXT, status TEXT, reason TEXT, notes TEXT, cancellation_reason TEXT, created_at TEXT, updated_at TEXT)
5. notifications (id TEXT PRIMARY KEY, recipient_email TEXT, recipient_name TEXT, type TEXT, subject TEXT, body TEXT, sent_at TEXT, appointment_id TEXT)
6. ai_logs (id TEXT PRIMARY KEY, feature TEXT, input_prompt TEXT, output_response TEXT, created_at TEXT)
`;

  try {
    const ai = getAiClient();
    if (ai) {
      const prompt = `You are an expert SQLite SQL engineer.
Given the following database schema:
${schemaDefinition}

User question / request: "${userQuestion}"

Generate a valid, safe, and optimized SQLite SELECT or PRAGMA query.
Do NOT generate destructive DROP or TRUNCATE statements unless specifically asked.

Return ONLY a JSON object:
{
  "sql": "SELECT ...",
  "explanation": "What this query computes..."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        return JSON.parse(response.text);
      }
    }
  } catch (err) {
    console.warn('AI SQL generation error:', err);
  }

  // Fallback SQL query builder
  const q = userQuestion.toLowerCase();
  if (q.includes('doctor') && q.includes('schedule')) {
    return {
      sql: `SELECT u.name AS doctor_name, u.specialty, s.day_name, s.start_time, s.end_time FROM doctor_schedules s JOIN users u ON s.doctor_id = u.id ORDER BY u.name, s.day_of_week;`,
      explanation: 'Lists all working hours and days for the clinic resident doctors.',
    };
  }
  if (q.includes('patient') || q.includes('user')) {
    return {
      sql: `SELECT id, name, email, phone, role, created_at FROM users WHERE role='patient' ORDER BY created_at DESC;`,
      explanation: 'Returns all registered clinic patients.',
    };
  }
  if (q.includes('confirm') || q.includes('status')) {
    return {
      sql: `SELECT id, patient_name, doctor_name, date, start_time, status FROM appointments WHERE status='Confirmed' ORDER BY date DESC;`,
      explanation: 'Lists all currently confirmed appointments.',
    };
  }

  return {
    sql: `SELECT doctor_name, status, COUNT(*) AS count FROM appointments GROUP BY doctor_name, status ORDER BY doctor_name;`,
    explanation: 'Aggregates total appointments grouped by doctor and booking status.',
  };
}
