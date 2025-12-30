
import React, { useState, useMemo } from 'react';
import { AppData, Transaction, TransactionType } from '../types';
import Modal from '../components/Modal';

const LedgerPage: React.FC<{ data: AppData; onSave: (d: AppData) => void; showToast: (m: string) => void }> = ({ data, onSave, showToast }) => {
  const [filter, setFilter] = useState<TransactionType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Transaction> | null>(null);

  const filtered = useMemo(() => {
    return data.transactions
      .filter(t => (filter === 'all' || t.type === filter))
      .filter(t => t.description.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()))
      .sort((a,b) => b.date.localeCompare(a.date));
  }, [data.transactions, filter, search]);

  const deleteTransaction = (id: string) => {
    if (!confirm('Reversing this transaction will restore previous balances. Proceed?')) return;
    const trans = data.transactions.find(t => t.id === id);
    if (!trans) return;

    const accounts = [...data.accounts];
    const accIdx = accounts.findIndex(a => a.id === trans.account);
    if (accIdx >= 0) {
      if (trans.type === TransactionType.INCOME) accounts[accIdx].balance -= trans.amount;
      else accounts[accIdx].balance += trans.amount;
    }

    onSave({ ...data, transactions: data.transactions.filter(t => t.id !== id), accounts });
    showToast('Transaction Voided');
  };

  const handleSave = () => {
    if (!editing?.description || !editing?.amount) return;
    const trans: Transaction = {
      id: editing.id || Date.now().toString(),
      type: editing.type!,
      date: editing.date!,
      description: editing.description!,
      category: editing.category!,
      amount: editing.amount!,
      account: editing.account!,
      notes: editing.notes || ''
    };
    
    let newList = [...data.transactions];
    const idx = newList.findIndex(n => n.id === trans.id);
    
    // Balance reconciliation
    const accounts = [...data.accounts];
    const accIdx = accounts.findIndex(a => a.id === trans.account);
    
    if (idx >= 0) {
      const oldTrans = newList[idx];
      // Revert old
      if (oldTrans.type === TransactionType.INCOME) accounts[accIdx].balance -= oldTrans.amount;
      else accounts[accIdx].balance += oldTrans.amount;
      // Apply new
      if (trans.type === TransactionType.INCOME) accounts[accIdx].balance += trans.amount;
      else accounts[accIdx].balance -= trans.amount;
      newList[idx] = trans;
    } else {
      if (accIdx >= 0) {
        if (trans.type === TransactionType.INCOME) accounts[accIdx].balance += trans.amount;
        else accounts[accIdx].balance -= trans.amount;
      }
      newList.unshift(trans);
    }

    onSave({ ...data, transactions: newList, accounts });
    setIsModalOpen(false);
    showToast('Record Updated & Synchronized');
  };

  return (
    <div className="space-y-8 animate-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Universal Ledger</h1>
          <p className="text-slate-400 font-medium">Verified double-entry financial accounting.</p>
        </div>
        <button onClick={() => { setEditing({ id: '', type: TransactionType.EXPENSE, date: new Date().toISOString().split('T')[0], amount: 0, description: '', category: data.categories.expense[0], account: data.accounts[0].id }); setIsModalOpen(true); }} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all">
          <i className="fas fa-plus mr-2"></i> New Entry
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold shadow-sm" />
        </div>
        <div className="flex bg-white border border-slate-100 p-1 rounded-2xl shadow-sm">
           {['all', TransactionType.INCOME, TransactionType.EXPENSE].map(t => (
             <button key={t} onClick={() => setFilter(t as any)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === t ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{t}</button>
           ))}
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Date</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Context</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valuation</th>
              <th className="px-8 py-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(t => (
              <tr key={t.id} className="group hover:bg-slate-50/50 transition-all">
                <td className="px-8 py-6 text-xs font-bold text-slate-400">{t.date}</td>
                <td className="px-8 py-6">
                  <p className="text-sm font-black text-slate-800">{t.description}</p>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t.category}</p>
                </td>
                <td className={`px-8 py-6 text-right font-black ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {t.type === TransactionType.INCOME ? '+' : '-'} ₹{t.amount.toLocaleString()}
                </td>
                <td className="px-8 py-6 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => { setEditing(t); setIsModalOpen(true); }} className="text-slate-300 hover:text-indigo-600"><i className="fas fa-edit"></i></button>
                    <button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-trash-alt"></i></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Record Configuration" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-6">
           <div className="flex bg-slate-100 p-1 rounded-2xl">
              {['income', 'expense'].map(t => (
                <button key={t} onClick={() => setEditing({...editing!, type: t as any, category: data.categories[t as 'income'|'expense'][0]})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editing?.type === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>
              ))}
           </div>
           <div className="grid grid-cols-2 gap-4">
              <input type="date" value={editing?.date} onChange={e => setEditing({...editing!, date: e.target.value})} className="bg-slate-50 p-4 rounded-2xl font-bold border-0" />
              <input type="number" placeholder="Value" value={editing?.amount || ''} onChange={e => setEditing({...editing!, amount: parseFloat(e.target.value) || 0})} className="bg-slate-50 p-4 rounded-2xl font-bold border-0" />
           </div>
           <input placeholder="Description..." value={editing?.description} onChange={e => setEditing({...editing!, description: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-0" />
           <div className="grid grid-cols-2 gap-4">
              <select value={editing?.category} onChange={e => setEditing({...editing!, category: e.target.value})} className="bg-slate-50 p-4 rounded-2xl font-bold border-0">
                {(editing?.type === TransactionType.INCOME ? data.categories.income : data.categories.expense).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={editing?.account} onChange={e => setEditing({...editing!, account: e.target.value})} className="bg-slate-50 p-4 rounded-2xl font-bold border-0">
                {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
           </div>
           <button onClick={handleSave} className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-xl">Synchronize Entry</button>
        </div>
      </Modal>
    </div>
  );
};

export default LedgerPage;
