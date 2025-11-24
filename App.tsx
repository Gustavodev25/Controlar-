
import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Table2,
  Bot,
  ChevronLeft,
  ChevronRight,
  Bell,
  TrendingUp,
  BrainCircuit,
  Plus,
  Calendar,
  Filter,
  Tag,
  X,
  RotateCcw,
  Menu,
  Target,
  Building
} from './components/Icons';
import { Transaction, DashboardStats, User, Reminder, Member, FamilyGoal, Budget, ConnectedAccount } from './types';
import { StatsCards } from './components/StatsCards';
import { ExcelTable } from './components/ExcelTable';
import { AIModal } from './components/AIModal';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { UserMenu } from './components/UserMenu';
import { SettingsModal } from './components/SettingsModal';
import { DashboardCharts } from './components/Charts';
import { Reminders } from './components/Reminders';
import { SalaryManager } from './components/SalaryManager';
import { AIAdvisor } from './components/AIAdvisor';
import { Investments, Investment } from './components/Investments';
import { Budgets } from './components/Budgets';
import { MemberSelector } from './components/MemberSelector';
import { FamilyDashboard } from './components/FamilyDashboard';
import { ToastContainer, useToasts } from './components/Toast';
import { TwoFactorPrompt } from './components/TwoFactorPrompt';
import { auth } from './services/firebase';
import { onAuthStateChanged } from "firebase/auth";
import * as dbService from './services/database';
import { verifyTOTP } from './services/twoFactor';
import { CustomSelect, CustomMonthPicker } from './components/UIComponents';
import { NotificationCenter, SystemNotification } from './components/NotificationCenter';
import { Logo } from './components/Logo';
import { AIChatAssistant } from './components/AIChatAssistant';
import { BankConnect } from './components/BankConnect';
import { ConnectedAccounts } from './components/ConnectedAccounts';
import { fetchPluggyAccounts, syncPluggyData } from './services/pluggyService';

