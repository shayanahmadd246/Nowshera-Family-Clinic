import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import {
  User,
  DoctorSchedule,
  DoctorLeave,
  Appointment,
  EmailNotification,
  SqliteDatabaseStats,
  SqliteTableInfo,
  SqliteQueryResult,
} from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const SQLITE_FILE = path.join(DATA_DIR, 'clinic.sqlite');

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export class SQLiteClinicDatabase {
  private sqlDb: SqlJsDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private systemTimeOffsetMs = 0;

  constructor() {
    this.initPromise = this.init();
  }

  public async ready(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private async init(): Promise<void> {
    if (this.isInitialized && this.sqlDb) return;

    ensureDataDir();
    const SQL = await initSqlJs();

    if (fs.existsSync(SQLITE_FILE)) {
      try {
        const fileBuffer = fs.readFileSync(SQLITE_FILE);
        this.sqlDb = new SQL.Database(fileBuffer);
      } catch (err) {
        console.error('Error loading existing SQLite database file, creating fresh database:', err);
        this.sqlDb = new SQL.Database();
      }
    } else {
      this.sqlDb = new SQL.Database();
    }

    this.createTables();
    this.seedDefaultData();
    this.saveToDisk();
    this.isInitialized = true;
  }

  private saveToDisk(): void {
    if (!this.sqlDb) return;
    try {
      ensureDataDir();
      const binaryArray = this.sqlDb.export();
      fs.writeFileSync(SQLITE_FILE, Buffer.from(binaryArray));
    } catch (err) {
      console.error('Error saving SQLite database to disk:', err);
    }
  }

  private createTables(): void {
    if (!this.sqlDb) return;

    this.sqlDb.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('patient', 'doctor', 'admin')),
        specialty TEXT,
        is_active INTEGER DEFAULT 1,
        password_hash TEXT NOT NULL,
        setup_password_token TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS doctor_schedules (
        id TEXT PRIMARY KEY,
        doctor_id TEXT NOT NULL,
        day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
        day_name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        FOREIGN KEY(doctor_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS doctor_leaves (
        id TEXT PRIMARY KEY,
        doctor_id TEXT NOT NULL,
        date TEXT NOT NULL,
        reason TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(doctor_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        patient_email TEXT NOT NULL,
        patient_phone TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        doctor_name TEXT NOT NULL,
        doctor_specialty TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Pending', 'Confirmed', 'Rejected', 'Cancelled', 'Completed', 'No-show')),
        reason TEXT,
        notes TEXT,
        cancellation_reason TEXT,
        reminder_sent INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(doctor_id) REFERENCES users(id),
        FOREIGN KEY(patient_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        type TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        appointment_id TEXT
      );

      CREATE TABLE IF NOT EXISTS ai_logs (
        id TEXT PRIMARY KEY,
        feature TEXT NOT NULL,
        input_prompt TEXT,
        output_response TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        user_id TEXT,
        details TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  private seedDefaultData(): void {
    if (!this.sqlDb) return;
    const now = new Date().toISOString();

    // Check if admin exists
    const adminCheck = this.sqlDb.exec(`SELECT id FROM users WHERE email = 'shayanahmadd246@gmail.com' AND role = 'admin'`);
    if (!adminCheck.length || !adminCheck[0].values.length) {
      const adminPassHash = hashPassword('shayan123');
      this.sqlDb.run(
        `INSERT INTO users (id, email, name, phone, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['usr_admin_1', 'shayanahmadd246@gmail.com', 'Admin Shayan Ahmad', '+92 300 9998877', 'admin', adminPassHash, now]
      );
    } else {
      // Ensure admin password hash is shayan123
      const adminPassHash = hashPassword('shayan123');
      this.sqlDb.run(`UPDATE users SET password_hash = ? WHERE email = 'shayanahmadd246@gmail.com' AND role = 'admin'`, [adminPassHash]);
    }

    // Seed 4 resident doctors if missing
    const doc1Check = this.sqlDb.exec(`SELECT id FROM users WHERE id = 'usr_doc_ayesha'`);
    if (!doc1Check.length || !doc1Check[0].values.length) {
      this.sqlDb.run(
        `INSERT INTO users (id, email, name, phone, role, specialty, is_active, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['usr_doc_ayesha', 'dr.ayesha@nowshera.clinic', 'Dr. Ayesha Siddiqui', '+92 300 1234501', 'doctor', 'Cardiologist', 1, hashPassword('ayesha123'), now]
      );
    }

    const doc2Check = this.sqlDb.exec(`SELECT id FROM users WHERE id = 'usr_doc_tariq'`);
    if (!doc2Check.length || !doc2Check[0].values.length) {
      this.sqlDb.run(
        `INSERT INTO users (id, email, name, phone, role, specialty, is_active, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['usr_doc_tariq', 'dr.tariq@nowshera.clinic', 'Dr. Tariq Mahmood', '+92 300 1234502', 'doctor', 'General Physician', 1, hashPassword('tariq123'), now]
      );
    }

    const doc3Check = this.sqlDb.exec(`SELECT id FROM users WHERE id = 'usr_doc_fatima'`);
    if (!doc3Check.length || !doc3Check[0].values.length) {
      this.sqlDb.run(
        `INSERT INTO users (id, email, name, phone, role, specialty, is_active, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['usr_doc_fatima', 'dr.fatima@nowshera.clinic', 'Dr. Fatima Noor', '+92 300 1234503', 'doctor', 'Pediatrician', 1, hashPassword('fatima123'), now]
      );
    }

    const doc4Check = this.sqlDb.exec(`SELECT id FROM users WHERE id = 'usr_doc_bilal'`);
    if (!doc4Check.length || !doc4Check[0].values.length) {
      this.sqlDb.run(
        `INSERT INTO users (id, email, name, phone, role, specialty, is_active, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['usr_doc_bilal', 'dr.bilal@nowshera.clinic', 'Dr. Bilal Hamza', '+92 300 1234504', 'doctor', 'Dermatologist', 1, hashPassword('bilal123'), now]
      );
    }

    // Seed Demo Patients if missing
    const pat1Check = this.sqlDb.exec(`SELECT id FROM users WHERE id = 'usr_pat_ali'`);
    if (!pat1Check.length || !pat1Check[0].values.length) {
      this.sqlDb.run(
        `INSERT INTO users (id, email, name, phone, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['usr_pat_ali', 'patient.ali@example.com', 'Ali Raza', '+92 300 4445566', 'patient', hashPassword('patient123'), now]
      );
      this.sqlDb.run(
        `INSERT INTO users (id, email, name, phone, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['usr_pat_sara', 'patient.sara@example.com', 'Sara Ahmed', '+92 321 7654321', 'patient', hashPassword('patient123'), now]
      );
    }

    // Seed schedules if empty
    const schCheck = this.sqlDb.exec(`SELECT count(*) FROM doctor_schedules`);
    const count = schCheck.length && schCheck[0].values.length ? Number(schCheck[0].values[0][0]) : 0;
    if (count === 0) {
      const defaultSchedules = [
        // Dr. Ayesha (Mon-Fri 09:00 - 13:00)
        ['sch_ayesha_mon', 'usr_doc_ayesha', 1, 'Monday', '09:00', '13:00'],
        ['sch_ayesha_tue', 'usr_doc_ayesha', 2, 'Tuesday', '09:00', '13:00'],
        ['sch_ayesha_wed', 'usr_doc_ayesha', 3, 'Wednesday', '09:00', '13:00'],
        ['sch_ayesha_thu', 'usr_doc_ayesha', 4, 'Thursday', '09:00', '13:00'],
        ['sch_ayesha_fri', 'usr_doc_ayesha', 5, 'Friday', '09:00', '13:00'],

        // Dr. Tariq (Mon-Fri 14:00 - 18:00)
        ['sch_tariq_mon', 'usr_doc_tariq', 1, 'Monday', '14:00', '18:00'],
        ['sch_tariq_tue', 'usr_doc_tariq', 2, 'Tuesday', '14:00', '18:00'],
        ['sch_tariq_wed', 'usr_doc_tariq', 3, 'Wednesday', '14:00', '18:00'],
        ['sch_tariq_thu', 'usr_doc_tariq', 4, 'Thursday', '14:00', '18:00'],
        ['sch_tariq_fri', 'usr_doc_tariq', 5, 'Friday', '14:00', '18:00'],

        // Dr. Fatima (Mon-Thu 10:00 - 14:00)
        ['sch_fatima_mon', 'usr_doc_fatima', 1, 'Monday', '10:00', '14:00'],
        ['sch_fatima_tue', 'usr_doc_fatima', 2, 'Tuesday', '10:00', '14:00'],
        ['sch_fatima_wed', 'usr_doc_fatima', 3, 'Wednesday', '10:00', '14:00'],
        ['sch_fatima_thu', 'usr_doc_fatima', 4, 'Thursday', '10:00', '14:00'],

        // Dr. Bilal (Tue-Sat 15:00 - 19:00)
        ['sch_bilal_tue', 'usr_doc_bilal', 2, 'Tuesday', '15:00', '19:00'],
        ['sch_bilal_wed', 'usr_doc_bilal', 3, 'Wednesday', '15:00', '19:00'],
        ['sch_bilal_thu', 'usr_doc_bilal', 4, 'Thursday', '15:00', '19:00'],
        ['sch_bilal_fri', 'usr_doc_bilal', 5, 'Friday', '15:00', '19:00'],
        ['sch_bilal_sat', 'usr_doc_bilal', 6, 'Saturday', '15:00', '19:00'],
      ];

      for (const row of defaultSchedules) {
        this.sqlDb.run(
          `INSERT INTO doctor_schedules (id, doctor_id, day_of_week, day_name, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`,
          row
        );
      }
    }
  }

  // Time utilities
  public getCurrentTime(): Date {
    return new Date(Date.now() + this.systemTimeOffsetMs);
  }

  public setSystemTimeOffset(offsetMs: number): void {
    this.systemTimeOffsetMs = offsetMs;
  }

  // RAW SQL EXECUTION for Admin SQL Console
  public executeSql(sqlQuery: string): SqliteQueryResult {
    if (!this.sqlDb) {
      throw new Error('SQLite database is not initialized');
    }
    const start = performance.now();
    try {
      const results = this.sqlDb.exec(sqlQuery);
      const executionTimeMs = Math.round((performance.now() - start) * 100) / 100;
      this.saveToDisk();

      if (!results.length) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs,
        };
      }

      const first = results[0];
      return {
        columns: first.columns,
        rows: first.values,
        rowCount: first.values.length,
        executionTimeMs,
      };
    } catch (err: any) {
      const executionTimeMs = Math.round((performance.now() - start) * 100) / 100;
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs,
        error: err.message || String(err),
      };
    }
  }

  // Table information and database stats
  public getDatabaseStats(): SqliteDatabaseStats {
    if (!this.sqlDb) {
      throw new Error('SQLite database is not initialized');
    }

    const tableNamesRes = this.sqlDb.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC`
    );

    const tables: SqliteTableInfo[] = [];
    let totalRows = 0;

    if (tableNamesRes.length && tableNamesRes[0].values.length) {
      for (const [tblNameVal] of tableNamesRes[0].values) {
        const tblName = String(tblNameVal);
        const countRes = this.sqlDb.exec(`SELECT COUNT(*) FROM "${tblName}"`);
        const rowCount = countRes.length && countRes[0].values.length ? Number(countRes[0].values[0][0]) : 0;
        totalRows += rowCount;

        const pragmaRes = this.sqlDb.exec(`PRAGMA table_info("${tblName}")`);
        const columns = pragmaRes.length
          ? pragmaRes[0].values.map((v) => ({
              cid: Number(v[0]),
              name: String(v[1]),
              type: String(v[2]),
              notnull: Number(v[3]),
              dflt_value: v[4],
              pk: Number(v[5]),
            }))
          : [];

        tables.push({
          name: tblName,
          rowCount,
          columns,
        });
      }
    }

    let fileSizeBytes = 0;
    if (fs.existsSync(SQLITE_FILE)) {
      const stat = fs.statSync(SQLITE_FILE);
      fileSizeBytes = stat.size;
    }

    return {
      filePath: SQLITE_FILE,
      fileSizeBytes,
      tableCount: tables.length,
      totalRows,
      tables,
      version: 'SQLite 3 (WebAssembly sql.js)',
      lastSyncedAt: new Date().toISOString(),
    };
  }

  // Download raw SQLite binary buffer
  public getDatabaseBinary(): Buffer {
    if (!this.sqlDb) {
      throw new Error('SQLite database is not initialized');
    }
    const binary = this.sqlDb.export();
    return Buffer.from(binary);
  }

  // Export full database as JSON
  public exportToJson(): Record<string, any[]> {
    if (!this.sqlDb) {
      throw new Error('SQLite database is not initialized');
    }
    const stats = this.getDatabaseStats();
    const exportData: Record<string, any[]> = {};

    for (const table of stats.tables) {
      const res = this.sqlDb.exec(`SELECT * FROM "${table.name}"`);
      if (res.length && res[0].values.length) {
        const cols = res[0].columns;
        exportData[table.name] = res[0].values.map((valRow) => {
          const rowObj: Record<string, any> = {};
          cols.forEach((col, idx) => {
            rowObj[col] = valRow[idx];
          });
          return rowObj;
        });
      } else {
        exportData[table.name] = [];
      }
    }

    return exportData;
  }

  // Reset database to seed defaults
  public resetDatabase(): void {
    if (!this.sqlDb) return;
    this.sqlDb.run(`
      DROP TABLE IF EXISTS system_settings;
      DROP TABLE IF EXISTS ai_logs;
      DROP TABLE IF EXISTS notifications;
      DROP TABLE IF EXISTS appointments;
      DROP TABLE IF EXISTS doctor_leaves;
      DROP TABLE IF EXISTS doctor_schedules;
      DROP TABLE IF EXISTS users;
    `);
    this.createTables();
    this.seedDefaultData();
    this.saveToDisk();
  }

  // ----------------------------------------------------
  // TYPED REPOSITORY ACCESSORS
  // ----------------------------------------------------

  public getUsers(): (User & { passwordHash: string })[] {
    if (!this.sqlDb) return [];
    const res = this.sqlDb.exec(`SELECT * FROM users ORDER BY created_at DESC`);
    if (!res.length) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const u: any = {};
      cols.forEach((c, idx) => {
        if (c === 'password_hash') u.passwordHash = v[idx];
        else if (c === 'is_active') u.isActive = v[idx] === 1;
        else if (c === 'created_at') u.createdAt = v[idx];
        else if (c === 'setup_password_token') u.setupPasswordToken = v[idx] || undefined;
        else u[c] = v[idx];
      });
      return u;
    });
  }

  public findUserById(id: string): (User & { passwordHash: string }) | undefined {
    if (!this.sqlDb) return undefined;
    const stmt = this.sqlDb.prepare(`SELECT * FROM users WHERE id = :id`);
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: String(row.id),
        email: String(row.email),
        name: String(row.name),
        phone: String(row.phone),
        role: row.role as any,
        specialty: row.specialty ? String(row.specialty) : undefined,
        isActive: row.is_active === 1,
        passwordHash: String(row.password_hash),
        setupPasswordToken: row.setup_password_token ? String(row.setup_password_token) : undefined,
        createdAt: String(row.created_at),
      };
    }
    stmt.free();
    return undefined;
  }

  public findUserByEmail(email: string, role?: string): (User & { passwordHash: string }) | undefined {
    if (!this.sqlDb) return undefined;
    const normalized = email.toLowerCase().trim();
    let query = `SELECT * FROM users WHERE lower(email) = :email`;
    const params: any = { ':email': normalized };
    if (role) {
      query += ` AND role = :role`;
      params[':role'] = role;
    }
    const stmt = this.sqlDb.prepare(query);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: String(row.id),
        email: String(row.email),
        name: String(row.name),
        phone: String(row.phone),
        role: row.role as any,
        specialty: row.specialty ? String(row.specialty) : undefined,
        isActive: row.is_active === 1,
        passwordHash: String(row.password_hash),
        setupPasswordToken: row.setup_password_token ? String(row.setup_password_token) : undefined,
        createdAt: String(row.created_at),
      };
    }
    stmt.free();
    return undefined;
  }

  public findUserByToken(token: string): (User & { passwordHash: string }) | undefined {
    if (!this.sqlDb) return undefined;
    const stmt = this.sqlDb.prepare(`SELECT * FROM users WHERE setup_password_token = :token`);
    stmt.bind({ ':token': token });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: String(row.id),
        email: String(row.email),
        name: String(row.name),
        phone: String(row.phone),
        role: row.role as any,
        specialty: row.specialty ? String(row.specialty) : undefined,
        isActive: row.is_active === 1,
        passwordHash: String(row.password_hash),
        setupPasswordToken: row.setup_password_token ? String(row.setup_password_token) : undefined,
        createdAt: String(row.created_at),
      };
    }
    stmt.free();
    return undefined;
  }

  public createUser(user: User & { passwordHash: string }): User {
    if (!this.sqlDb) throw new Error('Database not ready');
    this.sqlDb.run(
      `INSERT INTO users (id, email, name, phone, role, specialty, is_active, password_hash, setup_password_token, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.email.toLowerCase().trim(),
        user.name.trim(),
        user.phone.trim(),
        user.role,
        user.specialty || null,
        user.isActive === false ? 0 : 1,
        user.passwordHash,
        user.setupPasswordToken || null,
        user.createdAt,
      ]
    );
    this.saveToDisk();
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  public updateUser(id: string, updates: Partial<User & { passwordHash: string }>): User | undefined {
    if (!this.sqlDb) return undefined;
    const current = this.findUserById(id);
    if (!current) return undefined;

    const merged = { ...current, ...updates };
    this.sqlDb.run(
      `UPDATE users SET name = ?, email = ?, phone = ?, specialty = ?, is_active = ?, password_hash = ?, setup_password_token = ? WHERE id = ?`,
      [
        merged.name,
        merged.email.toLowerCase().trim(),
        merged.phone,
        merged.specialty || null,
        merged.isActive ? 1 : 0,
        merged.passwordHash,
        merged.setupPasswordToken || null,
        id,
      ]
    );
    this.saveToDisk();
    const { passwordHash: _, ...safe } = merged;
    return safe;
  }

  // Schedules
  public getSchedules(doctorId?: string): DoctorSchedule[] {
    if (!this.sqlDb) return [];
    let query = `SELECT * FROM doctor_schedules`;
    const params: any[] = [];
    if (doctorId) {
      query += ` WHERE doctor_id = ?`;
      params.push(doctorId);
    }
    query += ` ORDER BY day_of_week ASC, start_time ASC`;

    const res = this.sqlDb.exec(query, params);
    if (!res.length) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const s: any = {};
      cols.forEach((c, idx) => {
        if (c === 'doctor_id') s.doctorId = v[idx];
        else if (c === 'day_of_week') s.dayOfWeek = Number(v[idx]);
        else if (c === 'day_name') s.dayName = v[idx];
        else if (c === 'start_time') s.startTime = v[idx];
        else if (c === 'end_time') s.endTime = v[idx];
        else s[c] = v[idx];
      });
      return s;
    });
  }

  public addSchedule(schedule: DoctorSchedule): DoctorSchedule {
    if (!this.sqlDb) throw new Error('Database not ready');
    this.sqlDb.run(
      `INSERT INTO doctor_schedules (id, doctor_id, day_of_week, day_name, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`,
      [schedule.id, schedule.doctorId, schedule.dayOfWeek, schedule.dayName, schedule.startTime, schedule.endTime]
    );
    this.saveToDisk();
    return schedule;
  }

  public deleteSchedule(id: string, doctorId: string): boolean {
    if (!this.sqlDb) return false;
    this.sqlDb.run(`DELETE FROM doctor_schedules WHERE id = ? AND doctor_id = ?`, [id, doctorId]);
    this.saveToDisk();
    return true;
  }

  // Leaves
  public getLeaves(doctorId?: string): DoctorLeave[] {
    if (!this.sqlDb) return [];
    let query = `SELECT * FROM doctor_leaves`;
    const params: any[] = [];
    if (doctorId) {
      query += ` WHERE doctor_id = ?`;
      params.push(doctorId);
    }
    query += ` ORDER BY date ASC`;

    const res = this.sqlDb.exec(query, params);
    if (!res.length) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const l: any = {};
      cols.forEach((c, idx) => {
        if (c === 'doctor_id') l.doctorId = v[idx];
        else if (c === 'created_at') l.createdAt = v[idx];
        else l[c] = v[idx];
      });
      return l;
    });
  }

  public addLeave(leave: DoctorLeave): DoctorLeave {
    if (!this.sqlDb) throw new Error('Database not ready');
    this.sqlDb.run(
      `INSERT INTO doctor_leaves (id, doctor_id, date, reason, created_at) VALUES (?, ?, ?, ?, ?)`,
      [leave.id, leave.doctorId, leave.date, leave.reason || null, leave.createdAt]
    );
    this.saveToDisk();
    return leave;
  }

  public deleteLeave(id: string, doctorId: string): boolean {
    if (!this.sqlDb) return false;
    this.sqlDb.run(`DELETE FROM doctor_leaves WHERE id = ? AND doctor_id = ?`, [id, doctorId]);
    this.saveToDisk();
    return true;
  }

  // Appointments
  public getAppointments(): Appointment[] {
    if (!this.sqlDb) return [];
    const res = this.sqlDb.exec(`SELECT * FROM appointments ORDER BY date ASC, start_time ASC`);
    if (!res.length) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const a: any = {};
      cols.forEach((c, idx) => {
        if (c === 'patient_id') a.patientId = v[idx];
        else if (c === 'patient_name') a.patientName = v[idx];
        else if (c === 'patient_email') a.patientEmail = v[idx];
        else if (c === 'patient_phone') a.patientPhone = v[idx];
        else if (c === 'doctor_id') a.doctorId = v[idx];
        else if (c === 'doctor_name') a.doctorName = v[idx];
        else if (c === 'doctor_specialty') a.doctorSpecialty = v[idx];
        else if (c === 'start_time') a.startTime = v[idx];
        else if (c === 'end_time') a.endTime = v[idx];
        else if (c === 'cancellation_reason') a.cancellationReason = v[idx] || undefined;
        else if (c === 'reminder_sent') a.reminderSent = v[idx] === 1;
        else if (c === 'created_at') a.createdAt = v[idx];
        else if (c === 'updated_at') a.updatedAt = v[idx];
        else a[c] = v[idx] !== null ? v[idx] : undefined;
      });
      return a;
    });
  }

  public findAppointmentById(id: string): Appointment | undefined {
    if (!this.sqlDb) return undefined;
    const stmt = this.sqlDb.prepare(`SELECT * FROM appointments WHERE id = :id`);
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: String(row.id),
        patientId: String(row.patient_id),
        patientName: String(row.patient_name),
        patientEmail: String(row.patient_email),
        patientPhone: String(row.patient_phone),
        doctorId: String(row.doctor_id),
        doctorName: String(row.doctor_name),
        doctorSpecialty: String(row.doctor_specialty),
        date: String(row.date),
        startTime: String(row.start_time),
        endTime: String(row.end_time),
        status: row.status as any,
        reason: row.reason ? String(row.reason) : undefined,
        notes: row.notes ? String(row.notes) : undefined,
        cancellationReason: row.cancellation_reason ? String(row.cancellation_reason) : undefined,
        reminderSent: row.reminder_sent === 1,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      };
    }
    stmt.free();
    return undefined;
  }

  public createAppointment(apt: Appointment): Appointment {
    if (!this.sqlDb) throw new Error('Database not ready');
    this.sqlDb.run(
      `INSERT INTO appointments (id, patient_id, patient_name, patient_email, patient_phone, doctor_id, doctor_name, doctor_specialty, date, start_time, end_time, status, reason, notes, cancellation_reason, reminder_sent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        apt.id,
        apt.patientId,
        apt.patientName,
        apt.patientEmail,
        apt.patientPhone,
        apt.doctorId,
        apt.doctorName,
        apt.doctorSpecialty,
        apt.date,
        apt.startTime,
        apt.endTime,
        apt.status,
        apt.reason || null,
        apt.notes || null,
        apt.cancellationReason || null,
        apt.reminderSent ? 1 : 0,
        apt.createdAt,
        apt.updatedAt,
      ]
    );
    this.saveToDisk();
    return apt;
  }

  public updateAppointment(id: string, updates: Partial<Appointment>): Appointment | undefined {
    if (!this.sqlDb) return undefined;
    const current = this.findAppointmentById(id);
    if (!current) return undefined;

    const merged = { ...current, ...updates, updatedAt: this.getCurrentTime().toISOString() };
    this.sqlDb.run(
      `UPDATE appointments SET
        date = ?, start_time = ?, end_time = ?, status = ?, reason = ?, notes = ?, cancellation_reason = ?, reminder_sent = ?, updated_at = ?
       WHERE id = ?`,
      [
        merged.date,
        merged.startTime,
        merged.endTime,
        merged.status,
        merged.reason || null,
        merged.notes || null,
        merged.cancellationReason || null,
        merged.reminderSent ? 1 : 0,
        merged.updatedAt,
        id,
      ]
    );
    this.saveToDisk();
    return merged;
  }

  // Notifications
  public getEmails(recipientEmail?: string): EmailNotification[] {
    if (!this.sqlDb) return [];
    let query = `SELECT * FROM notifications`;
    const params: any[] = [];
    if (recipientEmail) {
      query += ` WHERE lower(recipient_email) = ?`;
      params.push(recipientEmail.toLowerCase());
    }
    query += ` ORDER BY sent_at DESC LIMIT 500`;

    const res = this.sqlDb.exec(query, params);
    if (!res.length) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const e: any = {};
      cols.forEach((c, idx) => {
        if (c === 'recipient_email') e.recipientEmail = v[idx];
        else if (c === 'recipient_name') e.recipientName = v[idx];
        else if (c === 'sent_at') e.sentAt = v[idx];
        else if (c === 'appointment_id') e.appointmentId = v[idx] || undefined;
        else e[c] = v[idx];
      });
      return e;
    });
  }

  public logEmail(email: Omit<EmailNotification, 'id' | 'sentAt'>): EmailNotification {
    if (!this.sqlDb) throw new Error('Database not ready');
    const newEmail: EmailNotification = {
      ...email,
      id: `em_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sentAt: this.getCurrentTime().toISOString(),
    };

    this.sqlDb.run(
      `INSERT INTO notifications (id, recipient_email, recipient_name, type, subject, body, sent_at, appointment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newEmail.id,
        newEmail.recipientEmail,
        newEmail.recipientName,
        newEmail.type,
        newEmail.subject,
        newEmail.body,
        newEmail.sentAt,
        newEmail.appointmentId || null,
      ]
    );
    this.saveToDisk();
    return newEmail;
  }

  // AI Logs
  public logAiInteraction(feature: string, prompt: string, response: string): void {
    if (!this.sqlDb) return;
    const id = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.sqlDb.run(
      `INSERT INTO ai_logs (id, feature, input_prompt, output_response, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, feature, prompt, response, new Date().toISOString()]
    );
    this.saveToDisk();
  }

  // Audit Logs
  public logAudit(action: string, userId?: string | null, details?: string | null): void {
    if (!this.sqlDb) return;
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.sqlDb.run(
      `INSERT INTO audit_logs (id, action, user_id, details, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, action, userId || null, details || null, new Date().toISOString()]
    );
    this.saveToDisk();
  }
}

export const sqliteDb = new SQLiteClinicDatabase();
