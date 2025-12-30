import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// --- E2EE CRYPTO UTILS ---
const cryptoUtils = {
  async hash(str: string) {
    const msgUint8 = new TextEncoder().encode(str + "avin_maurya_v1_salt");
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 24);
  },
  async deriveKey(password: string) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode("avin_maurya_v1_salt"), iterations: 100000, hash: "SHA-256" },
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
    for (let i = 0; i < bytes.length; i++) {
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
      throw new Error("Decryption failed. Data corrupted or incorrect passphrase.");
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
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('avin_maurya_v1_data');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (parsed.auth?.userId) {
          setData(parsed);
        }
      } catch (e) { console.error(e); }
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
      localStorage.setItem('avin_maurya_v1_data', JSON.stringify(cloudData));
      return true;
    } catch (err) {
      console.error("Cloud pull failed", err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const persist = useCallback((newData: AppData) => {
    setData(newData);
    localStorage.setItem('avin_maurya_v1_data', JSON.stringify(newData));
    if (newData.sync.autoSync && isLoggedIn) {
      pushToCloud(newData);
    }
  }, [isLoggedIn]);

  const handleExportVault = () => {
    const exportPackage = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      owner: data.auth.userId,
      payload: data
    };
    const blob = new Blob([JSON.stringify(exportPackage, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AVIN_DATA_${data.auth.userId}_${new Date().toISOString().split('T')[0]}.avindata`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Unique Data File Exported Successfully');
  };

  const handleImportVault = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        const appData = imported.payload || imported; // Handle legacy or new format
        if (!appData.transactions || !appData.accounts || !appData.auth) {
          throw new Error("Invalid AVIN format");
        }
        persist(appData);
        showToast('System Restored from Data File');
      } catch (err) {
        showToast('Error: Invalid AVIN Data File');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAuthorize = async (uid: string, pass: string) => {
    const derivedId = await cryptoUtils.hash(uid + pass);
    
    if (authMode === 'signin') {
      const pulled = await pullFromCloud(derivedId, pass);
      if (pulled) {
        setIsLoggedIn(true);
        showToast('AVIN Identity Verified');
      } else {
        showToast('Profile not found. Initialize new account.');
      }
    } else {
      const newData = { 
        ...INITIAL_DATA, 
        auth: { userId: uid, password: pass }, 
        sync: { ...INITIAL_DATA.sync, syncId: derivedId, lastSynced: new Date().toISOString() } 
      };
      setData(newData);
      setIsLoggedIn(true);
      showToast('Global Profile Initialized');
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
        <div className="absolute top-0 -left-10 w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-10 animate-pulse"></div>
        <div className="absolute bottom-0 -right-10 w-[500px] h-[500px] bg-emerald-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-10 animate-pulse delay-700"></div>
        
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-12 relative z-10 border border-white/20">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-24 h-24 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center text-4xl mb-6 shadow-2xl shadow-indigo-200">
              <i className="fas fa-fingerprint"></i>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">AVIN MAURYA</h1>
            <p className="text-slate-400 mt-2 font-bold text-xs uppercase tracking-widest">Global Data Ledger</p>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
            <button onClick={() => setAuthMode('signin')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'signin' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Authorize</button>
            <button onClick={() => setAuthMode('signup')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'signup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Initialize</button>
          </div>

          <form onSubmit={(e:any) => { e.preventDefault(); handleAuthorize(e.target.uid.value, e.target.pass.value); }} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity ID</label>
              <input name="uid" type="text" className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Unique ID" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secret Key</label>
              <input name="pass" type="password" className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={isSyncing} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3">
              {isSyncing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-shield-halved"></i>}
              {authMode === 'signin' ? 'Unlock Session' : 'Create Global Identity'}
            </button>
          </form>

          <div className="mt-8 text-center">
             <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
               <i className="fas fa-file-import mr-2"></i> Restore from Data File
             </button>
             <input ref={fileInputRef} type="file" accept=".avindata,.json" onChange={handleImportVault} className="hidden" />
          </div>

          <div className="mt-10 pt-8 border-t border-slate-50 text-center">
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">
               Military-Grade AES-256 Encryption.<br/>AVIN MAURYA protects your sovereignty.
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
              <i className="fas fa-dna text-2xl"></i>
              <span className="font-black text-xl tracking-tighter text-slate-900 uppercase">AVIN MAURYA</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black uppercase ${isSyncing ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
              {isSyncing ? 'Syncing' : 'Global'}
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
             <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-4 px-6 py-3 text-slate-400 hover:text-indigo-600 text-xs font-bold uppercase tracking-widest transition-colors"><i className="fas fa-file-export"></i> Portability</button>
             <button onClick={() => window.location.reload()} className="w-full flex items-center gap-4 px-6 py-3 text-rose-400 hover:text-rose-600 text-xs font-bold uppercase tracking-widest transition-colors"><i className="fas fa-power-off"></i> Logout</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-72 p-6 md:p-12 w-full max-w-[1400px] mx-auto">
        {renderPage()}
      </main>

      <Modal title="AVIN Master Portability" isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <div className="space-y-8">
          <div className="p-8 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-[2.5rem] shadow-xl shadow-indigo-100 text-white relative overflow-hidden">
             <div className="absolute -top-10 -right-10 opacity-10">
                <i className="fas fa-file-zipper text-[12rem]"></i>
             </div>
             <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Authenticated Owner</p>
                <h3 className="text-3xl font-black mb-6 uppercase tracking-tight">{data.auth.userId}</h3>
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                      <p className="text-[8px] font-black uppercase opacity-60 mb-1">Global ID</p>
                      <p className="text-xs font-black uppercase tracking-widest truncate">{data.sync.syncId}</p>
                   </div>
                   <div className={`bg-white/10 p-4 rounded-2xl backdrop-blur-md`}>
                      <p className="text-[8px] font-black uppercase opacity-60 mb-1">System Health</p>
                      <p className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full bg-emerald-400`}></div> Active & Secure
                      </p>
                   </div>
                </div>
             </div>
          </div>

          <div className="space-y-6">
             <div className="flex items-center justify-between px-2">
                <div>
                   <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Real-Time Cloud Link</h4>
                   <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Automatic sync to AVIN Global nodes</p>
                </div>
                <div className={`w-12 h-6 rounded-full cursor-pointer relative transition-all ${data.sync.autoSync ? 'bg-indigo-600' : 'bg-slate-200'}`} onClick={() => persist({...data, sync: {...data.sync, autoSync: !data.sync.autoSync}})}>
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${data.sync.autoSync ? 'left-7' : 'left-1'}`}></div>
                </div>
             </div>
             
             <div className="pt-8 border-t border-slate-100">
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest px-2 mb-6 flex items-center gap-2">
                   <i className="fas fa-file-shield text-indigo-500"></i> Master Data Engine
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <button onClick={handleExportVault} className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] text-center hover:bg-slate-100 transition-all group">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                        <i className="fas fa-file-export"></i>
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-900 mb-1">Export .avindata</p>
                      <p className="text-[9px] font-bold uppercase text-slate-400">Unique Portable Data File</p>
                   </button>
                   
                   <button onClick={() => fileInputRef.current?.click()} className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] text-center hover:bg-slate-100 transition-all group">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                        <i className="fas fa-file-import"></i>
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-900 mb-1">Import .avindata</p>
                      <p className="text-[9px] font-bold uppercase text-slate-400">Restore Unique File</p>
                   </button>
                </div>
                <p className="mt-6 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest px-8 leading-relaxed">
                  The .avindata file is your private digital asset. It contains your entire AVIN MAURYA ecosystem in a single, portable package.
                </p>
             </div>
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in flex items-center gap-3 border border-white/10">
          <i className="fas fa-check-circle text-emerald-400"></i>
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