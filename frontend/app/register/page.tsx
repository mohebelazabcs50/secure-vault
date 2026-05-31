'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, KeyRound, Mail, User, AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import PasswordStrengthMeter from '../../components/ui/PasswordStrengthMeter';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [strengthScore, setStrengthScore] = useState(0);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Require strong master password
    if (strengthScore < 50) {
      setError('Master Password must be at least "Fair" or "Good" (minimum 12 characters, mix lowercase, uppercase, numbers, and symbols).');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.post('/auth/register', {
        email,
        username,
        masterPassword,
      });

      const { user, accessToken } = res.data;
      setAuth(user, accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Registration failed. That email address might already be registered.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background accents */}
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
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create Secure Account</h1>
          <p className="text-xs text-slate-400 mt-1">Set up zero-knowledge password protection</p>
        </div>

        {/* Warning Alert banner */}
        <div className="mb-6 p-3 rounded-xl bg-ios-orange/10 border border-ios-orange/20 text-ios-orange flex items-start gap-2 text-[10px] font-medium leading-relaxed">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Zero-Knowledge Warning:</strong> SecureVault encrypts your vault keys using a key derived from your Master Password. We do not store your password. If lost, your credentials cannot be recovered!
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
        </AnimatePresence>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Username */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">Username</label>
            <div className="relative flex items-center">
              <User className="absolute left-4 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Alex Mercer"
                className="w-full glass-input pl-11"
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">Email Address</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full glass-input pl-11"
              />
            </div>
          </div>

          {/* Master Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">Master Password</label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-4 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Min 12 characters, complex..."
                className="w-full glass-input pl-11 font-mono tracking-widest text-sm"
              />
            </div>
            
            {/* Realtime password strength rating */}
            <PasswordStrengthMeter
              password={masterPassword}
              onScoreChange={(score) => setStrengthScore(score)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 mt-2 rounded-xl bg-ios-blue hover:bg-ios-blue/90 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-glow-blue"
          >
            {isLoading ? 'Creating secure keys...' : 'Create Account & Unlock'}
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>

          <div className="text-center mt-6 text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/" className="text-ios-blue hover:underline font-medium">
              Unlock here
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
