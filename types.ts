
export enum TransactionType { INCOME = 'income', EXPENSE = 'expense' }
export enum AccountType { BANK = 'bank', LOAN = 'loan', CASH = 'cash' }

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  description: string;
  category: string;
  account: string; // Account ID
  amount: number;
  notes: string;
}

export interface Account {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  balance: number;
  type: AccountType;
  openingBalance: number;
}

export interface Budget {
  id: string;
  month: string;
  category: string;
  limit: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline?: string;
}

export interface InvestmentTrade {
  id: string;
  date: string;
  type: 'buy' | 'sell';
  qty: number;
  price: number;
  charges: number;
}

export interface Investment {
  id: string;
  name: string;
  assetType: 'Stock' | 'MF' | 'Gold' | 'Crypto' | 'FD' | 'Real Estate' | 'Other';
  qty: number;
  avgBuyPrice: number;
  currPrice: number;
  history: InvestmentTrade[];
  status: 'active' | 'closed';
  totalRealizedPL: number;
}

export interface CredentialItem {
  label: string;
  user: string;
  pass: string;
  link: string;
}

export interface Credential {
  id: string;
  clientName: string;
  email: string;
  items: CredentialItem[];
}

export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  photos: string[]; // Base64 strings
}

export interface AppData {
  auth: { userId: string; password: string };
  sync: {
    syncId: string;
    autoSync: boolean;
    lastSynced: string;
  };
  transactions: Transaction[];
  accounts: Account[];
  credentials: Credential[];
  categories: { income: string[]; expense: string[] };
  journal: JournalEntry[];
  budgets: Budget[];
  goals: Goal[];
  investments: Investment[];
}
