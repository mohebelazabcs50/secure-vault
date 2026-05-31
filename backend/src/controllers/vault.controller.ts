import { Response } from 'express';
import { prisma } from '../utils/db';
import { CryptoService } from '../services/crypto.service';
import { TotpService } from '../services/totp.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { env } from '../config/env';
import crypto from 'crypto';

export class VaultController {
  /**
   * Helper to retrieve and decrypt the User Key from the authenticated request
   */
  private static getUserKey(req: AuthenticatedRequest): Buffer {
    if (!req.user || !req.user.userKeyDecrypted) {
      throw new Error('User key not found in session.');
    }

    const parts = req.user.userKeyDecrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed user key container.');
    }

    const [iv, tag, ciphertext] = parts;
    const pepperKey = crypto.scryptSync(env.SERVER_PEPPER, 'jwt-userkey-salt', 32);
    const decryptedHex = CryptoService.decrypt(ciphertext, iv, tag, pepperKey);
    return Buffer.from(decryptedHex, 'hex');
  }

  /**
   * Add new Vault Item
   */
  static async addVaultItem(req: AuthenticatedRequest, res: Response) {
    try {
      const { websiteName, url, username, email, password, notes, category, securityScore } = req.body;
      const userId = req.user!.id;

      // Retrieve User Key
      const userKey = VaultController.getUserKey(req);

      // Encrypt the website password with the user key
      const { ciphertext, iv, authTag } = CryptoService.encrypt(password, userKey);

      // Save to database
      const vaultItem = await prisma.vaultItem.create({
        data: {
          userId,
          websiteName,
          url,
          username,
          email,
          encryptedPassword: ciphertext,
          iv,
          authTag,
          notes,
          category,
          securityScore: securityScore || 0,
        },
      });

      // Log Activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'VAULT_ADD',
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: `Added new credential for ${websiteName}.`,
        },
      });

      return res.status(201).json({
        message: 'Password added to vault successfully.',
        item: {
          id: vaultItem.id,
          websiteName: vaultItem.websiteName,
          url: vaultItem.url,
          username: vaultItem.username,
          email: vaultItem.email,
          category: vaultItem.category,
          securityScore: vaultItem.securityScore,
          notes: vaultItem.notes,
          createdAt: vaultItem.createdAt,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to add item to vault.' });
    }
  }

  /**
   * Fetch all Vault Items (decrypted)
   */
  static async getVaultItems(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { category, search } = req.query;

      // Retrieve User Key
      const userKey = VaultController.getUserKey(req);

      // Find items
      const items = await prisma.vaultItem.findMany({
        where: {
          userId,
          ...(category && { category: category as string }),
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Decrypt and map items
      const decryptedItems = items
        .map((item) => {
          try {
            const decryptedPassword = CryptoService.decrypt(
              item.encryptedPassword,
              item.iv,
              item.authTag,
              userKey
            );
            return {
              id: item.id,
              websiteName: item.websiteName,
              url: item.url,
              username: item.username,
              email: item.email,
              password: decryptedPassword,
              notes: item.notes,
              category: item.category,
              securityScore: item.securityScore,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            };
          } catch (err) {
            console.error(`Failed to decrypt item ${item.id}`);
            return null; // Skip corrupted items or display as locked
          }
        })
        .filter((item) => item !== null) as any[];

      // In-memory filter for search to support custom fields or just database query
      let filteredItems = decryptedItems;
      if (search) {
        const query = (search as string).toLowerCase();
        filteredItems = decryptedItems.filter(
          (item) =>
            item.websiteName.toLowerCase().includes(query) ||
            item.username.toLowerCase().includes(query) ||
            item.email.toLowerCase().includes(query)
        );
      }

      return res.status(200).json({ items: filteredItems });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch vault items.' });
    }
  }

  /**
   * Edit existing Vault Item
   */
  static async updateVaultItem(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { websiteName, url, username, email, password, notes, category, securityScore } = req.body;
      const userId = req.user!.id;

      // Confirm item ownership
      const item = await prisma.vaultItem.findUnique({ where: { id } });
      if (!item || item.userId !== userId) {
        return res.status(404).json({ error: 'Credential not found in your vault.' });
      }

      // Retrieve User Key
      const userKey = VaultController.getUserKey(req);

      const updateData: any = {
        websiteName,
        url,
        username,
        email,
        notes,
        category,
        securityScore: securityScore || item.securityScore,
      };

      if (password) {
        // Re-encrypt if password changed
        const { ciphertext, iv, authTag } = CryptoService.encrypt(password, userKey);
        updateData.encryptedPassword = ciphertext;
        updateData.iv = iv;
        updateData.authTag = authTag;
      }

      const updatedItem = await prisma.vaultItem.update({
        where: { id },
        data: updateData,
      });

      // Log Activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'VAULT_EDIT',
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: `Updated credential for ${websiteName}.`,
        },
      });

      return res.status(200).json({ message: 'Credential updated successfully.', id: updatedItem.id });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to update vault item.' });
    }
  }

  /**
   * Delete Vault Item
   */
  static async deleteVaultItem(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const item = await prisma.vaultItem.findUnique({ where: { id } });
      if (!item || item.userId !== userId) {
        return res.status(404).json({ error: 'Credential not found in your vault.' });
      }

      await prisma.vaultItem.delete({ where: { id } });

      // Log Activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'VAULT_DELETE',
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: `Deleted credential for ${item.websiteName}.`,
        },
      });

      return res.status(200).json({ message: 'Credential deleted successfully.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to delete vault item.' });
    }
  }

  /**
   * Export Vault items
   */
  static async exportVault(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { format } = req.query; // json, csv

      const userKey = VaultController.getUserKey(req);

      const items = await prisma.vaultItem.findMany({
        where: { userId },
        orderBy: { websiteName: 'asc' },
      });

      const decryptedItems = items
        .map((item) => {
          try {
            const plainPassword = CryptoService.decrypt(
              item.encryptedPassword,
              item.iv,
              item.authTag,
              userKey
            );
            return {
              websiteName: item.websiteName,
              url: item.url,
              username: item.username,
              email: item.email,
              password: plainPassword,
              category: item.category,
              notes: item.notes || '',
              createdAt: item.createdAt,
            };
          } catch {
            return null;
          }
        })
        .filter((item) => item !== null);

      // Log Activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'EXPORT',
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: `Exported entire vault in ${format || 'JSON'} format.`,
        },
      });

      if (format === 'csv') {
        let csvContent = 'Website,URL,Username,Email,Password,Category,Notes,CreatedAt\n';
        decryptedItems.forEach((item: any) => {
          const row = [
            `"${item.websiteName.replace(/"/g, '""')}"`,
            `"${item.url.replace(/"/g, '""')}"`,
            `"${item.username.replace(/"/g, '""')}"`,
            `"${item.email.replace(/"/g, '""')}"`,
            `"${item.password.replace(/"/g, '""')}"`,
            `"${item.category.replace(/"/g, '""')}"`,
            `"${item.notes.replace(/"/g, '""')}"`,
            item.createdAt.toISOString(),
          ].join(',');
          csvContent += row + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=vault_export.csv');
        return res.status(200).send(csvContent);
      }

      // Default to JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=vault_export.json');
      return res.status(200).json(decryptedItems);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to export vault items.' });
    }
  }

  /**
   * Fetch Activity Logs
   */
  static async getActivityLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const logs = await prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50, // Return last 50 entries
      });

      return res.status(200).json({ logs });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to fetch activity logs.' });
    }
  }

  /**
   * Change Master Password (zero-knowledge key re-encryption)
   */
  static async changeMasterPassword(req: AuthenticatedRequest, res: Response) {
    try {
      const { oldMasterPassword, newMasterPassword } = req.body;
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Validate old password
      const isPasswordValid = await CryptoService.verifyMasterPassword(user.masterPasswordHash, oldMasterPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid current master password.' });
      }

      // Retrieve User Key (using old master password)
      const oldDerivedKey = CryptoService.deriveKeyFromMaster(oldMasterPassword, user.userKeySalt);
      const rawUserKey = CryptoService.decrypt(
        user.encryptedUserKey,
        user.userKeyIv,
        user.userKeyAuthTag,
        oldDerivedKey
      );

      // Re-hash new master password
      const newMasterPasswordHash = await CryptoService.hashMasterPassword(newMasterPassword);

      // Re-derive key using new master password & new salt
      const newUserKeySalt = CryptoService.generateSalt();
      const newDerivedKey = CryptoService.deriveKeyFromMaster(newMasterPassword, newUserKeySalt);

      // Encrypt the user key under the new master key
      const { ciphertext: newEncryptedUserKey, iv: newUserKeyIv, authTag: newUserKeyAuthTag } = 
        CryptoService.encrypt(rawUserKey, newDerivedKey);

      // Update User details
      await prisma.user.update({
        where: { id: userId },
        data: {
          masterPasswordHash: newMasterPasswordHash,
          encryptedUserKey: newEncryptedUserKey,
          userKeyIv: newUserKeyIv,
          userKeyAuthTag: newUserKeyAuthTag,
          userKeySalt: newUserKeySalt,
        },
      });

      // Log Activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'MASTER_PASSWORD_CHANGE',
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: 'Master password changed successfully, all records re-keyed.',
        },
      });

      return res.status(200).json({ message: 'Master password updated successfully.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to update master password.' });
    }
  }

  /**
   * Setup & Register 2FA
   */
  static async setup2FA(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const email = req.user!.email;

      // Check if 2FA is already enabled
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { twoFactorSecret: true },
      });

      if (user?.twoFactorSecret?.isEnabled) {
        return res.status(400).json({ error: 'Two-factor authentication is already active.' });
      }

      // Generate TOTP details
      const { secret, qrCode, backupCodes } = await TotpService.generateSecret(email);
      const encrypted = TotpService.encrypt2FADetails(secret, backupCodes);
      const encryptedBackupCodes = TotpService.encryptBackupCodes(backupCodes);

      // Save secret (not active yet until confirmed)
      await prisma.twoFactorSecret.upsert({
        where: { userId },
        update: {
          secret: encrypted.secretEncrypted,
          secretIv: encrypted.secretIv,
          secretTag: encrypted.secretTag,
          qrCode,
          backupCodes: encryptedBackupCodes,
          isEnabled: false,
        },
        create: {
          userId,
          secret: encrypted.secretEncrypted,
          secretIv: encrypted.secretIv,
          secretTag: encrypted.secretTag,
          qrCode,
          backupCodes: encryptedBackupCodes,
          isEnabled: false,
        },
      });

      return res.status(200).json({
        qrCode,
        backupCodes, // Present backup codes once during onboarding
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to initialize 2FA setup.' });
    }
  }

  /**
   * Enable 2FA after validation
   */
  static async enable2FA(req: AuthenticatedRequest, res: Response) {
    try {
      const { code } = req.body;
      const userId = req.user!.id;

      if (!code) {
        return res.status(400).json({ error: 'Verification code is required.' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { twoFactorSecret: true },
      });

      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ error: 'Please set up 2FA before activating.' });
      }

      // Decrypt TOTP secret
      const totpSecret = TotpService.decryptSecret(
        user.twoFactorSecret.secret,
        user.twoFactorSecret.secretIv,
        user.twoFactorSecret.secretTag
      );

      // Verify code
      const isValid = TotpService.verifyToken(code, totpSecret);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid verification code.' });
      }

      // Update to active
      await prisma.twoFactorSecret.update({
        where: { userId },
        data: { isEnabled: true },
      });

      // Log Activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: '2FA_ENABLE',
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: 'Two-factor authenticator activated.',
        },
      });

      return res.status(200).json({ message: 'Two-factor authentication successfully enabled!' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to enable 2FA.' });
    }
  }

  /**
   * Disable 2FA
   */
  static async disable2FA(req: AuthenticatedRequest, res: Response) {
    try {
      const { code } = req.body;
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { twoFactorSecret: true },
      });

      if (!user || !user.twoFactorSecret || !user.twoFactorSecret.isEnabled) {
        return res.status(400).json({ error: 'Two-factor authentication is not active.' });
      }

      const totpSecret = TotpService.decryptSecret(
        user.twoFactorSecret.secret,
        user.twoFactorSecret.secretIv,
        user.twoFactorSecret.secretTag
      );

      const isValid = TotpService.verifyToken(code, totpSecret);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid verification code.' });
      }

      // Delete 2FA details
      await prisma.twoFactorSecret.delete({ where: { userId } });

      // Log Activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: '2FA_DISABLE',
          ipAddress: req.ip,
          device: req.headers['user-agent'] || 'Unknown',
          details: 'Two-factor authenticator deactivated.',
        },
      });

      return res.status(200).json({ message: 'Two-factor authentication successfully deactivated.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to disable 2FA.' });
    }
  }

  /**
   * Delete Account permanently
   */
  static async deleteAccount(req: AuthenticatedRequest, res: Response) {
    try {
      const { masterPassword } = req.body;
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: 'User profile not found.' });
      }

      // Verify master password before deletion
      const isValid = await CryptoService.verifyMasterPassword(user.masterPasswordHash, masterPassword);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid master password, authorization denied.' });
      }

      // Delete User (Cascade deletes sessions, activities, vaults etc. automatically)
      await prisma.user.delete({ where: { id: userId } });

      // Clear cookies
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');

      return res.status(200).json({ message: 'Your account and all associated vault records have been permanently deleted.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to delete user account.' });
    }
  }
}
