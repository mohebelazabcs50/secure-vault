'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, RefreshCw, Sliders, ShieldCheck } from 'lucide-react';
import PasswordStrengthMeter from './PasswordStrengthMeter';

interface PasswordGeneratorProps {
  onSelectPassword?: (password: string) => void;
  inline?: boolean;
}

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({
  onSelectPassword,
  inline = false,
}) => {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [excludeSimilar, setExcludeSimilar] = useState(false);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [copied, setCopied] = useState(false);

  const generatePassword = useCallback(() => {
    let lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    let uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let numberChars = '0123456789';
    let symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (excludeSimilar) {
      // Exclude: i, l, 1, o, 0, O, I
      lowercaseChars = lowercaseChars.replace(/[ilo]/g, '');
      uppercaseChars = uppercaseChars.replace(/[IO]/g, '');
      numberChars = numberChars.replace(/[01]/g, '');
    }

    if (excludeAmbiguous) {
      // Exclude: { } [ ] ( ) / \ ' " ` ~ , ; : . < >
      symbolChars = symbolChars.replace(/[{}[\]()\/\\'"`~,;:.<>]/g, '');
    }

    let charset = '';
    let mandatoryChars = '';

    if (includeLowercase && lowercaseChars) {
      charset += lowercaseChars;
      mandatoryChars += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
    }
    if (includeUppercase && uppercaseChars) {
      charset += uppercaseChars;
      mandatoryChars += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
    }
    if (includeNumbers && numberChars) {
      charset += numberChars;
      mandatoryChars += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
    }
    if (includeSymbols && symbolChars) {
      charset += symbolChars;
      mandatoryChars += symbolChars.charAt(Math.floor(Math.random() * symbolChars.length));
    }

    if (charset.length === 0) {
      setPassword('');
      return;
    }

    let generated = '';
    // Append mandatory characters to avoid missing character classes
    generated += mandatoryChars;

    const remainingLength = length - mandatoryChars.length;
    for (let i = 0; i < remainingLength; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      generated += charset.charAt(randomIndex);
    }

    // Shuffle characters
    const shuffled = generated.split('').sort(() => 0.5 - Math.random()).join('');
    setPassword(shuffled);
  }, [
    length,
    includeUppercase,
    includeLowercase,
    includeNumbers,
    includeSymbols,
    excludeSimilar,
    excludeAmbiguous,
  ]);

  // Generate on load or option change
  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`w-full ${inline ? '' : 'glass-panel p-6 rounded-2xl border border-white/10 shadow-glass-dark'}`}>
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-ios-blue" />
        <h3 className="font-semibold text-base">Advanced Generator</h3>
      </div>

      {/* Output Display */}
      <div className="relative w-full flex items-center mb-4">
        <input
          type="text"
          readOnly
          value={password}
          className="w-full glass-input pr-12 font-mono text-center tracking-wide text-base select-all bg-white/[0.04] border-white/15 dark:border-white/10"
        />
        <div className="absolute right-2 flex gap-1">
          <button
            onClick={generatePassword}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 active:scale-95 transition-all"
            title="Regenerate"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 active:scale-95 transition-all"
            title="Copy Password"
          >
            {copied ? <Check className="w-4 h-4 text-ios-green" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Password Strength display */}
      <PasswordStrengthMeter password={password} />

      <hr className="my-4 border-white/10" />

      {/* Controls */}
      <div className="space-y-4">
        {/* Length slider */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-slate-400">Password Length</span>
            <span className="font-semibold font-mono text-ios-blue">{length} characters</span>
          </div>
          <input
            type="range"
            min="8"
            max="64"
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value, 10))}
            className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-ios-blue"
          />
        </div>

        {/* Character Checkboxes */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeUppercase}
              onChange={(e) => setIncludeUppercase(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 accent-ios-blue cursor-pointer"
            />
            <span>A-Z (Uppercase)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeLowercase}
              onChange={(e) => setIncludeLowercase(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 accent-ios-blue cursor-pointer"
            />
            <span>a-z (Lowercase)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeNumbers}
              onChange={(e) => setIncludeNumbers(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 accent-ios-blue cursor-pointer"
            />
            <span>0-9 (Numbers)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSymbols}
              onChange={(e) => setIncludeSymbols(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 accent-ios-blue cursor-pointer"
            />
            <span>!@#$ (Symbols)</span>
          </label>
        </div>

        {/* Exclusions */}
        <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeSimilar}
              onChange={(e) => setExcludeSimilar(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 accent-ios-blue cursor-pointer"
            />
            <span className="text-slate-400">Exclude similar characters (e.g. i, l, 1, 0, o)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeAmbiguous}
              onChange={(e) => setExcludeAmbiguous(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 accent-ios-blue cursor-pointer"
            />
            <span className="text-slate-400">Exclude ambiguous characters (e.g. &#123; &#125; [ ] ( ))</span>
          </label>
        </div>

        {/* Autofill Injection button */}
        {onSelectPassword && password && (
          <button
            onClick={() => onSelectPassword(password)}
            className="w-full py-2.5 mt-4 rounded-xl bg-ios-blue hover:bg-ios-blue/90 text-white font-medium text-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
          >
            Use Password
          </button>
        )}
      </div>
    </div>
  );
};
export default PasswordGenerator;
