'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, KeyRound, Mail, AlertTriangle, ArrowRight, ShieldCheck, LockKeyhole } from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, set2FATempToken, temp2FAToken, isAuthenticated } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [is2FAFlow, setIs2FAFlow] = useState(false);

  // If already authenticated, redirect straight to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await api.post('/auth/login', { email, masterPassword });

      if (res.data.twoFactorRequired) {
        // Switch to 2FA challenge input
        set2FATempToken(res.data.tempToken);
        setIs2FAFlow(true);
      } else {
        // Successful login
        const { user, accessToken } = res.data;
        setAuth(user, accessToken);
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Invalid email or master password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await api.post('/auth/verify-2fa', {
        tempToken: temp2FAToken,
        code: totpCode,
      });

      const { user, accessToken } = res.data;
      setAuth(user, accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Verification code failed. Please check your authenticator or backup codes.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-1/4 left-1/4 w-[35vw] h-[35vw] rounded-full bg-ios-blue/5 dark:bg-ios-blue/10 blur-[80px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-[35vw] h-[35vw] rounded-full bg-ios-indigo/5 dark:bg-ios-indigo/10 blur-[80px] pointer-events-none -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="glass-panel max-w-md w-full p-8 rounded-3xl shadow-glass-dark border border-white/10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-ios-blue to-ios-indigo flex items-center justify-center shadow-glow-blue mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SecureVault</h1>
          <p className="text-xs text-slate-400 mt-1">iOS 26 Style Zero-Knowledge Password Manager</p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 rounded-xl bg-ios-red/10 border border-ios-red/20 text-ios-red flex items-start gap-2.5 text-xs font-medium"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!is2FAFlow ? (
            <motion.form
              key="login-form"
              onSubmit={handleLogin}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-5"
            >
              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full glass-input pl-11"
                  />
                </div>
              </div>

              {/* Master Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-slate-400">Master Password</label>
                  <Link href="/forgot-password" className="text-xs text-ios-blue hover:underline">
                    Forgot?
                  </Link>
                </div>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-4 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full glass-input pl-11 font-mono tracking-widest text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 rounded-xl bg-ios-blue hover:bg-ios-blue/90 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-glow-blue"
              >
                {isLoading ? 'Decrypting Vault...' : 'Unlock Vault'}
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>

              <div className="text-center mt-6 text-xs text-slate-400">
                New to SecureVault?{' '}
                <Link href="/register" className="text-ios-blue hover:underline font-medium">
                  Create secure account
                </Link>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="totp-form"
              onSubmit={handle2FAVerify}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center text-center mb-2">
                <div className="w-12 h-12 rounded-full bg-ios-blue/15 border border-ios-blue/30 flex items-center justify-center mb-4 text-ios-blue">
                  <LockKeyhole className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="font-semibold text-base">Two-Factor Authentication</h3>
                <p className="text-xs text-slate-400 max-w-[280px] mt-1">
                  Enter the 6-digit security code generated by your Google Authenticator or a backup code.
                </p>
              </div>

              {/* TOTP Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400 text-center">Authenticator Code / Backup Code</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="000000"
                  className="w-full glass-input text-center text-lg tracking-widest font-mono font-semibold"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 rounded-xl bg-ios-blue hover:bg-ios-blue/90 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-glow-blue"
              >
                {isLoading ? 'Verifying Securing...' : 'Verify & Unlock'}
                {!isLoading && <ShieldCheck className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIs2FAFlow(false);
                  setTotpCode('');
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                Back to credentials
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
