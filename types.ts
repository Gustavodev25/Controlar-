export type TransactionType = 'income' | 'expense';

export interface User {
  name: string;
  email: string;
  avatarUrl?: string;
  baseSalary?: number;
  salaryPaymentDay?: number;
  salaryAdvanceDay?: number;
  salaryAdvancePercent?: number;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  subscription?: {
    plan: 'starter' | 'pro' | 'family';
    status: 'active' | 'canceled' | 'past_due';
    billingCycle: 'monthly' | 'annual';
    nextBillingDate?: string;
  };
}

export interface Member {
  id: string;
  name: string;
  avatarUrl?: string;
  role: 'admin' | 'member';
}

export interface FamilyGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon?: string;
}

export interface Transaction {
  id: string;
  memberId?: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
  status: 'completed' | 'pending';
  // Optional flags
  importSource?: string; // e.g. "pluggy"
  needsApproval?: boolean;
  ignored?: boolean;
  pluggyId?: string;
  pluggyItemId?: string;
}

export interface Reminder {
  id: string;
  memberId?: string;
  description: string;
  amount: number;
  dueDate: string;
  category: string;
  type?: TransactionType;
  isRecurring: boolean;
  frequency?: 'monthly' | 'weekly' | 'yearly';
}

export interface Investment {
  id: string;
  memberId?: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: string;
  deadline?: string;
}

export interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  monthlySavings: number;
}

export interface AIAnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
}

export interface AIParsedTransaction {
  description: string;
  amount: number;
  category: string;
  date: string;
  type: TransactionType;
  installments?: number;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

export interface Budget {
  id: string;
  memberId?: string;
  category: string;
  limitAmount: number;
  month: string;
  alertThreshold: number;
}

export interface ConnectedTransactionPreview {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  category?: string;
  installments?: {
    number?: number;
    total?: number;
  };
  currency?: string;
}

export interface ConnectedAccount {
  id: string;
  itemId: string;
  name: string;
  type?: string;
  subtype?: string;
  institution?: string;
  balance?: number;
  currency?: string;
  lastUpdated?: string;
  previewTransactions?: ConnectedTransactionPreview[];
}

export interface AppNotification {
  id: string;
  type: 'system' | 'alert' | 'update' | 'budget_warning' | 'budget_danger';
  title: string;
  message: string;
  date: string;
  read: boolean;
  archived?: boolean;
}
