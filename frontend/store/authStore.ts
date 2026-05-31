import { create } from 'zustand';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  isEmailVerified: boolean;
  createdAt: string;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLocked: boolean; // Locked screen state
  autoLockInterval: number; // in minutes (1, 5, 15, 30)
  temp2FAToken: string | null; // For 2FA challenge flow
  
  setAuth: (user: UserProfile, token: string) => void;
  set2FATempToken: (token: string | null) => void;
  lockApp: () => void;
  unlockApp: () => void;
  setAutoLockInterval: (minutes: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Access localStorage only in client-side environment
  const getInitialLockInterval = () => {
    if (typeof window !== 'undefined') {
      const val = localStorage.getItem('auto_lock_interval');
      return val ? parseInt(val, 10) : 15;
    }
    return 15;
  };

  return {
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLocked: false,
    autoLockInterval: getInitialLockInterval(),
    temp2FAToken: null,

    setAuth: (user, token) => set({
      user,
      accessToken: token,
      isAuthenticated: true,
      isLocked: false,
      temp2FAToken: null,
    }),

    set2FATempToken: (token) => set({ temp2FAToken: token }),

    lockApp: () => {
      if (get().isAuthenticated) {
        set({ isLocked: true });
        console.log('🔒 SecureVault locked automatically due to inactivity.');
      }
    },

    unlockApp: () => set({ isLocked: false }),

    setAutoLockInterval: (minutes) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('auto_lock_interval', minutes.toString());
      }
      set({ autoLockInterval: minutes });
    },

    logout: () => set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLocked: false,
      temp2FAToken: null,
    }),
  };
});
