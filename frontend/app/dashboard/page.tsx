'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, KeyRound, Search, Filter, Plus, LogOut, Settings, History, 
  Layers, Copy, Check, Eye, EyeOff, Globe, Mail, User, BookOpen, 
  Trash2, Edit3, ShieldAlert, Download, Sliders, QRcode, CheckCircle, ExternalLink
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useVaultStore, VaultItem } from '../store/vaultStore';
import PasswordGenerator from '../../components/ui/PasswordGenerator';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { 
    items, setItems, addItem, updateItem, deleteItem, 
    searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, 
    sortBy, setSortBy, getStats 
  } = useVaultStore();

  // Tab State: 'passwords' | 'generator' | 'logs' | 'settings'
  const [activeTab, setActiveTab] = useState<'passwords' | 'generator' | 'logs' | 'settings'>('passwords');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);

  // Field states for Add/Edit
  const [websiteName, setWebsiteName] = useState('');
  const [url, setUrl] = useState('');
  const [itemUsername, setItemUsername] = useState('');
  const [itemEmail, setItemEmail] = useState('');
  const [itemPassword, setItemPassword] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [itemCategory, setItemCategory] = useState<'Social Media' | 'Banking' | 'Work' | 'Gaming' | 'Shopping' | 'Crypto'>('Social Media');
  
  // Utility states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Have I Been Pwned checks state
  const [breachResult, setBreachResult] = useState<{ checked: boolean; leaked: boolean; count: number }>({
    checked: false,
    leaked: false,
    count: 0
  });
  const [isBreachChecking, setIsBreachChecking] = useState(false);

  // Settings states
  const [oldMasterPass, setOldMasterPass] = useState('');
  const [newMasterPass, setNewMasterPass] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  
  // 2FA Setup states
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [is2FASetupStep, setIs2FASetupStep] = useState(false);

  // Logs state
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  // Check auth
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Load vault items & activity logs
  const fetchVault = async () => {
    try {
      const res = await api.get('/api/vault/items');
      setItems(res.data.items);
    } catch (err) {
      console.error('Failed to load vault items', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/api/vault/logs');
      setActivityLogs(res.data.logs);
    } catch (err) {
      console.error('Failed to load activity logs', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchVault();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout request error', err);
    } finally {
      logout();
      router.push('/');
    }
  };

  // Create new credential
  const handleCreateCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    setActionError('');

    try {
      // Calculate a local zxcvbn-like score or default it
      const res = await api.post('/api/vault/items', {
        websiteName,
        url,
        username: itemUsername,
        email: itemEmail,
        password: itemPassword,
        notes: itemNotes,
        category: itemCategory,
        securityScore: itemPassword.length >= 16 ? 90 : itemPassword.length >= 12 ? 65 : 35
      });

      addItem(res.data.item);
      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to save credential.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Edit existing credential
  const handleUpdateCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSubmitLoading(true);
    setActionError('');

    try {
      await api.put(`/api/vault/items/${selectedItem.id}`, {
        websiteName,
        url,
        username: itemUsername,
        email: itemEmail,
        password: itemPassword,
        notes: itemNotes,
        category: itemCategory,
        securityScore: itemPassword ? (itemPassword.length >= 16 ? 90 : itemPassword.length >= 12 ? 65 : 35) : undefined
      });

      updateItem(selectedItem.id, {
        websiteName,
        url,
        username: itemUsername,
        email: itemEmail,
        password: itemPassword || selectedItem.password,
        notes: itemNotes,
        category: itemCategory,
      });

      setIsDetailModalOpen(false);
      setSelectedItem(null);
      resetForm();
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to edit credential.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Delete credential
  const handleDeleteCredential = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this credential?')) return;
    try {
      await api.delete(`/api/vault/items/${id}`);
      deleteItem(id);
      setIsDetailModalOpen(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to delete item', err);
    }
  };

  // Have I Been Pwned Check
  const checkPasswordLeak = async (pass: string) => {
    setIsBreachChecking(true);
    setBreachResult({ checked: false, leaked: false, count: 0 });
    try {
      const res = await api.post('/api/vault/check-breach', { password: pass });
      setBreachResult({
        checked: true,
        leaked: res.data.leaked,
        count: res.data.count
      });
      // Update in local store
      if (selectedItem) {
        updateItem(selectedItem.id, { isLeaked: res.data.leaked });
      }
    } catch (err) {
      console.error('Breach check error', err);
    } finally {
      setIsBreachChecking(false);
    }
  };

  // Master Password rotation
  const handleRotateMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsMessage('');

    try {
      await api.post('/api/vault/change-master', {
        oldMasterPassword: oldMasterPass,
        newMasterPassword: newMasterPass
      });
      setSettingsMessage('Master Password successfully rotated. All vault items re-keyed under new cryptography.');
      setOldMasterPass('');
      setNewMasterPass('');
    } catch (err: any) {
      setSettingsError(err.response?.data?.error || 'Password rotation failed. Check current password.');
    }
  };

  // Setup 2FA
  const handleSetup2FA = async () => {
    setSettingsError('');
    try {
      const res = await api.post('/api/vault/2fa/setup');
      setQrCode(res.data.qrCode);
      setBackupCodes(res.data.backupCodes);
      setIs2FASetupStep(true);
    } catch (err: any) {
      setSettingsError(err.response?.data?.error || 'Failed to initialize 2FA configuration.');
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsMessage('');
    try {
      await api.post('/api/vault/2fa/enable', { code: totpVerifyCode });
      setSettingsMessage('Two-Factor Authentication activated successfully.');
      setIs2FASetupStep(false);
      setQrCode('');
      setTotpVerifyCode('');
    } catch (err: any) {
      setSettingsError(err.response?.data?.error || 'Invalid authenticator code.');
    }
  };

  // Export Vault
  const handleExportVault = async (format: 'json' | 'csv') => {
    try {
      const response = await api.get(`/api/vault/export?format=${format}`, {
        responseType: 'blob'
      });
      const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = urlBlob;
      link.setAttribute('download', `vault_export.${format === 'csv' ? 'csv' : 'json'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const resetForm = () => {
    setWebsiteName('');
    setUrl('');
    setItemUsername('');
    setItemEmail('');
    setItemPassword('');
    setItemNotes('');
    setItemCategory('Social Media');
    setActionError('');
    setBreachResult({ checked: false, leaked: false, count: 0 });
  };

  const copyToClipboard = (text: string, id: string, field = '') => {
    navigator.clipboard.writeText(text);
    if (field) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const openDetailModal = (item: VaultItem) => {
    setSelectedItem(item);
    setWebsiteName(item.websiteName);
    setUrl(item.url);
    setItemUsername(item.username);
    setItemEmail(item.email);
    setItemPassword(item.password || '');
    setItemNotes(item.notes || '');
    setItemCategory(item.category);
    setBreachResult({ checked: false, leaked: !!item.isLeaked, count: 0 });
    setIsDetailModalOpen(true);
  };

  // Computed Items List based on searches and categories
  const displayedItems = items
    .filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        item.websiteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.email.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'website') return a.websiteName.localeCompare(b.websiteName);
      if (sortBy === 'score') return b.securityScore - a.securityScore;
      // date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const stats = getStats();

  const categoriesList = ['All', 'Social Media', 'Banking', 'Work', 'Gaming', 'Shopping', 'Crypto'];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-space-silver dark:bg-space-black text-slate-800 dark:text-slate-100 font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 glass-panel border-r border-white/10 p-6 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-ios-blue to-ios-indigo flex items-center justify-center shadow-glow-blue">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm leading-none">SecureVault</h2>
              <span className="text-[10px] text-slate-400">iOS 26 Frosted Edition</span>
            </div>
          </div>

          {/* User profile capsule */}
          {user && (
            <div className="mb-6 p-3 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-ios-blue/15 border border-ios-blue/30 flex items-center justify-center text-ios-blue font-semibold text-xs uppercase">
                {user.username.substring(0, 2)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold truncate">{user.username}</p>
                <p className="text-[9px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          )}

          {/* Sidebar Menu items */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('passwords')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-medium flex items-center gap-3 transition-all ${
                activeTab === 'passwords'
                  ? 'bg-ios-blue text-white shadow-glow-blue'
                  : 'hover:bg-white/[0.05] text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-4 h-4" /> Passwords Vault
            </button>
            <button
              onClick={() => setActiveTab('generator')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-medium flex items-center gap-3 transition-all ${
                activeTab === 'generator'
                  ? 'bg-ios-blue text-white shadow-glow-blue'
                  : 'hover:bg-white/[0.05] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" /> Password Generator
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-medium flex items-center gap-3 transition-all ${
                activeTab === 'logs'
                  ? 'bg-ios-blue text-white shadow-glow-blue'
                  : 'hover:bg-white/[0.05] text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" /> Activity Logs
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-medium flex items-center gap-3 transition-all ${
                activeTab === 'settings'
                  ? 'bg-ios-blue text-white shadow-glow-blue'
                  : 'hover:bg-white/[0.05] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" /> Secure Settings
            </button>
          </nav>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-2.5 px-4 mt-8 rounded-xl text-left text-xs font-medium flex items-center gap-3 text-ios-red hover:bg-ios-red/10 transition-all active:scale-95"
        >
          <LogOut className="w-4 h-4" /> Logout Vault
        </button>
      </aside>

      {/* Main Workspace Panel */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        
        {/* TAB: PASSWORD VAULT */}
        {activeTab === 'passwords' && (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold">Credentials</h1>
                <p className="text-xs text-slate-400 mt-0.5">Manage and organize your secure records</p>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  setIsAddModalOpen(true);
                }}
                className="py-2 px-4 rounded-xl bg-ios-blue text-white font-medium text-xs flex items-center gap-2 hover:bg-ios-blue/90 shadow-glow-blue active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Password
              </button>
            </div>

            {/* Apple iCloud-style analytics cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-28 border border-white/5 shadow-glass-light dark:shadow-glass-dark">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Accounts</span>
                <span className="text-3xl font-bold text-ios-blue">{stats.total}</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-28 border border-white/5 shadow-glass-light dark:shadow-glass-dark">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Strong Passwords</span>
                <span className="text-3xl font-bold text-ios-green">{stats.strong}</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-28 border border-white/5 shadow-glass-light dark:shadow-glass-dark">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Weak Passwords</span>
                <span className="text-3xl font-bold text-ios-red">{stats.weak}</span>
              </div>
              <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-28 border border-white/5 shadow-glass-light dark:shadow-glass-dark">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Leaked Passwords</span>
                <span className="text-3xl font-bold text-ios-orange">{stats.leaked}</span>
              </div>
            </div>

            {/* Vault Filter and Search controls */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white/[0.02] border border-white/5 p-4 rounded-2xl glass-panel">
              {/* Search bar */}
              <div className="relative w-full lg:max-w-xs flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search website, username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full glass-input pl-10 py-2.5 rounded-xl border-white/10 dark:border-white/5"
                />
              </div>

              {/* Category Quick Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto scrollbar-hide py-1">
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`py-1.5 px-3 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-ios-blue/15 text-ios-blue border border-ios-blue/30'
                        : 'border border-white/5 hover:bg-white/[0.04] text-slate-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Sorting Filter */}
              <div className="flex items-center gap-1.5 self-end lg:self-auto text-xs shrink-0 text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent outline-none cursor-pointer border-none font-semibold text-slate-300 focus:ring-0 text-[10px]"
                >
                  <option value="website" className="dark:bg-space-black">Sort: Name</option>
                  <option value="score" className="dark:bg-space-black">Sort: Strength</option>
                  <option value="date" className="dark:bg-space-black">Sort: Date</option>
                </select>
              </div>
            </div>

            {/* Credentials Listing Grid */}
            {displayedItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {displayedItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileHover={{ y: -3 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                      onClick={() => openDetailModal(item)}
                      className="glass-panel p-5 rounded-2xl cursor-pointer hover:border-ios-blue/30 transition-all border border-white/5 shadow-glass-light dark:shadow-glass-dark relative flex flex-col justify-between h-40"
                    >
                      <div>
                        {/* Title details */}
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-slate-300">
                              <Globe className="w-4 h-4" />
                            </div>
                            <div className="overflow-hidden">
                              <h3 className="font-semibold text-xs leading-tight truncate max-w-[120px]">
                                {item.websiteName}
                              </h3>
                              <p className="text-[9px] text-slate-400 truncate max-w-[120px]">{item.url}</p>
                            </div>
                          </div>

                          <span className="py-1 px-2 rounded-md bg-white/[0.04] text-[8px] font-semibold text-slate-400">
                            {item.category}
                          </span>
                        </div>

                        {/* Account values */}
                        <div className="space-y-1 mb-3">
                          <p className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                            <User className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{item.username}</span>
                          </p>
                          {item.email && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{item.email}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Security strength meters */}
                      <div className="flex justify-between items-center pt-2.5 border-t border-white/5">
                        <div className="flex flex-col gap-0.5 w-2/3">
                          <span className="text-[8px] text-slate-400 font-semibold">Security Score</span>
                          <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.securityScore >= 75
                                  ? 'bg-ios-green'
                                  : item.securityScore >= 50
                                  ? 'bg-ios-yellow'
                                  : 'bg-ios-red'
                              }`}
                              style={{ width: `${item.securityScore}%` }}
                            />
                          </div>
                        </div>

                        {item.isLeaked && (
                          <div className="flex items-center gap-1 text-[8px] font-semibold text-ios-orange shrink-0 bg-ios-orange/15 px-1.5 py-0.5 rounded-md">
                            <ShieldAlert className="w-2.5 h-2.5" /> Leaked
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl border border-white/5 p-12 text-center text-slate-400">
                <Shield className="w-12 h-12 text-slate-500 mx-auto mb-4 animate-pulse" />
                <p className="text-xs font-semibold">No credentials found</p>
                <p className="text-[10px] text-slate-500 mt-1">Create a new record or adjust your search filter</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: PASSWORDS GENERATOR */}
        {activeTab === 'generator' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h1 className="text-xl font-bold">Key Generator</h1>
              <p className="text-xs text-slate-400 mt-0.5">Derive cryptographically strong, unbreakable passwords</p>
            </div>
            <PasswordGenerator />
          </div>
        )}

        {/* TAB: ACTIVITY LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold">Activity Audit</h1>
              <p className="text-xs text-slate-400 mt-0.5">Track sign-ins, changes, and export requests on your vault</p>
            </div>

            <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="p-4">Action</th>
                      <th className="p-4">Device</th>
                      <th className="p-4">IP Address</th>
                      <th className="p-4">Details</th>
                      <th className="p-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activityLogs.length > 0 ? (
                      activityLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/[0.02]">
                          <td className="p-4 font-semibold">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[9px] ${
                                log.action.includes('ADD') || log.action.includes('ENABLE')
                                  ? 'bg-ios-green/10 text-ios-green border border-ios-green/10'
                                  : log.action.includes('DELETE') || log.action.includes('DISABLE')
                                  ? 'bg-ios-red/10 text-ios-red border border-ios-red/10'
                                  : 'bg-ios-blue/10 text-ios-blue border border-ios-blue/10'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300 font-mono text-[10px] truncate max-w-[120px]">
                            {log.device}
                          </td>
                          <td className="p-4 text-slate-300 font-mono text-[10px]">{log.ipAddress || '127.0.0.1'}</td>
                          <td className="p-4 text-slate-400 truncate max-w-[200px]">{log.details}</td>
                          <td className="p-4 text-slate-400 font-mono text-[10px]">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          No audit activities recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SECURE SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h1 className="text-xl font-bold">Vault Security Settings</h1>
              <p className="text-xs text-slate-400 mt-0.5">Control 2FA authentication, key rotation, and export vault data</p>
            </div>

            {/* Notification triggers */}
            <AnimatePresence>
              {settingsMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 rounded-xl bg-ios-green/10 border border-ios-green/20 text-ios-green flex items-start gap-2.5 text-xs font-medium"
                >
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{settingsMessage}</span>
                </motion.div>
              )}

              {settingsError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 rounded-xl bg-ios-red/10 border border-ios-red/20 text-ios-red flex items-start gap-2.5 text-xs font-medium"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{settingsError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 2FA Authenticator Setup Card */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-glass-light dark:shadow-glass-dark space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <QRcode className="w-4 h-4 text-ios-blue" /> Two-Factor Authentication (2FA)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Add an extra layer of defense to your vault. Once enabled, logging into your SecureVault account requires your master password and a 6-digit TOTP security code from your Google Authenticator app.
              </p>

              {!is2FASetupStep ? (
                <button
                  onClick={handleSetup2FA}
                  className="py-2 px-4 rounded-xl border border-ios-blue/30 text-ios-blue hover:bg-ios-blue/10 active:scale-95 text-xs font-semibold transition-all"
                >
                  Configure 2FA Authenticator
                </button>
              ) : (
                <motion.form
                  onSubmit={handleEnable2FA}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 pt-4 border-t border-white/5 flex flex-col items-center"
                >
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* QR display */}
                    <div className="p-3 bg-white rounded-xl border border-white/10 shrink-0">
                      <img src={qrCode} alt="2FA QR Code" className="w-36 h-36" />
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] text-slate-300">
                        1. Scan this QR Code with Google Authenticator or Microsoft Authenticator.<br />
                        2. Make sure to download and save your secure Backup Codes:
                      </p>

                      <div className="grid grid-cols-2 gap-2 p-3 bg-white/[0.04] border border-white/5 rounded-xl font-mono text-[9px] text-center">
                        {backupCodes.map((code, idx) => (
                          <div key={idx} className="flex justify-between px-2 py-0.5 rounded bg-white/[0.02]">
                            <span>Code {idx + 1}:</span>
                            <span className="font-bold text-ios-blue">{code}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-xs flex flex-col gap-1.5 mt-4">
                    <label className="text-[10px] text-slate-400 text-center">Verify 6-digit Authenticator Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={totpVerifyCode}
                      onChange={(e) => setTotpVerifyCode(e.target.value)}
                      placeholder="000000"
                      className="w-full glass-input text-center tracking-widest font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-2 w-full max-w-xs mt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-ios-blue text-white hover:bg-ios-blue/90 text-xs font-semibold transition-all active:scale-95"
                    >
                      Enable 2FA
                    </button>
                    <button
                      type="button"
                      onClick={() => setIs2FASetupStep(false)}
                      className="flex-1 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-slate-400 transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.form>
              )}
            </div>

            {/* Key Rotation Card */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-glass-light dark:shadow-glass-dark space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-ios-yellow" /> Master Password Rotation
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Rotate your Master Password securely. This derives a new cryptographic key, decrypts your user vault key, and re-encrypts the vault key under the new password. Your stored credentials remain fully intact!
              </p>

              <form onSubmit={handleRotateMasterPassword} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Current Master Password</label>
                    <input
                      type="password"
                      required
                      value={oldMasterPass}
                      onChange={(e) => setOldMasterPass(e.target.value)}
                      placeholder="••••••••••••"
                      className="glass-input font-mono tracking-widest text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">New Master Password</label>
                    <input
                      type="password"
                      required
                      value={newMasterPass}
                      onChange={(e) => setNewMasterPass(e.target.value)}
                      placeholder="••••••••••••"
                      className="glass-input font-mono tracking-widest text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-ios-yellow text-slate-900 hover:bg-ios-yellow/90 active:scale-95 text-xs font-semibold transition-all"
                >
                  Change Master Password
                </button>
              </form>
            </div>

            {/* Export Vault Backup Card */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-glass-light dark:shadow-glass-dark space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Download className="w-4 h-4 text-ios-green" /> Export Credentials
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Export your saved passwords for backups. The files will be fully decrypted in plain text format so download them to a secure location only.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleExportVault('json')}
                  className="py-2 px-4 rounded-xl border border-white/10 hover:bg-white/5 flex items-center gap-2 active:scale-95 text-xs font-semibold transition-all"
                >
                  <Download className="w-4 h-4 text-slate-400" /> Export JSON
                </button>
                <button
                  onClick={() => handleExportVault('csv')}
                  className="py-2 px-4 rounded-xl border border-white/10 hover:bg-white/5 flex items-center gap-2 active:scale-95 text-xs font-semibold transition-all"
                >
                  <Download className="w-4 h-4 text-slate-400" /> Export CSV
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* SLIDING GLASSMODAL: ADD NEW CREDENTIAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-black/30 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="glass-panel-elevated max-w-lg w-full p-6 rounded-3xl border border-white/10 shadow-glass-dark flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-bold">Add Account Password</h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              {actionError && (
                <div className="mb-4 p-3.5 rounded-xl bg-ios-red/10 border border-ios-red/20 text-ios-red text-xs">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleCreateCredential} className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Website Name */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Website/App Name</label>
                    <input
                      type="text"
                      required
                      value={websiteName}
                      onChange={(e) => setWebsiteName(e.target.value)}
                      placeholder="Google"
                      className="glass-input text-xs"
                    />
                  </div>

                  {/* URL */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">URL</label>
                    <input
                      type="url"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://google.com"
                      className="glass-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Username */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Username</label>
                    <input
                      type="text"
                      required
                      value={itemUsername}
                      onChange={(e) => setItemUsername(e.target.value)}
                      placeholder="alex.mercer"
                      className="glass-input text-xs"
                    />
                  </div>

                  {/* Email */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Email Address (Optional)</label>
                    <input
                      type="email"
                      value={itemEmail}
                      onChange={(e) => setItemEmail(e.target.value)}
                      placeholder="alex@gmail.com"
                      className="glass-input text-xs"
                    />
                  </div>
                </div>

                {/* Password Fields with toggle and generator trigger */}
                <div className="flex flex-col gap-1 relative">
                  <label className="text-[10px] text-slate-400">Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={itemPassword}
                      onChange={(e) => setItemPassword(e.target.value)}
                      placeholder="Enter password..."
                      className="w-full glass-input pr-12 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Tiny in-form password generator inject */}
                  <button
                    type="button"
                    onClick={() => {
                      const randomPass = Math.random().toString(36).substring(2, 10) + 
                                         Math.random().toString(36).substring(2, 10).toUpperCase() + 
                                         "!@#$";
                      setItemPassword(randomPass);
                    }}
                    className="text-[9px] text-ios-blue hover:underline self-end mt-1 font-semibold"
                  >
                    Auto-generate strong password
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category Selection */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Category</label>
                    <select
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value as any)}
                      className="glass-input text-xs w-full cursor-pointer dark:bg-space-black"
                    >
                      <option value="Social Media">Social Media</option>
                      <option value="Banking">Banking</option>
                      <option value="Work">Work</option>
                      <option value="Gaming">Gaming</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Crypto">Crypto</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Notes (Optional)</label>
                    <input
                      type="text"
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                      placeholder="Security answers, backup links..."
                      className="glass-input text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitLoading}
                  className="w-full py-3 mt-6 rounded-xl bg-ios-blue text-white hover:bg-ios-blue/90 disabled:opacity-50 text-xs font-semibold shadow-glow-blue active:scale-95 transition-all"
                >
                  {isSubmitLoading ? 'Saving encryption...' : 'Encrypt & Store Password'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SLIDING GLASSMODAL: DETAIL & EDIT VIEW */}
      <AnimatePresence>
        {isDetailModalOpen && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-space-black/30 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="glass-panel-elevated max-w-lg w-full p-6 rounded-3xl border border-white/10 shadow-glass-dark flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-ios-blue">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-none">{websiteName} Details</h3>
                    <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px] inline-block">{url}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDeleteCredential(selectedItem.id)}
                    className="p-2 rounded-lg text-ios-red hover:bg-ios-red/10"
                    title="Delete Credential"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {actionError && (
                <div className="mb-4 p-3 rounded-xl bg-ios-red/10 border border-ios-red/20 text-ios-red text-xs">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleUpdateCredential} className="space-y-4 overflow-y-auto pr-1 flex-1">
                {/* Visual clipboard buttons for fields */}
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Username</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(itemUsername, selectedItem.id, 'username')}
                      className="text-ios-blue flex items-center gap-1 hover:underline font-semibold text-[10px]"
                    >
                      {copiedField === 'username' ? <Check className="w-3 h-3 text-ios-green" /> : <Copy className="w-3 h-3" />}
                      {copiedField === 'username' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={itemUsername}
                    onChange={(e) => setItemUsername(e.target.value)}
                    className="w-full glass-input text-xs"
                  />

                  {selectedItem.email && (
                    <>
                      <div className="flex justify-between items-center text-xs pt-2 border-t border-white/5">
                        <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email Address</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(itemEmail, selectedItem.id, 'email')}
                          className="text-ios-blue flex items-center gap-1 hover:underline font-semibold text-[10px]"
                        >
                          {copiedField === 'email' ? <Check className="w-3 h-3 text-ios-green" /> : <Copy className="w-3 h-3" />}
                          {copiedField === 'email' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <input
                        type="email"
                        value={itemEmail}
                        onChange={(e) => setItemEmail(e.target.value)}
                        className="w-full glass-input text-xs"
                      />
                    </>
                  )}

                  <div className="flex justify-between items-center text-xs pt-2 border-t border-white/5">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Password</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(itemPassword, selectedItem.id, 'password')}
                      className="text-ios-blue flex items-center gap-1 hover:underline font-semibold text-[10px]"
                    >
                      {copiedField === 'password' ? <Check className="w-3 h-3 text-ios-green" /> : <Copy className="w-3 h-3" />}
                      {copiedField === 'password' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={itemPassword}
                      onChange={(e) => setItemPassword(e.target.value)}
                      className="w-full glass-input pr-12 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Have I Been Pwned check section */}
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-ios-orange" /> Have I Been Pwned API</p>
                    <p className="text-[9px] text-slate-400 leading-relaxed">Check if this password has appeared in any public data leaks.</p>
                  </div>
                  
                  <button
                    type="button"
                    disabled={isBreachChecking}
                    onClick={() => checkPasswordLeak(itemPassword)}
                    className="py-1.5 px-3 rounded-xl bg-ios-orange/15 text-ios-orange border border-ios-orange/30 text-[10px] font-semibold active:scale-95 transition-all"
                  >
                    {isBreachChecking ? 'API checking...' : 'Check Breach'}
                  </button>

                  <AnimatePresence>
                    {breachResult.checked && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`text-[9px] font-bold px-2 py-1 rounded-md mt-2 md:mt-0 ${
                          breachResult.leaked
                            ? 'bg-ios-red/10 text-ios-red border border-ios-red/20'
                            : 'bg-ios-green/10 text-ios-green border border-ios-green/20'
                        }`}
                      >
                        {breachResult.leaked ? `⚠️ Leaked ${breachResult.count} times` : '🛡️ Safe password'}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category Selection */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Category</label>
                    <select
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value as any)}
                      className="glass-input text-xs w-full dark:bg-space-black"
                    >
                      <option value="Social Media">Social Media</option>
                      <option value="Banking">Banking</option>
                      <option value="Work">Work</option>
                      <option value="Gaming">Gaming</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Crypto">Crypto</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Notes (Optional)</label>
                    <input
                      type="text"
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                      className="glass-input text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitLoading}
                  className="w-full py-3 mt-6 rounded-xl bg-ios-blue text-white hover:bg-ios-blue/90 disabled:opacity-50 text-xs font-semibold shadow-glow-blue active:scale-95 transition-all"
                >
                  {isSubmitLoading ? 'Saving updates...' : 'Save Credential Updates'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
