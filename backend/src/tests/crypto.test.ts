import { CryptoService } from '../services/crypto.service';

describe('🔒 Cryptographic Service Unit Tests', () => {
  const masterPassword = 'super-secure-master-password-2026';
  let passwordHash = '';
  const salt = CryptoService.generateSalt();

  it('should successfully hash a master password with Argon2id', async () => {
    passwordHash = await CryptoService.hashMasterPassword(masterPassword);
    expect(passwordHash).toBeDefined();
    expect(passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('should verify correct master password and reject incorrect passwords', async () => {
    const isValid = await CryptoService.verifyMasterPassword(passwordHash, masterPassword);
    expect(isValid).toBe(true);

    const isInvalid = await CryptoService.verifyMasterPassword(passwordHash, 'wrong-password');
    expect(isInvalid).toBe(false);
  });

  it('should derive a stable 256-bit encryption key from master password', () => {
    const key1 = CryptoService.deriveKeyFromMaster(masterPassword, salt);
    const key2 = CryptoService.deriveKeyFromMaster(masterPassword, salt);

    expect(key1).toBeDefined();
    expect(key1.length).toBe(32); // 32 bytes (256 bits)
    expect(key1.toString('hex')).toEqual(key2.toString('hex')); // Must be stable
  });

  it('should encrypt and decrypt a website credential using AES-256-GCM', () => {
    const plainTextPassword = 'my-secret-social-media-password';
    const rawKey = CryptoService.generateRandomKey();
    const keyBuffer = Buffer.from(rawKey, 'hex');

    // Encrypt
    const encrypted = CryptoService.encrypt(plainTextPassword, keyBuffer);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    // Decrypt
    const decrypted = CryptoService.decrypt(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.authTag,
      keyBuffer
    );
    expect(decrypted).toEqual(plainTextPassword);
  });
});
