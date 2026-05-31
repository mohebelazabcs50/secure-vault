// Zero-Knowledge Client-Side Web Crypto & LocalStorage Database
// Provides a local implementation of the Express API so the application can run 100% serverless on GitHub Pages.

const SALT_KEY = 'secure_vault_user_salt';
const ENCRYPTED_KEY_CONTAINER = 'secure_vault_encrypted_userkey';
const USER_PROFILE_KEY = 'secure_vault_user_profile';
const VAULT_ITEMS_KEY = 'secure_vault_items';
const ACTIVITY_LOGS_KEY = 'secure_vault_activity_logs';
const TWO_FACTOR_KEY = 'secure_vault_2fa';

// Helper to convert ArrayBuffer to Hex string
function bufToHex(buffer: ArrayBuffer): string {
  return Array.prototype.map.call(new Uint8Array(buffer), (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
}

// Helper to convert Hex string to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Derives a cryptographic key from a password and salt using PBKDF2
async function deriveMasterKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypts text using AES-GCM with a specified CryptoKey
async function encryptText(plainText: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV for GCM
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encoder.encode(plainText)
  );

  return {
    ciphertext: bufToHex(encrypted),
    iv: bufToHex(iv.buffer),
  };
}

// Decrypts text using AES-GCM with a specified CryptoKey
async function decryptText(ciphertextHex: string, ivHex: string, key: CryptoKey): Promise<string> {
  const decoder = new TextDecoder();
  const iv = hexToBuf(ivHex);
  const encryptedBuf = hexToBuf(ciphertextHex);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encryptedBuf
  );

  return decoder.decode(decrypted);
}

export class LocalDbService {
  // Session-coped derived encryption key
  private static activeKey: CryptoKey | null = null;
  private static rawUserKey: string = '';

  /**
   * Log an activity locally
   */
  static logActivity(action: string, details: string) {
    if (typeof window === 'undefined') return;
    const logs = JSON.parse(localStorage.getItem(ACTIVITY_LOGS_KEY) || '[]');
    const newLog = {
      id: window.crypto.randomUUID(),
      action,
      device: navigator.userAgent.substring(0, 50),
      ipAddress: '127.0.0.1 (Local)',
      details,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify([newLog, ...logs].slice(0, 50)));
  }

  /**
   * Register a new user
   */
  static async register(username: string, email: string, masterPassword: string): Promise<any> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltHex = bufToHex(salt.buffer);
    localStorage.setItem(SALT_KEY, saltHex);

    // Derive Master Key
    const masterKey = await deriveMasterKey(masterPassword, salt);
    
    // Generate a secure random User Encryption Key
    const userKey = bufToHex(window.crypto.getRandomValues(new Uint8Array(32)).buffer);
    
    // Encrypt the User Encryption Key using Master derived key
    const encrypted = await encryptText(userKey, masterKey);
    localStorage.setItem(ENCRYPTED_KEY_CONTAINER, JSON.stringify(encrypted));

