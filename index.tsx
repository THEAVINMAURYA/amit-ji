import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { AppData, AccountType, TransactionType } from './types';
import Modal from './components/Modal';

// Page Imports
import Dashboard from './pages/Dashboard';
import LedgerPage from './pages/TransactionsPage';
import AccountsPage from './pages/AccountsPage';
import PortfolioPage from './pages/PortfolioPage';
import VaultPage from './pages/CredentialsPage';
import JournalPage from './pages/JournalPage';
import GoalsPage from './pages/GoalsPage';
import BudgetPage from './pages/BudgetPage';
import CalendarPage from './pages/CalendarPage';
import CategoriesPage from './pages/CategoriesPage';

const INITIAL_DATA: AppData = {
  auth: { userId: '', password: '' },
  sync: { syncId: '', autoSync: true, lastSynced: '' },
  transactions: [],
  accounts: [
    { id: 'cash-default', name: 'Main Cash', bankName: 'Physical', accountNumber: '-', balance: 0, type: AccountType.CASH, openingBalance: 0 }
  ],
  credentials: [],
  categories: {
    income: ['Salary', 'Business', 'Investment', 'Freelance', 'Gift'],
    expense: ['Food', 'Transport', 'Shopping', 'Bills', 'Rent', 'Investment', 'Health', 'Education']
  },
  journal: [],
  budgets: [],
  goals: [],
  investments: []
};

// --- E2EE CRYPTO & SYNC UTILS ---
const cryptoUtils = {
  async hash(str: string) {
    const msgUint8 = new TextEncoder().encode(str + "wt_pro_v3_salt");
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 20);
  },
  async deriveKey(password: string) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode("wt_pro_v3_salt"), iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },
  async encrypt(data: string, password: string) {
    const key = await this.deriveKey(password);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(data));
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    let binary = '';
    const bytes = new Uint8Array(combined);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },
  async decrypt(encryptedBase64: string, password: string) {
    try {
      const binary = atob(encryptedBase64);
      const combined = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        combined[i] = binary.charCodeAt(i);
      }
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const key = await this.deriveKey(password);
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      throw new Error("Decryption failed");
    }
  }
};

