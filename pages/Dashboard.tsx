
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AppData, TransactionType } from '../types';

const Dashboard: React.FC<{ data: AppData; onNavigate: (p: string) => void }> = ({ data, onNavigate }) => {
  const stats = useMemo(() => {
    const income = data.transactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const expense = data.transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    const savings = Math.max(0, income - expense);
    return { income, expense, balance: income - expense, savings };
  }, [data.transactions]);

  const recent = data.transactions.slice(0, 10);

  return (
    <div className="space-y-8 animate-in">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Command Center</h1>
          <p className="text-slate-400 font-medium">Global Liquidity Status</p>
        </div>
        <button onClick={() => onNavigate('ledger')} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 flex items-center gap-2 text-xs uppercase tracking-widest hover:scale-105 transition-all">
          <i className="fas fa-plus"></i> Add Entry
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 border-b-4 border-b-indigo-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Balance</p>
          <p className="text-3xl font-black text-slate-900">₹{stats.balance.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 border-b-4 border-b-emerald-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inflow</p>
          <p className="text-3xl font-black text-slate-900">₹{stats.income.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 border-b-4 border-b-rose-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Outflow</p>
          <p className="text-3xl font-black text-slate-900">₹{stats.expense.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 border-b-4 border-b-amber-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Savings</p>
          <p className="text-3xl font-black text-slate-900">₹{stats.savings.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <h3 className="text-lg font-black text-slate-800 mb-8 uppercase tracking-widest flex items-center gap-3">
          <i className="fas fa-clock-rotate-left text-indigo-500"></i> Recent Activity
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Context</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recent.map(t => (
                <tr key={t.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="py-4 text-xs font-bold text-slate-400">{t.date}</td>
                  <td className="py-4">
                    <p className="text-sm font-black text-slate-800">{t.description}</p>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t.category}</p>
                  </td>
                  <td className={`py-4 text-right font-black ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ₹{t.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={3} className="py-20 text-center text-slate-300 uppercase font-black tracking-widest text-xs">No records available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
