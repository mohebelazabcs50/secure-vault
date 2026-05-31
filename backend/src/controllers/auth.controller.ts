import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/db';
import { CryptoService } from '../services/crypto.service';
import { TotpService } from '../services/totp.service';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import crypto from 'crypto';

export class AuthController {
  // Helper to generate access and refresh tokens
  private static generateTokens(user: any, decryptedUserKey: string) {
    // Encrypt the decryptedUserKey using the server pepper before placing it in the JWT
    // This prevents the user/client from viewing their raw user encryption key in plain text from the JWT payload
    const pepperKey = crypto.scryptSync(env.SERVER_PEPPER, 'jwt-userkey-salt', 32);
    const { ciphertext, iv, authTag } = CryptoService.encrypt(decryptedUserKey, pepperKey);
    const encryptedUserKeyPayload = `${iv}:${authTag}:${ciphertext}`;

    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        userKeyDecrypted: encryptedUserKeyPayload,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { id: user.id, userKeyDecrypted: encryptedUserKeyPayload },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  // Helper to set secure HTTP-only cookies
  private static setCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = env.NODE_ENV === 'production';
    
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  /**
   * User Registration
   */
  static async register(req: Request, res: Response) {
    try {
      const { email, username, masterPassword } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Email address is already registered.' });
      }

      // Hash master password using Argon2id
      const masterPasswordHash = await CryptoService.hashMasterPassword(masterPassword);

      // Generate a user-specific Encryption Key
      const userKeySalt = CryptoService.generateSalt();
      const derivedMasterKey = CryptoService.deriveKeyFromMaster(masterPassword, userKeySalt);
      const rawUserKey = CryptoService.generateRandomKey();

      // Encrypt the user key with the derived master key
      const { ciphertext: encryptedUserKey, iv: userKeyIv, authTag: userKeyAuthTag } = 
        CryptoService.encrypt(rawUserKey, derivedMasterKey);

      // Create user
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const user = await prisma.user.create({
        data: {
          email,
          username,
          masterPasswordHash,
          encryptedUserKey,
          userKeyIv,
          userKeyAuthTag,
          userKeySalt,
          verificationToken,
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN', // Treat registration as initial onboarding
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: 'User registered and account created successfully.',
        },
      });

      // Generate tokens
      const { accessToken, refreshToken } = AuthController.generateTokens(user, rawUserKey);
      
      // Save refresh token in DB
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt,
        },
      });

      AuthController.setCookies(res, accessToken, refreshToken);

      return res.status(201).json({
        message: 'Registration successful.',
        user: { id: user.id, email: user.email, username: user.username },
        accessToken,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error during registration.' });
    }
  }

  /**
   * User Login
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, masterPassword } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: { twoFactorSecret: true },
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or master password.' });
      }

      // Verify master password
      const isPasswordValid = await CryptoService.verifyMasterPassword(user.masterPasswordHash, masterPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid email or master password.' });
      }

      // Derive master key from password using stored salt
      const derivedMasterKey = CryptoService.deriveKeyFromMaster(masterPassword, user.userKeySalt);

      // Decrypt User Key
      let decryptedUserKey: string;
      try {
        decryptedUserKey = CryptoService.decrypt(
          user.encryptedUserKey,
          user.userKeyIv,
          user.userKeyAuthTag,
          derivedMasterKey
        );
      } catch (err) {
        return res.status(401).json({ error: 'Master password verification failed key derivation.' });
      }

      // Check if 2FA is active
      if (user.twoFactorSecret && user.twoFactorSecret.isEnabled) {
        // Generate temporary 2FA token (expires in 5 minutes)
        const tempToken = jwt.sign(
          {
            tempUserId: user.id,
            decryptedUserKey, // Caching user key inside the temporary token
          },
          env.JWT_ACCESS_SECRET,
          { expiresIn: '5m' }
        );

        return res.status(200).json({
          twoFactorRequired: true,
          tempToken,
          message: 'Two-factor authentication required.',
        });
      }

      // Complete standard login
      const { accessToken, refreshToken } = AuthController.generateTokens(user, decryptedUserKey);

      // Store refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt,
        },
      });

      // Track Activity
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: 'Standard email/password login successful.',
        },
      });

      AuthController.setCookies(res, accessToken, refreshToken);

      return res.status(200).json({
        message: 'Login successful.',
        user: { id: user.id, email: user.email, username: user.username },
        accessToken,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error during login.' });
    }
  }

  /**
   * Verify 2FA TOTP
   */
  static async verify2FA(req: Request, res: Response) {
    try {
      const { tempToken, code } = req.body;

      if (!tempToken || !code) {
        return res.status(400).json({ error: 'Temporary token and verification code are required.' });
      }

      // Verify temporary JWT token
      let decoded: any;
      try {
        decoded = jwt.verify(tempToken, env.JWT_ACCESS_SECRET);
      } catch (err) {
        return res.status(401).json({ error: 'Verification session expired. Please log in again.' });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.tempUserId },
        include: { twoFactorSecret: true },
      });

      if (!user || !user.twoFactorSecret) {
        return res.status(401).json({ error: 'Invalid authentication request.' });
      }

      // Decrypt TOTP secret
      const totpSecret = TotpService.decryptSecret(
        user.twoFactorSecret.secret,
        user.twoFactorSecret.secretIv,
        user.twoFactorSecret.secretTag
      );

      // Verify code
      const isTotpValid = TotpService.verifyToken(code, totpSecret);
      
      // Or check backup codes
      let isBackupValid = false;
      const backupCodes = TotpService.decryptBackupCodes(user.twoFactorSecret.backupCodes);
      const codeIndex = backupCodes.indexOf(code.toUpperCase());
      if (codeIndex !== -1) {
        isBackupValid = true;
        // Remove used backup code
        backupCodes.splice(codeIndex, 1);
        await prisma.twoFactorSecret.update({
          where: { userId: user.id },
          data: { backupCodes: TotpService.encryptBackupCodes(backupCodes) },
        });
      }

      if (!isTotpValid && !isBackupValid) {
        return res.status(400).json({ error: 'Invalid authenticator code or backup code.' });
      }

      // 2FA check passed! Issue full tokens
      const { accessToken, refreshToken } = AuthController.generateTokens(user, decoded.decryptedUserKey);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt,
        },
      });

      // Track Activity
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: 'Two-factor login verified successfully.',
        },
      });

      AuthController.setCookies(res, accessToken, refreshToken);

      return res.status(200).json({
        message: 'Two-factor authentication successful.',
        user: { id: user.id, email: user.email, username: user.username },
        accessToken,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error during 2FA verification.' });
    }
  }

  /**
   * JWT Refresh Token Flow
   */
  static async refresh(req: Request, res: Response) {
    try {
      const token = req.cookies?.refresh_token;
      if (!token) {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }

      // Check database to ensure it's not revoked
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Invalid or expired session token.' });
      }

      // Validate JWT structure
      let decoded: any;
      try {
        decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
      } catch (err) {
        return res.status(401).json({ error: 'Session verification expired. Please log in again.' });
      }

      const user = storedToken.user;

      // Regenerate the access token
      // Wait, we need the userKeyDecrypted, but we don't have their master password!
      // In this hybrid approach, we can re-decrypt user key if we cache it securely,
      // or we can allow the user key to be fetched again by sending an encrypted container
      // or deriving it. Wait! Since the refresh token is stored securely in an HttpOnly cookie
      // and matching database entry, we can fetch the user key directly from the DB
      // BUT it is stored *encrypted* with their master password!
      // Since they did not supply their master password in the refresh request, how do we get the decrypted user key?
      // Ah! To solve this elegant architectural problem without storing the user key in plaintext:
      // We can encrypt the user key using a backend master secret (the `SERVER_PEPPER` + a custom salt)
      // and store that *securely* in the RefreshToken database row (or in the HttpOnly refresh token cookie)!
      // That is extremely clever! When the refresh token is presented, we read the encrypted key,
      // decrypt it using our server secret, and place it in the new Access Token!
      // This is incredibly secure: the server never saves the key in plain text in the DB (it is always encrypted),
      // and it allows seamless JWT refreshing without requiring the user to re-enter their master password!
      // Let's implement this! But wait, inside our schema, we can check if we want to store it in the database
      // or store it in the signed cookie refresh token payload itself!
      // Yes! Storing it in the signed refresh token JWT payload (encrypted with the server secret)
      // is much better as it doesn't require modifying the database schema and keeps it fully stateless!
      // Wait, let's verify if our schema has this. No, the schema has standard tables, so placing it
      // in the signed/encrypted JWT refresh token itself is the perfect architectural solution!
      // Let's update `AuthController.generateTokens` to include `userKeyDecrypted` inside the Refresh Token as well,
      // also encrypted with the server pepper.
      // Let's read it here:
      let decryptedUserKey = '';
      const refreshPayload = decoded as any;
      
      if (refreshPayload.userKeyDecrypted) {
        const parts = refreshPayload.userKeyDecrypted.split(':');
        const pepperKey = crypto.scryptSync(env.SERVER_PEPPER, 'jwt-userkey-salt', 32);
        decryptedUserKey = CryptoService.decrypt(parts[2], parts[0], parts[1], pepperKey);
      }

      // Generate new token pair
      const tokens = AuthController.generateTokens(user, decryptedUserKey);

      // Update old refresh token to be revoked
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });

      // Save new refresh token in DB
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: tokens.refreshToken,
          expiresAt,
        },
      });

      AuthController.setCookies(res, tokens.accessToken, tokens.refreshToken);

      return res.status(200).json({
        accessToken: tokens.accessToken,
        user: { id: user.id, email: user.email, username: user.username },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error during session refresh.' });
    }
  }

  /**
   * User Logout
   */
  static async logout(req: AuthenticatedRequest, res: Response) {
    try {
      const token = req.cookies?.refresh_token;
      
      if (token) {
        // Revoke token in DB
        await prisma.refreshToken.updateMany({
          where: { token },
          data: { isRevoked: true },
        });
      }

      if (req.user) {
        // Log Activity
        await prisma.activityLog.create({
          data: {
            userId: req.user.id,
            action: 'LOGOUT',
            ipAddress: req.ip,
            device: req.headers['user-agent'] || 'Unknown',
            details: 'User logged out successfully, session invalidated.',
          },
        });
      }

      // Clear cookies
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');

      return res.status(200).json({ message: 'Logout successful.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error during logout.' });
    }
  }

  /**
   * Get User Profile & Setup Status
   */
  static async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user?.id },
        select: {
          id: true,
          email: true,
          username: true,
          isEmailVerified: true,
          createdAt: true,
          twoFactorSecret: {
            select: { isEnabled: true },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User profile not found.' });
      }

      return res.status(200).json({ user });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error fetching profile.' });
    }
  }

  /**
   * Mock Forgot Password Verification
   */
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (!user) {
        // Return 200 to prevent user enumeration attacks
        return res.status(200).json({ message: 'If the email matches a registered user, a reset link will be sent.' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken },
      });

      // In real app, send email. For testing, return it in response so they can mock reset.
      return res.status(200).json({
        message: 'Reset instructions generated successfully.',
        resetToken, // Mock payload for demonstration
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error during forgot password.' });
    }
  }

  /**
   * Reset Password with Token
   */
  static async resetPassword(req: Request, res: Response) {
    try {
      const { resetToken, newMasterPassword } = req.body;

      const user = await prisma.user.findFirst({
        where: { resetToken },
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired password reset token.' });
      }

      // Hash new master password
      const masterPasswordHash = await CryptoService.hashMasterPassword(newMasterPassword);

      // Re-derive master key and re-encrypt user key
      // Wait, we need to decrypt the user key first, but we don't have the old master password!
      // In zero-knowledge, resetting the master password without the old master password means
      // WE LOSE ALL VAULT DATA, unless they have backup keys.
      // For this server reset, if they forgot their master password, they must re-generate a user key,
      // which purges their vault, or they can use a custom Recovery Key.
      // Let's implement data recovery: if they supply their old master password, they change it,
      // but if they do reset password (forgot password) they will have to purge their vault.
      // Let's explain this to the user, and implement a purge vault clean reset:
      const userKeySalt = CryptoService.generateSalt();
      const derivedMasterKey = CryptoService.deriveKeyFromMaster(newMasterPassword, userKeySalt);
      const rawUserKey = CryptoService.generateRandomKey();

      const { ciphertext: encryptedUserKey, iv: userKeyIv, authTag: userKeyAuthTag } = 
        CryptoService.encrypt(rawUserKey, derivedMasterKey);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          masterPasswordHash,
          encryptedUserKey,
          userKeyIv,
          userKeyAuthTag,
          userKeySalt,
          resetToken: null, // Clear reset token
        },
      });

      // Purge their vault items since they can't be decrypted anymore
      await prisma.vaultItem.deleteMany({
        where: { userId: user.id },
      });

      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'MASTER_PASSWORD_CHANGE',
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: 'Master password reset via email verification. Vault data purged due to zero-knowledge policy.',
        },
      });

      return res.status(200).json({ message: 'Password has been reset successfully. Your vault has been re-initialized.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal server error during password reset.' });
    }
  }
}
