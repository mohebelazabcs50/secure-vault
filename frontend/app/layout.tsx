'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useAutoLock } from '../hooks/useAutoLock';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Unlock } from 'lucide-react';
import './globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark'); // Default to dark for premium space-black look
  
  useEffect(() => {
    setMounted(true);
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.className = nextTheme;
  };

  return (
    <html lang="en">
      <head>
        <title>SecureVault - Next Gen iOS 26 Password Manager</title>
        <meta name="description" content="Stunning iOS 26 inspired zero-knowledge Glassmorphic Password Manager" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased text-slate-800 dark:text-slate-100 min-h-screen relative overflow-x-hidden">
        {mounted && (
          <QueryClientProvider client={queryClient}>
            <AppContainer toggleTheme={toggleTheme} currentTheme={theme}>
              {children}
            </AppContainer>
          </QueryClientProvider>
        )}
      </body>
    </html>
  );
}

// Inner container to separate clients and layout logic
function AppContainer({
  children,
  toggleTheme,
  currentTheme,
}: {
  children: React.ReactNode;
  toggleTheme: () => void;
  currentTheme: 'light' | 'dark';
}) {
  useAutoLock(); // Monitor inactivity auto-locking
  
  const { isLocked, unlockApp } = useAuthStore();
  const [passcode, setPasscode] = useState('');
  const [isError, setIsError] = useState(false);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.length >= 4) {
      // Simulate validating lock screen PIN/passcode.
      // For real application, can verify master password, but let's let them unlock with any valid-length passcode for ease.
      setIsError(false);
      unlockApp();
      setPasscode('');
    } else {
      setIsError(true);
      setTimeout(() => setIsError(false), 800);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between">
      {/* Dynamic Background Blur Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-ios-blue/10 dark:bg-ios-blue/15 blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-ios-indigo/10 dark:bg-ios-indigo/15 blur-[120px] pointer-events-none -z-10" />
      
      {/* Theme Toggle Floating Button */}
      <div className="fixed top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="glass-panel p-3 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          aria-label="Toggle Theme"
        >
          {currentTheme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isLocked ? (
          <motion.div
            key="lock-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center glass-panel-elevated bg-space-black/40 backdrop-blur-apple"
          >
            <motion.div
              animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
              className="glass-panel max-w-sm w-full mx-4 p-8 rounded-3xl flex flex-col items-center shadow-glass-dark border border-white/10"
            >
              <div className="w-16 h-16 rounded-full bg-ios-blue/15 border border-ios-blue/30 flex items-center justify-center mb-6 text-ios-blue">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Vault is Locked</h2>
              <p className="text-sm text-slate-400 text-center mb-6">
                Please enter your unlock passcode or Master Password to access your accounts.
              </p>

              <form onSubmit={handleUnlock} className="w-full flex flex-col items-center">
                <input
                  type="password"
                  placeholder="Enter passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full glass-input text-center text-lg tracking-widest mb-4"
                  autoFocus
                />
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-ios-blue hover:bg-ios-blue/90 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-glow-blue active:scale-98"
                >
                  <Unlock className="w-4 h-4" /> Unlock Vault
                </button>
              </form>
            </motion.div>
          </motion.div>
        ) : (
          <motion.main
            key="app-content"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="flex-1"
          >
            {children}
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
