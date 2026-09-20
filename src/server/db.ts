import { sqliteDb, hashPassword } from './sqliteDb.js';

export const db = sqliteDb;
export { hashPassword, sqliteDb };
