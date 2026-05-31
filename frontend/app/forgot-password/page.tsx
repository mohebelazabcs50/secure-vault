'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, KeyRound, Mail, AlertTriangle, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { api } from '../utils/api';
import PasswordStrengthMeter from '../../components/ui/PasswordStrengthMeter';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [strengthScore, setStrengthScore] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: request token, 2: execute reset

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
      
      // For local testing convenience, if mock token is returned, populate it and go to step 2
      if (res.data.resetToken) {
        setResetToken(res.data.resetToken);
        setStep(2);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request reset. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (strengthScore < 50) {
      setError('Your new master password must be at least "Fair" or "Good".');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.post('/auth/reset-password', {
        resetToken,
        newMasterPassword,
      });
      setMessage(res.data.message);
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. The reset token may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[35vw] h-[35vw] rounded-full bg-ios-blue/5 dark:bg-ios-blue/10 blur-[80px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-[35vw] h-[35vw] rounded-full bg-ios-indigo/5 dark:bg-ios-indigo/10 blur-[80px] pointer-events-none -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="glass-panel max-w-md w-full p-8 rounded-3xl shadow-glass-dark border border-white/10"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-ios-blue to-ios-indigo flex items-center justify-center shadow-glow-blue mb-4">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Recovery Center</h1>
          <p className="text-xs text-slate-400 mt-1">Recover account access</p>
        </div>

        {/* Severe Data Loss Purge Warning Alert */}
        <div className="mb-6 p-3.5 rounded-xl bg-ios-red/10 border border-ios-red/20 text-ios-red flex items-start gap-2.5 text-[10px] font-medium leading-normal">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>CRITICAL CAUTION:</strong> Due to zero-knowledge cryptography, resetting your master password without your current password means all saved passwords in your vault will be permanently purged (unrecoverable). Your vault will be completely re-keyed and empty.
          </span>
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

          {message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 rounded-xl bg-ios-green/10 border border-ios-green/20 text-ios-green flex items-start gap-2.5 text-xs font-medium"
            >
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form
              key="request-form"
              onSubmit={handleRequestToken}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-5"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">Registered Email Address</label>
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 rounded-xl bg-ios-blue hover:bg-ios-blue/90 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-glow-blue"
              >
                {isLoading ? 'Searching logs...' : 'Request Password Reset'}
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>

              <div className="text-center mt-6 text-xs">
                <Link href="/" className="text-slate-400 hover:text-slate-200 transition-colors">
                  Back to login
                </Link>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="reset-form"
              onSubmit={handleResetPassword}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-400">Reset Token</label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full glass-input font-mono text-xs text-center"
                  placeholder="Enter reset token"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-400">New Master Password</label>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-4 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={newMasterPassword}
                    onChange={(e) => setNewMasterPassword(e.target.value)}
                    placeholder="Enter strong password..."
                    className="w-full glass-input pl-11 font-mono tracking-widest text-sm"
                  />
                </div>
                
                <PasswordStrengthMeter
                  password={newMasterPassword}
                  onScoreChange={(score) => setStrengthScore(score)}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 rounded-xl bg-ios-red hover:bg-ios-red/90 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-glow-red"
              >
                {isLoading ? 'Purging vault & changing keys...' : 'Reset & Re-key Account'}
                {!isLoading && <ShieldCheck className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Back to step 1
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
