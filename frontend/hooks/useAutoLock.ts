import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

export const useAutoLock = () => {
  const { isAuthenticated, isLocked, autoLockInterval, lockApp } = useAuthStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isLocked) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      
      const timeoutMs = autoLockInterval * 60 * 1000;
      
      timerRef.current = setTimeout(() => {
        lockApp();
      }, timeoutMs);
    };

    // Events to monitor user activity
    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    
    // Initial start
    resetTimer();

    // Attach listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthenticated, isLocked, autoLockInterval, lockApp]);
};
