
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
  auth: { userId: 'A', password: 'A' },
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

const App: React.FC = () => {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('wt_pro_elite_v12');
    if (saved) {
      try { setData(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  const persist = useCallback((newData: AppData) => {
    setData(newData);
    localStorage.setItem('wt_pro_elite_v12', JSON.stringify(newData));
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (uid: string, pass: string) => {
    if (uid === data.auth.userId && pass === data.auth.password) {
      setIsLoggedIn(true);
      showToast('Session Authorized');
    } else {
      showToast('Authorization Failed');
    }
  };

  // Global Page Router
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
        <div className="absolute top-0 -left-10 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-20"></div>
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-12 relative z-10">
          <div className="flex flex-col items-center mb-12 text-center">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center text-3xl mb-6 shadow-xl shadow-indigo-200">
              <i className="fas fa-vault"></i>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">WealthTrack Pro</h1>
            <p className="text-slate-500 mt-2 font-medium">Secure Access Terminal</p>
          </div>
          <form onSubmit={(e:any) => { e.preventDefault(); handleLogin(e.target.uid.value, e.target.pass.value); }} className="space-y-6">
            <input name="uid" type="text" className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl font-bold" placeholder="User ID" required />
            <input name="pass" type="password" className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl font-bold" placeholder="Password" required />
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs">Login</button>
          </form>
          <p className="mt-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Default Keys: A / A</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-100 z-50 transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-8">
            <div className="flex items-center gap-3 text-indigo-600">
              <i className="fas fa-shield-halved text-2xl"></i>
              <span className="font-black text-xl tracking-tighter text-slate-900 uppercase">WealthTrack</span>
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
          <div className="p-6 border-t border-slate-50">
             <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-4 px-6 py-3 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest"><i className="fas fa-cog"></i> Configuration</button>
             <button onClick={() => window.location.reload()} className="w-full flex items-center gap-4 px-6 py-3 text-rose-400 hover:text-rose-600 text-xs font-bold uppercase tracking-widest"><i className="fas fa-sign-out"></i> Logout</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-72 p-6 md:p-12 w-full max-w-[1400px] mx-auto">
        {renderPage()}
      </main>

      <Modal title="System Configuration" isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Operator ID</label>
            <input type="text" value={data.auth.userId} onChange={(e) => persist({...data, auth: {...data.auth, userId: e.target.value}})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Passphrase</label>
            <input type="password" value={data.auth.password} onChange={(e) => persist({...data, auth: {...data.auth, password: e.target.value}})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold" />
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in flex items-center gap-3">
          <i className="fas fa-circle-info text-indigo-400"></i>
          <span className="text-[10px] font-black uppercase tracking-widest">{toast}</span>
        </div>
      )}

      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden fixed top-6 right-6 w-12 h-12 bg-white shadow-xl rounded-2xl flex items-center justify-center z-[100] text-indigo-600">
        <i className={`fas ${isSidebarOpen ? 'fa-xmark' : 'fa-bars-staggered'}`}></i>
      </button>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