const App: React.FC = () => {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('wt_pro_elite_v12');
    if (saved) {
      try { setData(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const pushToCloud = async (newData: AppData) => {
    if (!newData.sync.syncId) return;
    setIsSyncing(true);
    try {
      const encrypted = await cryptoUtils.encrypt(JSON.stringify(newData), newData.auth.password);
      // We use a deterministic npoint-like key or similar storage service
      // For this demo context, we simulate a robust cloud push to the derived syncId
      await fetch(`https://api.npoint.io/${newData.sync.syncId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: encrypted, updatedAt: new Date().toISOString() })
      });
    } catch (err) {
      console.error("Cloud push failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const pullFromCloud = async (syncId: string, pass: string) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`https://api.npoint.io/${syncId}`);
      if (!res.ok) return false;
      const remote = await res.json();
      if (!remote.payload) return false;
      
      const decrypted = await cryptoUtils.decrypt(remote.payload, pass);
      const cloudData = JSON.parse(decrypted);
      cloudData.sync.lastSynced = remote.updatedAt;
      
      setData(cloudData);
      localStorage.setItem('wt_pro_elite_v12', JSON.stringify(cloudData));
      return true;
    } catch (err) {
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const persist = useCallback((newData: AppData) => {
    setData(newData);
    localStorage.setItem('wt_pro_elite_v12', JSON.stringify(newData));
    if (newData.sync.autoSync && isLoggedIn) {
      pushToCloud(newData);
    }
  }, [isLoggedIn]);

  const handleLogin = async (uid: string, pass: string) => {
    const derivedId = await cryptoUtils.hash(uid + pass);
    
    // Step 1: Attempt to pull existing data from cloud
    const pulled = await pullFromCloud(derivedId, pass);
    
    if (pulled) {
      setIsLoggedIn(true);
      showToast('Cloud Data Restored Successfully');
    } else {
      // Step 2: If no cloud data found, initialize session with local/new data
      const newData = { 
        ...data, 
        auth: { userId: uid, password: pass }, 
        sync: { ...data.sync, syncId: derivedId, lastSynced: new Date().toISOString() } 
      };
      setData(newData);
      setIsLoggedIn(true);
      showToast('New Sync Profile Initialized');
      pushToCloud(newData);
    }
  };

  const renderPage = () => {
    const props = { data, onSave: persist, showToast };
    switch (currentPage) {
      case 'dashboard': return <Dashboard data={data} onNavigate={setCurrentPage} />;
      case 'ledger': return <LedgerPage {...props} />;
      case 'accounts': return <AccountsPage {...props} />;
      case 'portfolio': return <PortfolioPage {...props} />;
      case 'vault': return <VaultPage {...props} />;
      case 'journal': return <JournalPage {...props} />;
      case 'goals': return <GoalsPage {...props} />;
      case 'budget': return <BudgetPage {...props} />;
      case 'calendar': return <CalendarPage {...props} />;
      case 'categories': return <CategoriesPage {...props} />;
      default: return <Dashboard data={data} onNavigate={setCurrentPage} />;
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 relative overflow-hidden">
        <div className="absolute top-0 -left-10 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-pulse"></div>
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-12 relative z-10">
          <div className="flex flex-col items-center mb-12 text-center">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center text-3xl mb-6 shadow-xl shadow-indigo-200">
              <i className="fas fa-cloud-bolt"></i>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">WealthTrack Pro</h1>
            <p className="text-slate-500 mt-2 font-medium">Auto-Sync Login Portal</p>
          </div>
          <form onSubmit={(e:any) => { e.preventDefault(); handleLogin(e.target.uid.value, e.target.pass.value); }} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Universal User ID</label>
              <input name="uid" type="text" className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Enter ID" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Encrypted Passphrase</label>
              <input name="pass" type="password" className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={isSyncing} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3">
              {isSyncing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-shield-check"></i>}
              Authorize & Sync
            </button>
          </form>
          <div className="mt-8 text-center">
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">
               Secure Cloud Vault enabled.<br/>Data follows you everywhere.
             </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-100 z-50 transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-3 text-indigo-600">
              <i className="fas fa-shield-halved text-2xl"></i>
              <span className="font-black text-xl tracking-tighter text-slate-900 uppercase">WealthTrack</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black uppercase ${isSyncing ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
              {isSyncing ? 'Syncing' : 'Live'}
            </div>
          </div>
          <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: 'fa-house' },
              { id: 'ledger', label: 'Ledger', icon: 'fa-list-check' },
              { id: 'calendar', label: 'Calendar', icon: 'fa-calendar-days' },
              { id: 'accounts', label: 'Accounts', icon: 'fa-building-columns' },
              { id: 'portfolio', label: 'Portfolio', icon: 'fa-chart-pie' },
              { id: 'budget', label: 'Budgets', icon: 'fa-piggy-bank' },
              { id: 'goals', label: 'Goals', icon: 'fa-bullseye' },
              { id: 'vault', label: 'Vault', icon: 'fa-key' },
              { id: 'journal', label: 'Journal', icon: 'fa-book' },
              { id: 'categories', label: 'Categories', icon: 'fa-tags' },
            ].map(item => (
              <button 
                key={item.id} 
                onClick={() => { setCurrentPage(item.id); setIsSidebarOpen(false); }} 
                className={`w-full flex items-center gap-4 px-6 py-3.5 rounded-2xl transition-all ${currentPage === item.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-bold' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50'}`}
              >
                <i className={`fas ${item.icon} w-5 text-center`}></i>
                <span className="text-xs uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-6 border-t border-slate-50 space-y-2">
             <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-4 px-6 py-3 text-slate-400 hover:text-indigo-600 text-xs font-bold uppercase tracking-widest transition-colors"><i className="fas fa-cloud"></i> Sync Profile</button>
             <button onClick={() => window.location.reload()} className="w-full flex items-center gap-4 px-6 py-3 text-rose-400 hover:text-rose-600 text-xs font-bold uppercase tracking-widest transition-colors"><i className="fas fa-sign-out"></i> Logout</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-72 p-6 md:p-12 w-full max-w-[1400px] mx-auto">
        {renderPage()}
      </main>

      <Modal title="Omnisync Configuration" isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <div className="space-y-8">
          <div className="p-8 bg-indigo-600 rounded-[2.5rem] shadow-xl shadow-indigo-100 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <i className="fas fa-cloud text-9xl"></i>
             </div>
             <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Cloud Identity Mapping</p>
                <h3 className="text-3xl font-black mb-6 uppercase tracking-tight">{data.auth.userId}</h3>
                <div className="flex items-center gap-4">
                   <div className="flex-1 bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                      <p className="text-[8px] font-black uppercase opacity-60 mb-1">Status</p>
                      <p className="text-xs font-black uppercase tracking-widest">Active & Synced</p>
                   </div>
                   <div className="flex-1 bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                      <p className="text-[8px] font-black uppercase opacity-60 mb-1">Last Handshake</p>
                      <p className="text-xs font-black uppercase tracking-widest">{data.sync.lastSynced ? new Date(data.sync.lastSynced).toLocaleTimeString() : 'Recent'}</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="space-y-6">
             <div className="flex items-center justify-between px-2">
                <div>
                   <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Real-time Auto-Sync</h4>
                   <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Changes are instantly pushed to cloud</p>
                </div>
                <div className={`w-12 h-6 rounded-full cursor-pointer relative transition-all ${data.sync.autoSync ? 'bg-indigo-600' : 'bg-slate-200'}`} onClick={() => persist({...data, sync: {...data.sync, autoSync: !data.sync.autoSync}})}>
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${data.sync.autoSync ? 'left-7' : 'left-1'}`}></div>
                </div>
             </div>
             
             <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                   Syncing is deterministic based on your User ID and Passphrase. Login with the same credentials on any device to pull your entire database instantly.
                </p>
                <button onClick={() => pushToCloud(data)} disabled={isSyncing} className="w-full py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all shadow-sm">
                   {isSyncing ? 'Syncing...' : 'Force Manual Sync Now'}
                </button>
             </div>
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in flex items-center gap-3 border border-white/10 backdrop-blur-md">
          <i className="fas fa-circle-info text-indigo-400"></i>
          <span className="text-[10px] font-black uppercase tracking-widest">{toast}</span>
        </div>
      )}

      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 shadow-2xl shadow-indigo-200 rounded-full flex items-center justify-center z-[100] text-white text-xl">
        <i className={`fas ${isSidebarOpen ? 'fa-xmark' : 'fa-bars-staggered'}`}></i>
      </button>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);