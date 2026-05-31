import crypto from 'crypto';
import argon2 from 'argon2';
import { env } from '../config/env';

export class CryptoService {
  /**
   * Hashes a master password using Argon2id.
   */
  static async hashMasterPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,       // 3 iterations
      parallelism: 4,    // 4 threads
    });
  }

  /**
   * Verifies a master password against its hash.
   */
  static async verifyMasterPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  /**
   * Derives a 256-bit (32-byte) key from the master password and a salt.
   * Uses PBKDF2 with SHA-256 and incorporates a server-side pepper for added security.
   */
  static deriveKeyFromMaster(password: string, salt: string): Buffer {
    const pepperedPassword = password + env.SERVER_PEPPER;
    return crypto.pbkdf2Sync(
      pepperedPassword,
      Buffer.from(salt, 'hex'),
      100000, // 100k iterations
      32,     // 32 bytes for AES-256
      'sha256'
    );
  }

  /**
   * Generates a secure, random 32-byte user-specific key (hex).
   */
  static generateRandomKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a secure, random salt (hex).
   */
  static generateSalt(bytes = 16): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Encrypts text using AES-256-GCM with a specified 32-byte key.
   * Returns ciphertext, IV, and authTag in hex.
   */
  static encrypt(plainText: string, keyBuffer: Buffer): { ciphertext: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(12); // 12-byte IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    let ciphertext = cipher.update(plainText, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  /**
   * Decrypts text using AES-256-GCM with a specified 32-byte key.
   */
  static decrypt(ciphertext: string, ivHex: string, authTagHex: string, keyBuffer: Buffer): string {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