// Sub-component for Nav Items
interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isOpen: boolean;
  badge?: number;
  disabled?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ active, onClick, icon, label, isOpen, badge, disabled }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 group relative
        ${active
          ? 'bg-gray-800 text-white shadow-sm'
          : disabled
            ? 'text-gray-600 cursor-not-allowed opacity-50'
            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
        }
        ${!isOpen && 'justify-center'}
      `}
    >
      <span className={`transition-colors ${active ? 'text-[#d97757]' : 'text-gray-500 group-hover:text-gray-300'}`}>
        {icon}
      </span>

      {isOpen && <span className="font-medium text-sm truncate animate-fade-in">{label}</span>}

      {/* Badge */}
      {(badge || 0) > 0 && (
        <span className={`absolute ${isOpen ? 'right-2 top-1/2 -translate-y-1/2' : 'top-1 right-1'} flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white`}>
          {badge && badge > 9 ? '9+' : badge}
        </span>
      )}

      {/* Active Indicator (Collapsed) */}
      {!isOpen && active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#d97757] rounded-r-full"></div>
      )}

      {/* Tooltip Card (Collapsed Only) */}
      {!isOpen && isHovered && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 z-50 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-3 min-w-[140px] text-left animate-fade-in">
          <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-b border-gray-800 rotate-45"></div>
          <p className="text-sm font-bold text-white whitespace-nowrap">{label}</p>
        </div>
      )}
    </button>
  );
};

type FilterMode = 'month' | 'year' | 'last3' | 'last6' | 'all';

interface PendingTwoFactor {
  uid: string;
  email: string;
  name: string;
  profile: Partial<User>;
  secret: string;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [pendingTwoFactor, setPendingTwoFactor] = useState<PendingTwoFactor | null>(null);
  const [isVerifyingTwoFactor, setIsVerifyingTwoFactor] = useState(false);
  const toast = useToasts();

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'table' | 'reminders' | 'investments' | 'advisor' | 'budgets' | 'connections'>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(() => {
    // Check if mobile on initial load
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    if (!isDesktop) return false; // Always start closed on mobile

    const saved = localStorage.getItem('finances_sidebar_open');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Landing Page State
  const [showLanding, setShowLanding] = useState(true);

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [familyGoals, setFamilyGoals] = useState<FamilyGoal[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [pluggyAccounts, setPluggyAccounts] = useState<ConnectedAccount[]>([]);
  const [pluggyItemIds, setPluggyItemIds] = useState<string[]>([]);
  const [loadingPluggyAccounts, setLoadingPluggyAccounts] = useState(false);
  const [pluggyLastSync, setPluggyLastSync] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);

  // Dashboard Filter State
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [dashboardCategory, setDashboardCategory] = useState<string>(''); // New Category Filter
  const [dashboardDate, setDashboardDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dashboardYear, setDashboardYear] = useState<number>(new Date().getFullYear());

  // Member Management State
  const [activeMemberId, setActiveMemberId] = useState<string | 'FAMILY_OVERVIEW'>('FAMILY_OVERVIEW');

  // Modals State
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  const syncMemberId = useMemo(() => {
    if (activeMemberId !== 'FAMILY_OVERVIEW') return activeMemberId;
    return members.find(m => m.role === 'admin')?.id || members[0]?.id;
  }, [activeMemberId, members]);

  const pluggyStorageKey = (uid: string) => `pluggy_items_${uid}`;
  const pluggyAccountsKey = (uid: string) => `pluggy_accounts_${uid}`;

  const refreshPluggyAccounts = async (itemIds: string[]) => {
    if (!itemIds.length) {
      setPluggyAccounts([]);
      return;
    }
    toast.message({ text: "Conectando ao Open Finance...", preserve: true });
    setLoadingPluggyAccounts(true);
    try {
      const results = await Promise.all(itemIds.map(id => fetchPluggyAccounts(id).catch(() => [])));
      const flattened = results.flat();
      const seen = new Set<string>();
      const unique = flattened.filter(acc => {
        if (seen.has(acc.id)) return false;
        seen.add(acc.id);
        return true;
      });
      setPluggyAccounts(unique);
      if (userId) {
        localStorage.setItem(pluggyAccountsKey(userId), JSON.stringify(unique));
      }
    } catch (err) {
      console.error("Erro ao atualizar contas Pluggy:", err);
    } finally {
      setLoadingPluggyAccounts(false);
    }
  };

  const handlePluggyItemConnected = (itemId: string) => {
    if (!userId) return;
    const next = Array.from(new Set([...pluggyItemIds, itemId]));
    setPluggyItemIds(next);
    localStorage.setItem(pluggyStorageKey(userId), JSON.stringify(next));
    refreshPluggyAccounts(next);
  };

  const handleImportAccount = async (account: ConnectedAccount) => {
    if (!userId) {
      toast.error("Precisa estar logado para salvar lancamentos.");
      return 0;
    }
    try {
      const count = await syncPluggyData(userId, account.itemId, syncMemberId);
      if (count === 0) {
        toast.message({ text: "Nenhuma transacao nova. Ja estava sincronizado." });
      } else {
        toast.success(`${count} lancamentos salvos a partir de ${account.name}.`);
      }
      setPluggyLastSync(prev => ({ ...prev, [account.id]: new Date().toISOString() }));
      // Registrar notificacao para revisao (persistente)
      await dbService.addNotification(userId, {
        type: 'update',
        title: 'Revisar lançamentos importados',
        message: count === 0
          ? `Nenhum lançamento novo de ${account.name}, já sincronizado.`
          : `${count} lançamentos importados de ${account.name}. Revise e confirme.`,
        date: new Date().toISOString().split('T')[0],
        read: false,
        archived: false
      });
      return count;
    } catch (err) {
      console.error("Erro ao importar conta Pluggy:", err);
      toast.error("Nao foi possivel salvar os lancamentos dessa conta.");
      return 0;
    }
  };

  const handleArchiveNotification = async (id: string) => {
    if (!userId) return;
    const note = notifications.find(n => n.id === id);
    if (!note) return;
    await dbService.updateNotification(userId, { ...note, archived: true });
  };

  const handleDeleteNotification = async (id: string) => {
    if (!userId) return;
    await dbService.deleteNotification(userId, id);
  };

  const handleMarkReadNotification = async (id: string) => {
    if (!userId) return;
    const note = notifications.find(n => n.id === id);
    if (!note) return;
    await dbService.updateNotification(userId, { ...note, read: true });
  };

  useEffect(() => {
    localStorage.setItem('finances_sidebar_open', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!userId) {
      setPluggyItemIds([]);
      setPluggyAccounts([]);
      return;
    }
    try {
      const storedRaw = localStorage.getItem(pluggyStorageKey(userId));
      const stored = storedRaw ? JSON.parse(storedRaw) : [];
      setPluggyItemIds(stored);
      const cachedAccountsRaw = localStorage.getItem(pluggyAccountsKey(userId));
      if (cachedAccountsRaw) {
        try {
          const cachedParsed = JSON.parse(cachedAccountsRaw);
          setPluggyAccounts(cachedParsed || []);
        } catch {
          setPluggyAccounts([]);
        }
      } else {
        setPluggyAccounts([]);
      }
      if (stored.length) {
        refreshPluggyAccounts(stored);
      } else {
        setPluggyAccounts([]);
      }
    } catch (err) {
      console.warn("Nao foi possivel carregar contas Pluggy salvas:", err);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    const unsub = dbService.listenToNotifications(userId, (items) => {
      setNotifications(items as SystemNotification[]);
    });
    return () => unsub();
  }, [userId]);

  // Authentication Listener
  useEffect(() => {
    if (!auth) {
      toast.error("Firebase Auth não inicializado.");
      setIsLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
        setShowLanding(false); // Hide landing if user is logged in

        try {
          const profile = await dbService.getUserProfile(firebaseUser.uid);
          const baseProfile: User = {
            name: firebaseUser.displayName || profile?.name || 'Usuário',
            email: firebaseUser.email || '',
            baseSalary: profile?.baseSalary || 0,
            avatarUrl: profile?.avatarUrl,
            twoFactorEnabled: profile?.twoFactorEnabled,
            twoFactorSecret: profile?.twoFactorSecret
          };

          if (profile?.twoFactorEnabled && profile?.twoFactorSecret) {
            setPendingTwoFactor({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: baseProfile.name,
              profile: profile,
              secret: profile.twoFactorSecret
            });
            setCurrentUser(null);
            setUserId(null);
            setIsLoadingData(false);
            setIsLoadingAuth(false);
            return;
          }

          setPendingTwoFactor(null);
          setUserId(firebaseUser.uid);
          setIsLoadingData(true);
          setCurrentUser(baseProfile);
        } catch (err) {
          console.error("Erro ao carregar perfil:", err);
          toast.warning("Não foi possível carregar o perfil (offline). Dados locais serão usados.");
          setPendingTwoFactor(null);
          setUserId(firebaseUser.uid);
          setIsLoadingData(true);
          setCurrentUser({
            name: firebaseUser.displayName || 'Usuário',
            email: firebaseUser.email || '',
            baseSalary: 0
          });
        }
      } else {
        setPendingTwoFactor(null);
        setUserId(null);
        setCurrentUser(null);
        setTransactions([]);
        setReminders([]);
        setMembers([]);
        setBudgets([]);
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-close sidebar on mobile, auto-open on desktop (on resize only)
  useEffect(() => {
    let lastWidth = window.innerWidth;

    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const wasDesktop = lastWidth >= 1024;
      const isDesktop = currentWidth >= 1024;

      // Only act when crossing the desktop/mobile boundary
      if (wasDesktop !== isDesktop) {
        if (!isDesktop) {
          // Switched to mobile - close sidebar
          setSidebarOpen(false);
        } else {
          // Switched to desktop - open sidebar based on preference
          const saved = localStorage.getItem('finances_sidebar_open');
          const shouldBeOpen = saved !== null ? JSON.parse(saved) : true;
          if (shouldBeOpen) {
            setSidebarOpen(true);
          }
        }
      }

      lastWidth = currentWidth;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!userId) return;

    const unsubTx = dbService.listenToTransactions(userId, (data) => {
      setTransactions(data);
      setIsLoadingData(false);
    });

    const unsubRem = dbService.listenToReminders(userId, (data) => {
      setReminders(data);
    });

    const unsubInv = dbService.listenToInvestments(userId, (data) => {
      setInvestments(data);
    });

    const unsubBudgets = dbService.listenToBudgets(userId, (data) => {
      setBudgets(data);
    });

    const unsubProfile = dbService.listenToUserProfile(userId, (data) => {
      setCurrentUser(prev => prev ? { ...prev, ...data } : null);
    });

    const unsubMembers = dbService.listenToMembers(userId, (data) => {
      if (data.length === 0 && currentUser) {
        const adminMember: Omit<Member, 'id'> = {
          name: currentUser.name,
          avatarUrl: currentUser.avatarUrl || 'bg-gradient-to-br from-purple-600 to-blue-600',
          role: 'admin'
        };
        dbService.addMember(userId, adminMember).then(id => {
          setActiveMemberId(id);
        });
      } else {
        setMembers(data);
        if (activeMemberId !== 'FAMILY_OVERVIEW' && !data.find(m => m.id === activeMemberId)) {
          setActiveMemberId('FAMILY_OVERVIEW');
        }
      }
    });

    const unsubGoals = dbService.listenToGoals(userId, (data) => {
      setFamilyGoals(data);
    });

    return () => {
      unsubTx();
      unsubRem();
      unsubProfile();
      unsubMembers();
      unsubGoals();
      unsubBudgets();
    };
  }, [userId, currentUser?.name]);

  // Two-Factor Verification
  const handleVerifyTwoFactor = async (code: string) => {
    if (!pendingTwoFactor) return;
    setIsVerifyingTwoFactor(true);

    try {
      const isValid = await verifyTOTP(pendingTwoFactor.secret, code);
      if (!isValid) {
        toast.error("Código inválido ou expirado.");
        return;
      }

      setUserId(pendingTwoFactor.uid);
      setIsLoadingData(true);
      setCurrentUser({
        name: pendingTwoFactor.name,
        email: pendingTwoFactor.email,
        baseSalary: pendingTwoFactor.profile.baseSalary || 0,
        avatarUrl: pendingTwoFactor.profile.avatarUrl,
        twoFactorEnabled: true,
        twoFactorSecret: pendingTwoFactor.profile.twoFactorSecret
      });
      setPendingTwoFactor(null);
    } catch (err) {
      console.error("Erro ao validar 2FA:", err);
      toast.error("Erro ao validar o código. Tente novamente.");
    } finally {
      setIsVerifyingTwoFactor(false);
    }
  };

  const handleCancelTwoFactor = async () => {
    setPendingTwoFactor(null);
    if (auth) {
      await auth.signOut();
    }
    setShowLanding(true);
  };

  // --- Filter Logic ---

  // 1. Filter by Member (Base filtering)
  const memberFilteredTransactions = useMemo(() => {
    if (activeMemberId === 'FAMILY_OVERVIEW') return transactions;
    return transactions.filter(t => t.memberId === activeMemberId);
  }, [transactions, activeMemberId]);

  // Extract available categories from the filtered transactions
  const availableCategories = useMemo(() => {
    const cats = new Set(memberFilteredTransactions.map(t => t.category));
    return Array.from(cats).sort().map(c => ({ value: c, label: c }));
  }, [memberFilteredTransactions]);

  // 2. Filter by Date/Period AND Category (Dashboard Only)
  const dashboardFilteredTransactions = useMemo(() => {
    // First apply Member filter
    let filtered = memberFilteredTransactions;

    // Apply Category Filter
    if (dashboardCategory) {
      filtered = filtered.filter(t => t.category === dashboardCategory);
    }

    if (filterMode === 'all') return filtered;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return filtered.filter(t => {
      // Ensure transaction date handles local/UTC properly by appending time
      const tDate = new Date(t.date + 'T12:00:00');

      if (filterMode === 'month') {
        return t.date.startsWith(dashboardDate);
      }

      if (filterMode === 'year') {
        return tDate.getFullYear() === dashboardYear;
      }

      if (filterMode === 'last3') {
        const cutoff = new Date(now);
        cutoff.setMonth(now.getMonth() - 3);
        return tDate >= cutoff && tDate <= now;
      }

      if (filterMode === 'last6') {
        const cutoff = new Date(now);
        cutoff.setMonth(now.getMonth() - 6);
        return tDate >= cutoff && tDate <= now;
      }

      return true;
    });
  }, [memberFilteredTransactions, dashboardDate, dashboardYear, filterMode, dashboardCategory]);

  // Apenas considera lancamentos que o usuario manteve (concluidos e nao ignorados)
  const reviewedDashboardTransactions = useMemo(() => {
    return dashboardFilteredTransactions.filter(t => !t.ignored && t.status === 'completed');
  }, [dashboardFilteredTransactions]);

  // 3. Filter Reminders
  const filteredReminders = useMemo(() => {
    if (activeMemberId === 'FAMILY_OVERVIEW') return reminders;
    return reminders.filter(t => t.memberId === activeMemberId);
  }, [reminders, activeMemberId]);

  const overdueRemindersCount = filteredReminders.filter(r => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(r.dueDate);
    due.setHours(0, 0, 0, 0);
    return due <= today;
  }).length;

  // Stats based on DASHBOARD Filtered
  const stats: DashboardStats = React.useMemo(() => {
    const incomes = reviewedDashboardTransactions.filter(t => t.type === 'income');
    const expenses = reviewedDashboardTransactions.filter(t => t.type === 'expense');
    const totalIncome = incomes.reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = expenses.reduce((acc, t) => acc + t.amount, 0);
    return {
      totalIncome,
      totalExpense,
      totalBalance: totalIncome - totalExpense,
      monthlySavings: totalIncome > 0 ? (totalIncome - totalExpense) : 0
    };
  }, [reviewedDashboardTransactions]);

  // Handlers
  const handleResetFilters = () => {
    const now = new Date();
    setFilterMode('month');
    setDashboardDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setDashboardCategory('');
    toast.message({ text: "Filtros restaurados para este mês." });
  };

  const handleAddMember = async (name: string, avatarUrl: string) => {
    if (userId) {
      await dbService.addMember(userId, { name, avatarUrl, role: 'member' });
      toast.success("Membro adicionado!");
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!userId) return;

    const member = members.find(m => m.id === memberId);
    if (member?.role === 'admin') {
      toast.error("Nao e possivel remover o administrador.");
      return;
    }

    try {
      const toRestore = member;
      await dbService.deleteMember(userId, memberId);
      if (activeMemberId === memberId) {
        setActiveMemberId('FAMILY_OVERVIEW');
      }
      toast.message({
        text: "Membro removido.",
        action: "Desfazer",
        onAction: async () => {
          if (toRestore) {
            await dbService.restoreMember(userId, toRestore);
          }
        }
      });
    } catch (e) {
      toast.error("Erro ao remover membro.");
    }
  };

  const handleAddTransaction = async (data: Omit<Transaction, 'id'>) => {
    if (!userId) return;

    let targetMemberId = activeMemberId;

    if (targetMemberId === 'FAMILY_OVERVIEW') {
      const admin = members.find(m => m.role === 'admin') || members[0];
      if (admin) targetMemberId = admin.id;
      else {
        toast.error("Crie um membro primeiro.");
        return;
      }
    }

    const finalMemberId = data.memberId || targetMemberId;

    try {
      await dbService.addTransaction(userId, { ...data, memberId: finalMemberId });
      toast.success("Transação Adicionada!");
    } catch (e) {
      toast.error("Erro ao salvar.");
    }
  };

  const handleUpdateTransaction = async (transaction: Transaction) => {
    if (!userId) return;
    try {
      await dbService.updateTransaction(userId, transaction);
      toast.success("Lançamento atualizado com sucesso!");
    } catch (e) {
      toast.error("Erro ao atualizar lançamento.");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!userId) return;
    const deleted = transactions.find(t => t.id === id);
    try {
      await dbService.deleteTransaction(userId, id);
      toast.message({
        text: "Transação Removida",
        action: "Desfazer",
        onAction: async () => {
          if (deleted) await dbService.restoreTransaction(userId, deleted);
        }
      });
    } catch (e) {
      toast.error("Erro ao remover.");
    }
  };

  const handleUpdateSalary = async (newSalary: number) => {
    if (userId) {
      await dbService.updateUserProfile(userId, { baseSalary: newSalary });
      toast.success("Meta mensal atualizada.");
    }
  };

  const handleAddExtraIncome = async (amount: number, description: string) => {
    const admin = members.find(m => m.role === 'admin') || members[0];
    if (!admin) return;

    const extraIncome: Omit<Transaction, 'id'> = {
      description: description,
      amount: amount,
      category: 'Trabalho',
      type: 'income',
      date: new Date().toISOString().split('T')[0],
      status: 'completed',
      memberId: activeMemberId === 'FAMILY_OVERVIEW' ? admin.id : activeMemberId
    };
    await handleAddTransaction(extraIncome);
  };

  const handleAddReminder = async (data: Omit<Reminder, 'id'>) => {
    if (!userId) return;

    let targetMemberId = activeMemberId;
    if (targetMemberId === 'FAMILY_OVERVIEW') {
      const admin = members.find(m => m.role === 'admin') || members[0];
      targetMemberId = admin ? admin.id : '';
    }

    try {
      await dbService.addReminder(userId, { ...data, memberId: targetMemberId });
      toast.success("Lembrete criado.");
    } catch (e) {
      toast.error("Erro ao criar lembrete.");
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!userId) return;
    await dbService.deleteReminder(userId, id);
    toast.message({ text: "Lembrete removido" });
  };

  const handlePayReminder = async (reminder: Reminder) => {
    if (!userId) return;

    const newTransaction: Omit<Transaction, 'id'> = {
      description: reminder.description,
      amount: reminder.amount,
      date: new Date().toISOString().split('T')[0],
      category: reminder.category,
      type: reminder.type || 'expense',
      status: 'completed',
      memberId: reminder.memberId
    };

    await dbService.addTransaction(userId, newTransaction);

    if (reminder.isRecurring) {
      const nextDate = new Date(reminder.dueDate);
      if (reminder.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else if (reminder.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
      else nextDate.setMonth(nextDate.getMonth() + 1);

      const updatedReminder = { ...reminder, dueDate: nextDate.toISOString().split('T')[0] };
      await dbService.updateReminder(userId, updatedReminder);
      toast.success(reminder.type === 'income' ? "Recebimento confirmado! Próxima data agendada." : "Conta Paga! Vencimento atualizado.");
    } else {
      await dbService.deleteReminder(userId, reminder.id);
      toast.success(reminder.type === 'income' ? "Recebimento confirmado e removido." : "Conta paga e removida.");
    }
  };

  const handleAddGoal = async (goal: Omit<FamilyGoal, 'id'>) => {
    if (userId) await dbService.addFamilyGoal(userId, goal);
    toast.success("Meta criada!");
  };
  const handleUpdateGoal = async (goal: FamilyGoal) => {
    if (userId) await dbService.updateFamilyGoal(userId, goal);
    toast.success("Meta atualizada!");
  };
  const handleDeleteGoal = async (id: string) => {
    if (userId) await dbService.deleteFamilyGoal(userId, id);
    toast.success("Meta removida.");
  };

  const handleAddInvestment = async (investment: Omit<Investment, 'id'>) => {
    if (!userId) return;
    const targetMemberId = activeMemberId === 'FAMILY_OVERVIEW'
      ? (members.find(m => m.role === 'admin') || members[0])?.id
      : activeMemberId;
    await dbService.addInvestment(userId, { ...investment, memberId: targetMemberId });
    toast.success("Investimento adicionado!");
  };

  const handleUpdateInvestment = async (investment: Investment) => {
    if (!userId) return;
    await dbService.updateInvestment(userId, investment);
    toast.success("Investimento atualizado!");
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!userId) return;
    await dbService.deleteInvestment(userId, id);
    toast.success("Investimento removido!");
  };

  const getHeaderInfo = () => {
    const memberName = activeMemberId === 'FAMILY_OVERVIEW'
      ? 'Família'
      : members.find(m => m.id === activeMemberId)?.name || 'Membro';

    if (activeMemberId === 'FAMILY_OVERVIEW') {
      return { title: 'Visão Familiar', desc: 'Resumo financeiro de todos os membros.' };
    }

    switch (activeTab) {
      case 'dashboard': return { title: `Dashboard de ${memberName}`, desc: `Fluxo de caixa e estatísticas.` };
      case 'table': return { title: 'Transações', desc: 'Histórico completo de lançamentos.' };
      case 'reminders': return { title: 'Lembretes', desc: 'Contas a pagar deste perfil.' };
      case 'investments': return { title: 'Investimentos', desc: 'Gerencie sua carteira de investimentos.' };
      case 'advisor': return { title: 'Consultor IA', desc: 'Insights focados neste perfil.' };
      case 'budgets': return { title: 'Orçamentos', desc: 'Planejamento e controle de gastos.' };
      case 'connections': return { title: 'Contas Conectadas', desc: 'Bancos vinculados via Open Finance.' };
      default: return { title: 'Controlar+', desc: '' };
    }
  };

  const headerInfo = getHeaderInfo();

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-50
    bg-gray-950 border-r border-gray-800
    transition-all duration-300 ease-in-out
    flex flex-col
    ${isSidebarOpen ? 'overflow-hidden' : 'overflow-hidden lg:overflow-visible'}
    ${isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full w-0 lg:translate-x-0 lg:w-20'}
  `;

  if (isLoadingAuth) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin"></div>
    </div>
  }

  if (pendingTwoFactor) {
    return (
      <div className="min-h-screen bg-gray-950 text-[#faf9f5]">
        <ToastContainer />
        <TwoFactorPrompt
          isOpen={true}
          email={pendingTwoFactor.email}
          onConfirm={handleVerifyTwoFactor}
          onCancel={handleCancelTwoFactor}
          isVerifying={isVerifyingTwoFactor}
        />
      </div>
    );
  }

  // --- RENDERING LOGIC FOR LANDING / AUTH ---
  if (!currentUser) {
    if (showLanding) {
      return (
        <>
          <ToastContainer />
          <LandingPage onLogin={() => setShowLanding(false)} />
        </>
      );
    }
    return (
      <>
        <ToastContainer />
        <AuthModal onLogin={() => { }} onBack={() => setShowLanding(true)} />
      </>
    );
  }

  // --- MAIN APP ---

  return (
    <div className="min-h-screen bg-gray-950 flex text-[#faf9f5] font-sans selection:bg-[#d97757]/30">
      <ToastContainer />

      {/* Sidebar */}
      <aside className={sidebarClasses}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800/50 mb-4">
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${!isSidebarOpen ? 'w-full justify-center' : ''}`}>
            <Logo
              size={32}
              withText={isSidebarOpen}
              className="gap-3"
              textClassName="font-bold text-lg whitespace-nowrap text-[#faf9f5]"
              imgClassName="rounded-lg"
            />
          </div>

          {isSidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="hidden lg:flex p-1.5 rounded-md text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {!isSidebarOpen && (
          <div className="hidden lg:flex justify-center py-3 border-b border-gray-800/30 mb-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <MemberSelector
          members={members}
          activeMemberId={activeMemberId}
          onSelectMember={setActiveMemberId}
          onAddMember={handleAddMember}
          onDeleteMember={handleDeleteMember}
          isSidebarOpen={isSidebarOpen}
        />

        <div className={`flex-1 px-3 space-y-6 custom-scrollbar ${isSidebarOpen ? 'overflow-y-auto' : 'overflow-visible'}`}>
          <div className="space-y-1">
            {isSidebarOpen && <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 animate-fade-in opacity-70">Menu</p>}

            {activeMemberId === 'FAMILY_OVERVIEW' ? (
              <NavItem
                active={true}
                onClick={() => { }}
                icon={<LayoutDashboard size={20} />}
                label="Visão Geral"
                isOpen={isSidebarOpen}
              />
            ) : (
              <>
                <NavItem
                  active={activeTab === 'dashboard'}
                  onClick={() => { setActiveTab('dashboard'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  icon={<LayoutDashboard size={20} />}
                  label="Visão Geral"
                  isOpen={isSidebarOpen}
                />
                <NavItem
                  active={activeTab === 'table'}
                  onClick={() => { setActiveTab('table'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  icon={<Table2 size={20} />}
                  label="Lançamentos"
                  isOpen={isSidebarOpen}
                />
                <NavItem
                  active={activeTab === 'reminders'}
                  onClick={() => { setActiveTab('reminders'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  icon={<Bell size={20} />}
                  label="Lembretes"
                  isOpen={isSidebarOpen}
                  badge={overdueRemindersCount}
                />
                <NavItem
                  active={activeTab === 'budgets'}
                  onClick={() => { setActiveTab('budgets'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  icon={<Target size={20} />}
                  label="Orçamentos"
                  isOpen={isSidebarOpen}
                />
                <NavItem
                  active={activeTab === 'connections'}
                  onClick={() => { setActiveTab('connections'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  icon={<Building size={20} />}
                  label="Contas conectadas"
                  isOpen={isSidebarOpen}
                />
                <NavItem
                  active={activeTab === 'investments'}
                  onClick={() => { setActiveTab('investments'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  icon={<TrendingUp size={20} />}
                  label="Investimentos"
                  isOpen={isSidebarOpen}
                />
                <NavItem
                  active={activeTab === 'advisor'}
                  onClick={() => { setActiveTab('advisor'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  icon={<BrainCircuit size={20} />}
                  label="Consultor IA"
                  isOpen={isSidebarOpen}
                />
              </>
            )}
          </div>

          <div className="space-y-1">
            {isSidebarOpen && <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 animate-fade-in opacity-70">Open Finance</p>}
            <BankConnect
              userId={userId}
              memberId={syncMemberId}
              isSidebar
              onItemConnected={handlePluggyItemConnected}
              onSyncComplete={(count) => {
                if (count > 0) {
                  setActiveTab('table');
                }
              }}
            />
          </div>

          <div className="space-y-1">
            {isSidebarOpen && <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 animate-fade-in opacity-70">Inteligência</p>}

            <button
              onClick={() => setIsAIModalOpen(true)}
              disabled={activeMemberId === 'FAMILY_OVERVIEW'}
              className={`
                  w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 group shadow-lg relative
                  ${activeMemberId === 'FAMILY_OVERVIEW'
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none'
                  : isSidebarOpen
                    ? 'bg-[#d97757] text-[#faf9f5] hover:bg-[#c56a4d] shadow-[#d97757]/20'
                    : 'justify-center bg-transparent text-[#d97757] hover:bg-gray-800 shadow-none'
                }
                `}
            >
              <Bot size={20} className={`${isSidebarOpen ? 'text-[#faf9f5]' : 'text-[#d97757]'} ${activeMemberId !== 'FAMILY_OVERVIEW' ? 'group-hover:scale-110 transition-transform' : ''}`} />
              {isSidebarOpen && <span className="font-medium text-sm">Novo c/ IA</span>}

              {/* Tooltip */}
              {!isSidebarOpen && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 z-50 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-3 min-w-[140px] text-left hidden group-hover:block animate-fade-in pointer-events-none">
                  <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-b border-gray-800 rotate-45"></div>
                  <p className="text-sm font-bold text-white whitespace-nowrap">Novo c/ IA</p>
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}

      <main className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} relative`}>
        <header className="bg-gray-950/80 backdrop-blur-md h-16 lg:h-20 border-b border-gray-800 sticky top-0 z-40 px-3 lg:px-6 flex items-center justify-between gap-2 lg:gap-4">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1 overflow-hidden">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors shrink-0"
            >
              <Menu size={20} />
            </button>

            <div className="flex flex-col min-w-0 flex-1 overflow-hidden justify-center">
              <h1 className="text-sm lg:text-2xl font-bold text-[#faf9f5] tracking-tight truncate leading-tight">
                {headerInfo.title}
              </h1>
              <p className="text-[11px] lg:text-xs text-gray-400 font-medium truncate leading-tight mt-0.5">
                {headerInfo.desc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Dashboard Advanced Filters */}
            {activeTab === 'dashboard' && activeMemberId !== 'FAMILY_OVERVIEW' && (
              <div className="flex items-center gap-1 lg:gap-2 flex-wrap">
                {/* Filter Mode Selector */}
                <div className="w-28 lg:w-36 hidden sm:block">
                  <CustomSelect
                    value={filterMode}
                    onChange={(v) => setFilterMode(v as any)}
                    options={[
                      { value: 'month', label: 'Mensal' },
                      { value: 'year', label: 'Anual' },
                      { value: 'last3', label: 'Últimos 3' },
                      { value: 'last6', label: 'Últimos 6' },
                      { value: 'all', label: 'Tudo' }
                    ]}
                    icon={<Filter size={16} />}
                    className="text-sm"
                  />
                </div>

                {/* Dynamic Date Picker based on mode */}
                {filterMode === 'month' && (
                  <div className="w-40 lg:w-64">
                    <CustomMonthPicker
                      value={dashboardDate}
                      onChange={setDashboardDate}
                    />
                  </div>
                )}

                {filterMode === 'year' && (
                  <div className="w-24 lg:w-28">
                    <CustomSelect
                      value={dashboardYear}
                      onChange={(v) => setDashboardYear(Number(v))}
                      options={Array.from({ length: 5 }, (_, i) => {
                        const y = new Date().getFullYear() - i;
                        return { value: y, label: String(y) };
                      })}
                      icon={<Calendar size={16} />}
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Clear Filters Button */}
                {(filterMode !== 'month' || dashboardCategory !== '' || dashboardDate !== `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`) && (
                  <button
                    onClick={handleResetFilters}
                    className="h-11 w-11 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700 shrink-0"
                    title="Limpar Filtros"
                  >
                    <RotateCcw size={16} />
                  </button>
                )}
              </div>
            )}

            {activeTab === 'reminders' && activeMemberId !== 'FAMILY_OVERVIEW' && (
              <button
                onClick={() => setIsReminderModalOpen(true)}
                className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-[#d97757] hover:bg-[#c56a4d] text-[#faf9f5] rounded-lg font-medium text-sm transition-all shadow-lg shadow-[#d97757]/20"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Novo Lembrete</span>
              </button>
            )}

            <div className="h-8 w-px bg-gray-800 mx-1 lg:mx-2 hidden sm:block"></div>

            {/* Notification Center added here */}
            <NotificationCenter
              reminders={reminders}
              budgets={budgets}
              transactions={transactions}
              externalNotifications={notifications}
              onArchiveNotification={handleArchiveNotification}
              onDeleteNotification={handleDeleteNotification}
              onMarkReadNotification={handleMarkReadNotification}
            />

            <UserMenu
              user={currentUser}
              onLogout={() => auth.signOut()}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>
        </header>

        <div className="p-3 lg:p-6 max-w-7xl mx-auto">

          {activeMemberId === 'FAMILY_OVERVIEW' ? (
            <FamilyDashboard
              transactions={transactions}
              members={members}
              goals={familyGoals}
              onAddGoal={handleAddGoal}
              onUpdateGoal={handleUpdateGoal}
              onDeleteGoal={handleDeleteGoal}
              onAddTransaction={handleAddTransaction}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <>
                  {/* Only show Salary Manager in Monthly mode where it makes sense */}
                  {filterMode === 'month' && !dashboardCategory && (
                    <SalaryManager
                      baseSalary={currentUser.baseSalary || 0}
                      currentIncome={stats.totalIncome}
                      onUpdateSalary={handleUpdateSalary}
                      onAddExtra={handleAddExtraIncome}
                    />
                  )}
                  <StatsCards stats={stats} isLoading={isLoadingData} />
                  <div className="animate-fade-in space-y-6">
                    <DashboardCharts transactions={reviewedDashboardTransactions} isLoading={isLoadingData} />
                  </div>
                </>
              )}

              {activeTab === 'table' && (
                <div className="h-[calc(100vh-280px)] animate-fade-in">
                  <ExcelTable
                    transactions={memberFilteredTransactions}
                    onDelete={handleDeleteTransaction}
                    onUpdate={handleUpdateTransaction}
                  />
                </div>
              )}

              {activeTab === 'reminders' && (
                <Reminders
                  reminders={filteredReminders}
                  onAddReminder={handleAddReminder}
                  onDeleteReminder={handleDeleteReminder}
                  onPayReminder={handlePayReminder}
                  isModalOpen={isReminderModalOpen}
                  onCloseModal={() => setIsReminderModalOpen(false)}
                />
              )}

              {activeTab === 'investments' && (
                <div className="h-[calc(100vh-280px)] animate-fade-in">
                  <Investments
                    investments={activeMemberId === 'FAMILY_OVERVIEW'
                      ? investments
                      : investments.filter(inv => inv.memberId === activeMemberId)
                    }
                    onAdd={handleAddInvestment}
                    onUpdate={handleUpdateInvestment}
                    onDelete={handleDeleteInvestment}
                    onAddTransaction={handleAddTransaction}
                  />
                </div>
              )}

              {activeTab === 'advisor' && (
                <div className="h-[calc(100vh-140px)]">
                  <AIAdvisor transactions={memberFilteredTransactions} />
                </div>
              )}

              {activeTab === 'connections' && (
                <div className="flex-1 space-y-6 animate-fade-in">
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Open Finance</p>
                        <h2 className="text-xl font-bold text-white">Contas conectadas</h2>
                        <p className="text-sm text-gray-400">Visualize saldos e movimentacoes dos bancos vinculados.</p>
                      </div>
                      <BankConnect
                        userId={userId}
                        memberId={syncMemberId}
                        onItemConnected={handlePluggyItemConnected}
                        onSyncComplete={(count) => {
                          if (count > 0) setActiveTab('table');
                        }}
                      />
                    </div>
                  </div>

                  <ConnectedAccounts
                    accounts={pluggyAccounts}
                    isLoading={loadingPluggyAccounts}
                    onRefresh={() => refreshPluggyAccounts(pluggyItemIds)}
                    onImport={handleImportAccount}
                    lastSynced={pluggyLastSync}
                    storageKey={userId ? `pluggy_expand_${userId}` : undefined}
                  />
                </div>
              )}

              {activeTab === 'budgets' && userId && (
                <div className="flex-1 p-4 lg:p-8 overflow-y-auto custom-scrollbar">


                  <Budgets
                    userId={userId}
                    transactions={transactions}
                    members={members}
                    activeMemberId={activeMemberId}
                    budgets={budgets}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <AIChatAssistant
        onAddTransaction={handleAddTransaction}
        transactions={transactions}
        budgets={budgets}
        investments={investments}
      />

      <AIModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onConfirm={handleAddTransaction}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={currentUser}
        onUpdateUser={async (u) => {
          if (userId) await dbService.updateUserProfile(userId, u);
        }}
        transactions={transactions}
        familyGoals={familyGoals}
        investments={investments}
        reminders={reminders}
        connectedAccounts={pluggyAccounts}
      />
    </div>
  );
};

export default App;
