import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    userKeyDecrypted?: string; // Cache the decrypted user key in session
  };
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Try to get token from HTTP-only cookie or Authorization header
  let token = req.cookies?.access_token;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No session token provided.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      id: string;
      email: string;
      username: string;
      userKeyDecrypted?: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Session token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid session token.' });
  }
};
