'use client';

import React from 'react';
import zxcvbn from 'zxcvbn';
import { motion } from 'framer-motion';

interface PasswordStrengthMeterProps {
  password?: string;
  onScoreChange?: (score: number) => void;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password = '',
  onScoreChange,
}) => {
  const result = zxcvbn(password);
  const score = password ? result.score : -1; // 0 to 4

  // Notify parent of score out of 100 for storage
  React.useEffect(() => {
    if (onScoreChange) {
      // Map 0-4 score to 0-100 percentage
      const percentScore = password ? Math.round((result.score / 4) * 100) : 0;
      onScoreChange(percentScore);
    }
  }, [password, result.score, onScoreChange]);

  const strengthLabels = ['Very Weak 🔴', 'Weak 🟠', 'Fair 🟡', 'Good 🟢', 'Very Strong 🏆'];
  const strengthColors = [
    'bg-ios-red',
    'bg-ios-orange',
    'bg-ios-yellow',
    'bg-ios-blue',
    'bg-ios-green',
  ];

  // Calculate entropy bits
  // standard entropy formula: log2(charset_size ^ password_length)
  const calculateEntropyBits = (pass: string): number => {
    if (!pass) return 0;
    let charsetSize = 0;
    if (/[a-z]/.test(pass)) charsetSize += 26;
    if (/[A-Z]/.test(pass)) charsetSize += 26;
    if (/[0-9]/.test(pass)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(pass)) charsetSize += 33;

    return Math.round(pass.length * Math.log2(charsetSize));
  };

  const entropyBits = calculateEntropyBits(password);

  return (
    <div className="w-full mt-2">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Password Strength
        </span>
        {password && (
          <span className="text-xs font-semibold">
            {strengthLabels[score]}
          </span>
        )}
      </div>

      {/* 5 strength bars */}
      <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full rounded-full overflow-hidden bg-slate-200 dark:bg-white/10">
        {[0, 1, 2, 3, 4].map((index) => (
          <motion.div
            key={index}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: score >= index ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className={`h-full origin-left rounded-full ${
              score >= index ? strengthColors[score] : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      {password && (
        <div className="flex justify-between mt-2 text-[10px] text-slate-500 dark:text-slate-400">
          <span>Security Score: {Math.round((score / 4) * 100)}/100</span>
          <span>Entropy: {entropyBits} bits of security</span>
        </div>
      )}
    </div>
  );
};
export default PasswordStrengthMeter;
