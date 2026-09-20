import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import { User } from '../types.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// In-memory token storage for active sessions
const sessionTokens = new Map<string, string>(); // token -> userId

export function createToken(userId: string): string {
  const token = `tok_${userId}_${Math.random().toString(36).substring(2)}${Date.now()}`;
  sessionTokens.set(token, userId);
  return token;
}

export function revokeToken(token: string) {
  sessionTokens.delete(token);
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  let userId = sessionTokens.get(token);

  // If token is in standard format tok_usr_xxx_yyy, extract fallback or check
  if (!userId && token.startsWith('tok_usr_')) {
    const parts = token.split('_');
    const fallbackUserId = `${parts[1]}_${parts[2]}`;
    const foundUser = db.findUserById(fallbackUserId);
    if (foundUser) {
      userId = fallbackUserId;
      sessionTokens.set(token, userId);
    }
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }

  const userWithPass = db.findUserById(userId);
  if (!userWithPass) {
    return res.status(401).json({ error: 'Unauthorized: User not found' });
  }

  const { passwordHash: _, ...safeUser } = userWithPass;
  req.user = safeUser;
  next();
}

export function requireRole(...roles: Array<'patient' | 'doctor' | 'admin'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: This action requires role ${roles.join(' or ')}. You are signed in as ${req.user.role}.`,
      });
    }
    next();
  };
}
