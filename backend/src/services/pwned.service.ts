import axios from 'axios';
import crypto from 'crypto';

export class PwnedService {
  /**
   * Hashes a password with SHA-1 and returns it in uppercase.
   */
  private static sha1(text: string): string {
    return crypto.createHash('sha1').update(text).digest('hex').toUpperCase();
  }

  /**
   * Checks if a password has been leaked in a data breach.
   * Returns the count of leaks, or 0 if not leaked.
   */
  static async checkPasswordBreach(password: string): Promise<number> {
    try {
      const fullHash = this.sha1(password);
      const prefix = fullHash.substring(0, 5);
      const suffix = fullHash.substring(5);

      // Fetch all hashes matching the prefix from HaveIBeenPwned
      const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'User-Agent': 'SecureVault-App' },
        timeout: 5000,
      });

      const lines = response.data.split('\r\n');
      for (const line of lines) {
        const [lineSuffix, countStr] = line.split(':');
        if (lineSuffix === suffix) {
          return parseInt(countStr, 10);
        }
      }

      return 0;
    } catch (error) {
      console.error('⚠️ Have I Been Pwned API request failed:', error instanceof Error ? error.message : error);
      // In production, we might want to fail open or fail closed. Let's return 0 (fail-open) so user's experience is not broken,
      // but log the incident.
      return 0;
    }
  }
}
