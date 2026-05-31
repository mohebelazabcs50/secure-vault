import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/security.middleware';
import {
  RegisterSchema,
  LoginSchema,
  Verify2FASchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../middleware/schemas';

const router = Router();

// Apply auth rate limiter to sensitive authentication endpoints
router.post('/register', authLimiter, validateRequest(RegisterSchema), AuthController.register);
router.post('/login', authLimiter, validateRequest(LoginSchema), AuthController.login);
router.post('/verify-2fa', authLimiter, validateRequest(Verify2FASchema), AuthController.verify2FA);
router.post('/forgot-password', authLimiter, validateRequest(ForgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', authLimiter, validateRequest(ResetPasswordSchema), AuthController.resetPassword);

// Session Refresh and Logout (requires HttpOnly cookies)
router.post('/refresh', AuthController.refresh);
router.post('/logout', authenticate, AuthController.logout);

// Profile
router.get('/me', authenticate, AuthController.getProfile);

export default router;
