import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { CryptoService } from './crypto.service';
import { env } from '../config/env';

// Configure authenticator
authenticator.options = { window: 1 }; // Allow 1-step window (30 seconds) clock drift

export class TotpService {
  private static getPepperKey(): Buffer {
    // Derive a stable 32-byte key from the server pepper for encrypting 2FA secrets
    return crypto.scryptSync(env.SERVER_PEPPER, '2fa-totp-salt', 32);
  }

  /**
   * Generates a new TOTP secret and QR code.
   */
  static async generateSecret(email: string): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, 'SecureVault', secret);
    const qrCode = await QRCode.toDataURL(otpauth);
    
    // Generate 5 backup codes of 10 random characters
    const backupCodes: string[] = [];
    for (let i = 0; i < 5; i++) {
      backupCodes.push(crypto.randomBytes(5).toString('hex').toUpperCase()); // 10 chars
    }

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Encrypts the TOTP secret and backup codes.
   */
  static encrypt2FADetails(secret: string, backupCodes: string[]): { 
    secretEncrypted: string; secretIv: string; secretTag: string; backupCodesEncrypted: string 
  } {
    const key = this.getPepperKey();
    const { ciphertext: secretEncrypted, iv: secretIv, authTag: secretTag } = CryptoService.encrypt(secret, key);
    
    // Encrypt backup codes JSON string
    const codesJson = JSON.stringify(backupCodes);
    const { ciphertext: backupCodesEncrypted } = CryptoService.encrypt(codesJson, key);

    return {
      secretEncrypted,
      secretIv,
      secretTag,
      backupCodesEncrypted,
    };
  }

  /**
   * Decrypts the TOTP secret.
   */
  static decryptSecret(secretEncrypted: string, iv: string, tag: string): string {
    const key = this.getPepperKey();
    return CryptoService.decrypt(secretEncrypted, iv, tag, key);
  }

  /**
   * Decrypts backup codes.
   */
  static decryptBackupCodes(backupCodesEncrypted: string): string[] {
    // Backup codes are encrypted with the same key, but let's assume we store details together
    // In our schema we stored backupCodes in user schema or distinct field. Let's make sure we decrypt it correctly.
    // For simplicity, let's encrypt it with static IV or store backup codes with a simplified AES format,
    // or just store them hashed. Wait, backup codes are one-time use, so hashing them is very secure.
    // Let's store them as hashed strings in db! But if the prompt says encrypt, let's encrypt them with simple JSON format
    // or store them in a single string. Let's use simple encryption. Let's write standard helpers.
    const key = this.getPepperKey();
    // We can encrypt/decrypt them using the helper. Since backup codes are not accessed frequently,
    // we can encrypt them with a standard AES format.
    // Let's just encrypt backupCodes as JSON string using our service key.
    // Wait, to keep decrypting backupCodes simple, we can just split them by comma and encrypt/decrypt
    // using a standardized pattern or derive IV. Let's store it as simple encrypted JSON with custom parsing,
    // or just comma separated. Let's use a simpler method: decrypting them by saving IV in the string.
    // E.g. "iv:tag:ciphertext"
    try {
      const parts = backupCodesEncrypted.split(':');
      if (parts.length !== 3) return [];
      const [iv, tag, ciphertext] = parts;
      const decrypted = CryptoService.decrypt(ciphertext, iv, tag, key);
      return JSON.parse(decrypted);
    } catch {
      return [];
    }
  }

  static encryptBackupCodes(backupCodes: string[]): string {
    const key = this.getPepperKey();
    const codesJson = JSON.stringify(backupCodes);
    const { ciphertext, iv, authTag } = CryptoService.encrypt(codesJson, key);
    return `${iv}:${authTag}:${ciphertext}`;
  }

  /**
   * Validates a TOTP token.
   */
  static verifyToken(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }
}
