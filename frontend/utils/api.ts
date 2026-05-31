// Mock Axios API Adapter for serverless GitHub Pages hosting
// Redirects all REST calls to LocalDbService for browser-native zero-knowledge security.

import axios from 'axios';
import { LocalDbService } from './localDb';

// Browser-native SHA-1 helper for Have I Been Pwned checks
async function sha1(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export const api = {
  post: async (url: string, data: any = {}) => {
    console.log(`📡 [Mock API POST] Request: ${url}`, data);
    
    // Simulate latency
    await new Promise(r => setTimeout(r, 400));

    try {
      if (url.includes('/auth/register')) {
        const result = await LocalDbService.register(data.username, data.email, data.masterPassword);
        return { data: result };
      }

      if (url.includes('/auth/login')) {
        const result = await LocalDbService.login(data.email, data.masterPassword);
        return { data: result };
      }

      if (url.includes('/auth/logout')) {
        LocalDbService.lock();
        return { data: {} };
      }

      if (url.includes('/auth/verify-2fa')) {
        // Automatically succeed local verification
        return { data: { user: JSON.parse(localStorage.getItem('secure_vault_user_profile') || '{}'), accessToken: 'local_token' } };
      }

      if (url.includes('/api/vault/items') || url.includes('/vault/items')) {
        const item = await LocalDbService.addVaultItem(data);
        return { data: { item } };
      }

      if (url.includes('/api/vault/change-master') || url.includes('/vault/change-master')) {
        await LocalDbService.changeMasterPassword(data.oldMasterPassword, data.newMasterPassword);
        return { data: { message: 'Master Password changed successfully.' } };
      }

      if (url.includes('/api/vault/check-breach') || url.includes('/vault/check-breach')) {
        const fullHash = await sha1(data.password);
        const prefix = fullHash.substring(0, 5);
        const suffix = fullHash.substring(5);

        // Fetch direct pwned range query from the browser
        const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
          headers: { 'User-Agent': 'SecureVault-App-Web' }
        });

        const lines = response.data.split('\r\n');
        let leakCount = 0;
        let leaked = false;
        
        for (const line of lines) {
          const [lineSuffix, countStr] = line.split(':');
          if (lineSuffix === suffix) {
            leaked = true;
            leakCount = parseInt(countStr, 10);
            break;
          }
        }

        return { data: { leaked, count: leakCount } };
      }

      if (url.includes('/2fa/setup')) {
        // Setup local simulated 2FA
        const userProfile = JSON.parse(localStorage.getItem('secure_vault_user_profile') || '{}');
        const email = userProfile.email || 'user@example.com';
        const mockQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=otpauth://totp/SecureVault:${email}?secret=JBSWY3DPEHPK3PXP&issuer=SecureVault`;
        const mockBackupCodes = ['BKUP-1234', 'BKUP-5678', 'BKUP-9012', 'BKUP-3456', 'BKUP-7890'];
        return { data: { qrCode: mockQrCode, backupCodes: mockBackupCodes } };
      }

      if (url.includes('/2fa/enable')) {
        LocalDbService.logActivity('2FA_ENABLE', 'Two-factor authenticator activated locally.');
        return { data: { message: '2FA successfully enabled.' } };
      }

      if (url.includes('/2fa/disable')) {
        LocalDbService.logActivity('2FA_DISABLE', 'Two-factor authenticator deactivated.');
        return { data: { message: '2FA successfully disabled.' } };
      }

      if (url.includes('/delete-account')) {
        localStorage.clear();
        return { data: { message: 'Account permanently purged.' } };
      }

      throw new Error(`Mock endpoint ${url} not implemented.`);
    } catch (err: any) {
      console.error(`❌ [Mock API POST Error]`, err);
      throw err;
    }
  },

  get: async (url: string) => {
    console.log(`📡 [Mock API GET] Request: ${url}`);
    
    await new Promise(r => setTimeout(r, 200));

    try {
      if (url.includes('/api/vault/items') || url.includes('/vault/items')) {
        const items = await LocalDbService.getVaultItems();
        return { data: { items } };
      }

      if (url.includes('/api/vault/logs') || url.includes('/vault/logs')) {
        const logs = LocalDbService.getActivityLogs();
        return { data: { logs } };
      }

      if (url.includes('/auth/me') || url.includes('/me')) {
        const profile = JSON.parse(localStorage.getItem('secure_vault_user_profile') || 'null');
        return { data: { user: profile } };
      }

      if (url.includes('/api/vault/export') || url.includes('/vault/export')) {
        const items = await LocalDbService.getVaultItems();
        const format = url.includes('format=csv') ? 'csv' : 'json';
        
        let fileData: any;
        if (format === 'csv') {
          let csv = 'Website,URL,Username,Email,Password,Category,Notes,CreatedAt\n';
          items.forEach((it: any) => {
            csv += `"${it.websiteName}","${it.url}","${it.username}","${it.email}","${it.password}","${it.category}","${it.notes}","${it.createdAt}"\n`;
          });
          fileData = new Blob([csv], { type: 'text/csv' });
        } else {
          fileData = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        }

        return { data: fileData };
      }

      throw new Error(`Mock endpoint ${url} not implemented.`);
    } catch (err: any) {
      console.error(`❌ [Mock API GET Error]`, err);
      throw err;
    }
  },

  put: async (url: string, data: any) => {
    console.log(`📡 [Mock API PUT] Request: ${url}`, data);
    
    await new Promise(r => setTimeout(r, 300));

    try {
      if (url.includes('/api/vault/items/') || url.includes('/vault/items/')) {
        const id = url.split('/').pop()?.split('?')[0] || '';
        await LocalDbService.updateVaultItem(id, data);
        return { data: { message: 'Credential updated.' } };
      }

      throw new Error(`Mock endpoint ${url} not implemented.`);
    } catch (err: any) {
      console.error(`❌ [Mock API PUT Error]`, err);
      throw err;
    }
  },

  delete: async (url: string) => {
    console.log(`📡 [Mock API DELETE] Request: ${url}`);
    
    await new Promise(r => setTimeout(r, 300));

    try {
      if (url.includes('/api/vault/items/') || url.includes('/vault/items/')) {
        const id = url.split('/').pop()?.split('?')[0] || '';
        await LocalDbService.deleteVaultItem(id);
        return { data: {} };
      }

      throw new Error(`Mock endpoint ${url} not implemented.`);
    } catch (err: any) {
      console.error(`❌ [Mock API DELETE Error]`, err);
      throw err;
    }
  }
};