    // Save profile details
    const profile = { id: window.crypto.randomUUID(), username, email, isEmailVerified: true, createdAt: new Date().toISOString() };
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));

    // Cache key in memory
    this.activeKey = await window.crypto.subtle.importKey(
      'raw',
      hexToBuf(userKey),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    this.rawUserKey = userKey;

    this.logActivity('LOGIN', 'User registered and vault created locally.');

    return { user: profile, token: 'local_spa_jwt_session_token' };
  }

  /**
   * Login user
   */
  static async login(email: string, masterPassword: string): Promise<any> {
    const saltHex = localStorage.getItem(SALT_KEY);
    const encryptedContainerStr = localStorage.getItem(ENCRYPTED_KEY_CONTAINER);
    const profileStr = localStorage.getItem(USER_PROFILE_KEY);

    if (!saltHex || !encryptedContainerStr || !profileStr) {
      throw new Error('No local vault found. Please register first.');
    }

    const profile = JSON.parse(profileStr);
    if (profile.email !== email) {
      throw new Error('Invalid email or master password.');
    }

    // Attempt to decrypt user key container
    try {
      const salt = hexToBuf(saltHex);
      const masterKey = await deriveMasterKey(masterPassword, salt);
      const container = JSON.parse(encryptedContainerStr);

      const userKey = await decryptText(container.ciphertext, container.iv, masterKey);

      // Successfully decrypted user key! Save key in memory
      this.activeKey = await window.crypto.subtle.importKey(
        'raw',
        hexToBuf(userKey),
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      this.rawUserKey = userKey;

      this.logActivity('LOGIN', 'User unlocked vault successfully.');

      return { user: profile, token: 'local_spa_jwt_session_token' };
    } catch (err) {
      throw new Error('Invalid email or master password.');
    }
  }

  /**
   * Add item to Vault
   */
  static async addVaultItem(itemData: any): Promise<any> {
    if (!this.activeKey) throw new Error('Vault is locked.');

    const encrypted = await encryptText(itemData.password, this.activeKey);
    const notesEncrypted = itemData.notes ? await encryptText(itemData.notes, this.activeKey) : null;

    const items = JSON.parse(localStorage.getItem(VAULT_ITEMS_KEY) || '[]');
    const newItem = {
      id: window.crypto.randomUUID(),
      websiteName: itemData.websiteName,
      url: itemData.url,
      username: itemData.username,
      email: itemData.email,
      encryptedPassword: encrypted.ciphertext,
      iv: encrypted.iv,
      encryptedNotes: notesEncrypted?.ciphertext || null,
      notesIv: notesEncrypted?.iv || null,
      category: itemData.category,
      securityScore: itemData.securityScore || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(VAULT_ITEMS_KEY, JSON.stringify([newItem, ...items]));
    this.logActivity('VAULT_ADD', `Added credential for ${itemData.websiteName}.`);

    return {
      ...newItem,
      password: itemData.password,
      notes: itemData.notes
    };
  }

  /**
   * Get all decrypted items
   */
  static async getVaultItems(): Promise<any[]> {
    if (!this.activeKey) return [];

    const items = JSON.parse(localStorage.getItem(VAULT_ITEMS_KEY) || '[]');
    const decryptedItems = [];

    for (const item of items) {
      try {
        const password = await decryptText(item.encryptedPassword, item.iv, this.activeKey);
        const notes = item.encryptedNotes && item.notesIv 
          ? await decryptText(item.encryptedNotes, item.notesIv, this.activeKey) 
          : '';

        decryptedItems.push({
          id: item.id,
          websiteName: item.websiteName,
          url: item.url,
          username: item.username,
          email: item.email,
          password: password,
          notes: notes,
          category: item.category,
          securityScore: item.securityScore,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        });
      } catch (err) {
        console.error(`Failed to decrypt item ${item.id}`);
      }
    }

    return decryptedItems;
  }

  /**
   * Update item
   */
  static async updateVaultItem(id: string, updateData: any): Promise<void> {
    if (!this.activeKey) throw new Error('Vault is locked.');

    const items = JSON.parse(localStorage.getItem(VAULT_ITEMS_KEY) || '[]');
    const itemIndex = items.findIndex((it: any) => it.id === id);
    if (itemIndex === -1) throw new Error('Item not found.');

    const item = items[itemIndex];
    const updatedFields: any = {
      websiteName: updateData.websiteName ?? item.websiteName,
      url: updateData.url ?? item.url,
      username: updateData.username ?? item.username,
      email: updateData.email ?? item.email,
      category: updateData.category ?? item.category,
      securityScore: updateData.securityScore ?? item.securityScore,
      updatedAt: new Date().toISOString()
    };

    if (updateData.password) {
      const encrypted = await encryptText(updateData.password, this.activeKey);
      updatedFields.encryptedPassword = encrypted.ciphertext;
      updatedFields.iv = encrypted.iv;
    }

    if (updateData.notes !== undefined) {
      if (updateData.notes) {
        const encrypted = await encryptText(updateData.notes, this.activeKey);
        updatedFields.encryptedNotes = encrypted.ciphertext;
        updatedFields.notesIv = encrypted.iv;
      } else {
        updatedFields.encryptedNotes = null;
        updatedFields.notesIv = null;
      }
    }

    items[itemIndex] = { ...item, ...updatedFields };
    localStorage.setItem(VAULT_ITEMS_KEY, JSON.stringify(items));
    this.logActivity('VAULT_EDIT', `Updated credential for ${updatedFields.websiteName}.`);
  }

  /**
   * Delete item
   */
  static async deleteVaultItem(id: string): Promise<void> {
    const items = JSON.parse(localStorage.getItem(VAULT_ITEMS_KEY) || '[]');
    const item = items.find((it: any) => it.id === id);
    if (!item) return;

    const filtered = items.filter((it: any) => it.id !== id);
    localStorage.setItem(VAULT_ITEMS_KEY, JSON.stringify(filtered));
    this.logActivity('VAULT_DELETE', `Deleted credential for ${item.websiteName}.`);
  }

  /**
   * Change Master Password
   */
  static async changeMasterPassword(oldPass: string, newPass: string): Promise<void> {
    const saltHex = localStorage.getItem(SALT_KEY);
    const encryptedContainerStr = localStorage.getItem(ENCRYPTED_KEY_CONTAINER);

    if (!saltHex || !encryptedContainerStr) throw new Error('No local vault found.');

    // 1. Verify old password by decrypting raw user key
    const salt = hexToBuf(saltHex);
    const oldMasterKey = await deriveMasterKey(oldPass, salt);
    const container = JSON.parse(encryptedContainerStr);

    let userKey: string;
    try {
      userKey = await decryptText(container.ciphertext, container.iv, oldMasterKey);
    } catch {
      throw new Error('Current master password is incorrect.');
    }

    // 2. Generate new salt and re-encrypt the user key with new password derived key
    const newSalt = window.crypto.getRandomValues(new Uint8Array(16));
    const newSaltHex = bufToHex(newSalt.buffer);
    localStorage.setItem(SALT_KEY, newSaltHex);

    const newMasterKey = await deriveMasterKey(newPass, newSalt);
    const newEncrypted = await encryptText(userKey, newMasterKey);
    localStorage.setItem(ENCRYPTED_KEY_CONTAINER, JSON.stringify(newEncrypted));

    this.logActivity('MASTER_PASSWORD_CHANGE', 'Master password changed, keys re-derived successfully.');
  }

  /**
   * Load activity logs
   */
  static getActivityLogs(): any[] {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem(ACTIVITY_LOGS_KEY) || '[]');
  }

  /**
   * Get raw user key hex
   */
  static getRawUserKey(): string {
    return this.rawUserKey;
  }

  /**
   * Check if user key is loaded (vault is unlocked)
   */
  static isUnlocked(): boolean {
    return this.activeKey !== null;
  }

  /**
   * Lock vault (wipes key from memory)
   */
  static lock() {
    this.activeKey = null;
    this.rawUserKey = '';
    this.logActivity('LOGOUT', 'Vault locked.');
  }
}
