export type TransactionType = 'income' | 'expense';

export interface User {
  name: string;
  email: string;
  avatarUrl?: string;
  baseSalary?: number;
  salaryPaymentDay?: number;
  salaryAdvanceDay?: number;
  salaryAdvancePercent?: number;
  salaryAdvanceValue?: number;
  valeDeductions?: { id: string; name: string; value: string; type: '%' | 'R$' }[];
  valeExemptFromDiscounts?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  subscription?: {
    plan: 'starter' | 'pro' | 'family';
    status: 'active' | 'canceled' | 'past_due';
    billingCycle: 'monthly' | 'annual';
    nextBillingDate?: string;
  };
  paymentMethodDetails?: {
    last4: string;
    holder: string;
    expiry: string;
    brand?: string;
  };
  familyGroupId?: string;
  familyRole?: 'owner' | 'member';
  isAdmin?: boolean;
}

export interface FamilyGroup {
  id: string;
  ownerId: string;
  plan: 'pro' | 'family';
  members: string[]; // User IDs
  invites: {
    token: string;
    createdAt: string;
    status: 'pending' | 'accepted';
    email?: string;
  }[];
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

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  status: 'active' | 'canceled';
  lastPaymentDate?: string;
  category: string;
  provider?: string;
}

export interface WaitlistEntry {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  goal?: string;
  source?: string;
  createdAt: string;
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
  importSource?: string; // e.g. "klavi", "pluggy" - identifies auto-imported transactions
  needsApproval?: boolean;
  ignored?: boolean;
  isSubscription?: boolean;
  providerId?: string; // e.g. "klavi" - legacy field, importSource preferred
  providerItemId?: string;
  accountId?: string;
  accountType?: string; // 'CHECKING_ACCOUNT', 'CREDIT_CARD', 'SAVINGS_ACCOUNT'
  isInvestment?: boolean;
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
  creditCardSpending?: number;
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

export interface ProviderBill {
  id: string;
  dueDate: string;
  totalAmount: number;
  balanceCloseDate: string;
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
  creditLimit?: number;
  availableCreditLimit?: number;
  brand?: string;
  balanceCloseDate?: string;
  balanceDueDate?: string;
  minimumPayment?: number;
  bills?: ProviderBill[];
  connectionMode?: 'AUTO' | 'MANUAL';
  initialBalance?: number;
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
