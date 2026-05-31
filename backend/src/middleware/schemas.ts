import { z } from 'zod';

export const RegisterSchema = z.object({
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    masterPassword: z.string().min(12, 'Master password must be at least 12 characters'),
  }),
});

export const LoginSchema = z.object({
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
    masterPassword: z.string().min(1, 'Master password is required'),
  }),
});

export const Verify2FASchema = z.object({
  body: z.object({
    tempToken: z.string().min(1, 'Temporary session token is required'),
    code: z.string().length(6, 'Authenticator code must be 6 digits'),
  }),
});

export const ForgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
  }),
});

export const ResetPasswordSchema = z.object({
  body: z.object({
    resetToken: z.string().min(1, 'Reset token is required'),
    newMasterPassword: z.string().min(12, 'New master password must be at least 12 characters'),
  }),
});

export const AddVaultItemSchema = z.object({
  body: z.object({
    websiteName: z.string().min(1, 'Website name is required'),
    url: z.string().url('Please enter a valid URL (e.g., https://example.com)'),
    username: z.string().min(1, 'Username is required'),
    email: z.string().email('Please enter a valid email address').or(z.string().length(0)), // Allow empty string
    password: z.string().min(1, 'Password is required'),
    notes: z.string().optional(),
    category: z.enum(['Social Media', 'Banking', 'Work', 'Gaming', 'Shopping', 'Crypto'], {
      errorMap: () => ({ message: 'Invalid category. Choose from: Social Media, Banking, Work, Gaming, Shopping, Crypto' }),
    }),
    securityScore: z.number().min(0).max(100).default(0),
  }),
});

export const UpdateVaultItemSchema = z.object({
  body: z.object({
    websiteName: z.string().min(1).optional(),
    url: z.string().url('Please enter a valid URL').optional(),
    username: z.string().min(1).optional(),
    email: z.string().email('Please enter a valid email address').or(z.string().length(0)).optional(),
    password: z.string().min(1).optional(),
    notes: z.string().optional(),
    category: z.enum(['Social Media', 'Banking', 'Work', 'Gaming', 'Shopping', 'Crypto']).optional(),
    securityScore: z.number().min(0).max(100).optional(),
  }),
});

export const ChangeMasterPasswordSchema = z.object({
  body: z.object({
    oldMasterPassword: z.string().min(1, 'Current master password is required'),
    newMasterPassword: z.string().min(12, 'New master password must be at least 12 characters'),
  }),
});

export const Enable2FASchema = z.object({
  body: z.object({
    code: z.string().length(6, 'Authenticator code must be 6 digits'),
  }),
});

export const Disable2FASchema = z.object({
  body: z.object({
    code: z.string().length(6, 'Authenticator code must be 6 digits'),
  }),
});

export const DeleteAccountSchema = z.object({
  body: z.object({
    masterPassword: z.string().min(1, 'Master password is required'),
  }),
});
