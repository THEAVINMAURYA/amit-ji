
import React, { useState, useMemo } from 'react';
import { AppData, Account, AccountType, TransactionType, Transaction } from '../types';
import Modal from '../components/Modal';

interface AccountsPageProps {
  data: AppData;
  onSave: (newData: AppData) => void;
  showToast: (msg: string) => void;
}

const AccountsPage: React.FC<AccountsPageProps> = ({ data, onSave, showToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);
  const [viewingLedgerAcc, setViewingLedgerAcc] = useState<Account | null>(null);

  const openAdd = () => {
    setEditingAccount({
      id: Date.now().toString(),
      name: '',
      bankName: '',
      accountNumber: '',
      balance: 0,
      openingBalance: 0,
      type: AccountType.BANK
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingAccount?.name) return;
    const newList = [...data.accounts];
    const index = newList.findIndex(a => a.id === editingAccount.id);
    
    if (index >= 0) {
      const accTransactions = data.transactions.filter(t => t.account === editingAccount.id);
      const newBalance = (editingAccount.openingBalance || 0) + accTransactions.reduce((sum, t) => 
        t.type === TransactionType.INCOME ? sum + t.amount : sum - t.amount, 0
      );
      newList[index] = { ...editingAccount as Account, balance: newBalance };
    } else {
      newList.push({ ...editingAccount as Account, balance: editingAccount.openingBalance || 0 });
    }

    onSave({ ...data, accounts: newList });
    setIsModalOpen(false);
    showToast('Account Synced');
  };

  const deleteAccount = (id: string) => {
    if (id === 'cash-default') return showToast('Cannot delete default cash');
    if (confirm('Warning: Deleting an account will orphan all its transactions. Proceed?')) {
      onSave({ ...data, accounts: data.accounts.filter(a => a.id !== id) });
      showToast('Account Removed');
    }
  };

  const accountLedgerData = useMemo(() => {
    if (!viewingLedgerAcc) return [];
    
    const accTransactions = data.transactions
      .filter(t => t.account === viewingLedgerAcc.id)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.id.localeCompare(b.id);
      });

    let currentRunningBalance = viewingLedgerAcc.openingBalance || 0;
    
    return accTransactions.map(t => {
      if (t.type === TransactionType.INCOME) {
        currentRunningBalance += t.amount;
      } else {
        currentRunningBalance -= t.amount;
      }
      return {
        ...t,
        runningBalance: currentRunningBalance
      };
    }).reverse(); 
  }, [viewingLedgerAcc, data.transactions]);

  const exportAccountLedgerCSV = (acc: Account, ledger: any[]) => {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Running Balance'];
    const rows = ledger.map(l => [
      l.date, l.description, l.category, l.type.toUpperCase(), l.amount, l.runningBalance
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${acc.name}_ledger_${acc.type}.csv`);
    link.click();
    showToast('Ledger Exported');
  };

  return (
    <div className="space-y-8 animate-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Liquidity Command</h1>
          <p className="text-slate-500 font-medium text-lg mt-1">Full transparency for Bank, Cash, and Loan accounts.</p>
        </div>
        <button onClick={openAdd} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 flex items-center gap-3 hover:scale-105 transition-all">
          <i className="fas fa-plus"></i> Add Account
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {data.accounts.map((acc) => (
          <div key={acc.id} className={`bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all border-b-4 ${acc.type === AccountType.LOAN ? 'border-b-rose-500' : 'border-b-indigo-500'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl ${acc.type === AccountType.BANK ? 'bg-indigo-50 text-indigo-600' : acc.type === AccountType.CASH ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <i className={`fas ${acc.type === AccountType.BANK ? 'fa-university' : acc.type === AccountType.CASH ? 'fa-wallet' : 'fa-hand-holding-dollar'}`}></i>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setViewingLedgerAcc(acc)} className="p-2 text-indigo-600 font-bold bg-indigo-50 rounded-xl text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-colors">Ledger</button>
                <button onClick={() => { setEditingAccount(acc); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600"><i className="fas fa-edit"></i></button>
                <button onClick={() => deleteAccount(acc.id)} className="p-2 text-slate-300 hover:text-rose-500"><i className="fas fa-trash-alt"></i></button>
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">{acc.name}</h3>
            <div className="flex items-center gap-2 mb-6">
               <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${acc.type === AccountType.LOAN ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                 {acc.type}
               </span>
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{acc.bankName || 'Direct Reserves'}</span>
            </div>
            <div className="pt-4 border-t border-slate-50 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Position</p>
                <p className={`text-3xl font-black ${acc.balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>₹{acc.balance.toLocaleString('en-IN')}</p>
              </div>
              {acc.type === AccountType.LOAN && (
                <div className="text-right">
                  <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Debt Obligation</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal 
        title={`Account Ledger: ${viewingLedgerAcc?.name}`} 
        isOpen={!!viewingLedgerAcc} 
        onClose={() => setViewingLedgerAcc(null)}
        maxWidth="max-w-5xl"
      >
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Opening Balance</p>
                <p className="text-xl font-black text-slate-800">₹{viewingLedgerAcc?.openingBalance?.toLocaleString()}</p>
             </div>
             <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</p>
                <p className={`text-2xl font-black ${viewingLedgerAcc && viewingLedgerAcc.balance < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>₹{viewingLedgerAcc?.balance.toLocaleString()}</p>
             </div>
             <button 
                onClick={() => viewingLedgerAcc && exportAccountLedgerCSV(viewingLedgerAcc, accountLedgerData)}
                className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-100"
              >
               <i className="fas fa-download mr-2"></i> Export CSV
             </button>
          </div>

          <div className="overflow-hidden border border-slate-100 rounded-[2rem]">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Inflow</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Outflow</th>
                  <th className="px-6 py-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right">Running Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {accountLedgerData.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-[11px] font-bold text-slate-400">{t.date}</td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-slate-800">{t.description}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{t.category}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {t.type === TransactionType.INCOME ? (
                        <span className="text-xs font-black text-emerald-500">+₹{t.amount.toLocaleString()}</span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {t.type === TransactionType.EXPENSE ? (
                        <span className="text-xs font-black text-rose-500">-₹{t.amount.toLocaleString()}</span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-xs font-black ${t.runningBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>₹{t.runningBalance.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50/50">
                   <td className="px-6 py-4 text-[10px] font-black text-slate-400 italic" colSpan={4}>OPENING BALANCE RECORD</td>
                   <td className="px-6 py-4 text-right font-black text-slate-400 text-xs">₹{viewingLedgerAcc?.openingBalance?.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal title="Configure Account" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Label</label>
              <input placeholder="e.g. ICICI Savings, Personal Loan" value={editingAccount?.name} onChange={e => setEditingAccount({...editingAccount!, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold focus:ring-2 focus:ring-indigo-500" />
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Institution</label>
                <input placeholder="Bank Name" value={editingAccount?.bankName} onChange={e => setEditingAccount({...editingAccount!, bankName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                <select value={editingAccount?.type} onChange={e => setEditingAccount({...editingAccount!, type: e.target.value as AccountType})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold">
                  <option value={AccountType.BANK}>Bank Account</option>
                  <option value={AccountType.CASH}>Cash / Wallet</option>
                  <option value={AccountType.LOAN}>Loan / Liability</option>
                </select>
              </div>
           </div>
           <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opening Balance (₹)</label>
              <input type="number" placeholder="0.00" value={editingAccount?.openingBalance} onChange={e => setEditingAccount({...editingAccount!, openingBalance: parseFloat(e.target.value) || 0})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-0 font-bold" />
           </div>
           <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl mt-4 hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs">Verify & Synchronize</button>
        </div>
      </Modal>
    </div>
  );
};

export default AccountsPage;
