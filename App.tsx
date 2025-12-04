import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Table2,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Building,
  CreditCard
} from './components/Icons';
import { Flame, Vault, Lock, MessageCircle } from 'lucide-react';
import { Transaction, DashboardStats, User, Reminder, Member, FamilyGoal, Budget, ConnectedAccount } from './types';
import { StatsCards } from './components/StatsCards';
import { ExcelTable } from './components/ExcelTable';
import { CreditCardTable } from './components/CreditCardTable';
import { AIModal } from './components/AIModal';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { UserMenu } from './components/UserMenu';
import { SettingsModal } from './components/SettingsModal';
import { DashboardCharts } from './components/Charts';
import { Reminders } from './components/Reminders';
import { SalaryManager } from './components/SalaryManager';
import { FinanceCalendar } from './components/FinanceCalendar';
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
import { fetchPluggyAccounts, syncPluggyData, fetchPluggyTransactionsForImport, markTransactionsAsImported } from './services/pluggyService';
import { FireCalculator } from './components/FireCalculator';
import { SubscriptionPage } from './components/SubscriptionPage';
import { usePaymentStatus } from './components/PaymentStatus';
import { ImportReviewModal } from './components/ImportReviewModal';
import { InviteAcceptModal } from './components/InviteAcceptModal';

import { Subscriptions } from './components/Subscriptions';
import * as subscriptionService from './services/subscriptionService';
import * as familyService from './services/familyService';
import { Subscription } from './types';
import { detectSubscriptionService } from './utils/subscriptionDetector';
import { toLocalISODate, toLocalISOString } from './utils/dateUtils';

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
        flex items-center transition-all duration-200 group relative rounded-lg
        ${isOpen 
          ? 'w-full gap-3 p-2.5 justify-start' // Expandido: alinhado à esquerda
          : 'w-full py-3 justify-center'       // Colapsado: largura total, centralizado (removido w-10/h-10 rounded-full)
        }
        ${active
          ? 'bg-gray-800 text-white shadow-sm'
          : disabled
            ? 'text-gray-600 cursor-not-allowed opacity-50'
            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
        }
      `}
    >
      <span className={`transition-colors relative z-10 ${active ? 'text-[#d97757]' : 'text-gray-500 group-hover:text-gray-300'}`}>
        {icon}
      </span>

      {isOpen && <span className="font-medium text-sm truncate animate-fade-in">{label}</span>}

      {/* Badge */}
      {(badge || 0) > 0 && (
        <span className={`absolute ${isOpen ? 'right-2 top-1/2 -translate-y-1/2' : 'top-1 right-1'} flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white`}>
          {badge && badge > 9 ? '9+' : badge}
        </span>
      )}

      {/* Active Indicator (Collapsed - Barra lateral sutil) */}
      {!isOpen && active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#d97757] rounded-r-md"></div>
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

const WhatsAppConnect: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isVisible) return null;
  
  return (
    <div 
      className={`
        fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out
        ${isAnimating ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}
      `}
    >
       <div 
         className={`
            bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
            ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
         `}
       >
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10">
             <X size={20} />
          </button>

          <div className="p-6 flex flex-col items-center text-center relative">
             {/* Background Glow */}
             <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#25D366]/10 rounded-full blur-3xl pointer-events-none"></div>

             <div className="w-16 h-16 bg-[#25D366]/10 rounded-full flex items-center justify-center mb-4 text-[#25D366] ring-1 ring-[#25D366]/20 relative z-10">
                <MessageCircle size={32} />
             </div>
             
             <h2 className="text-xl font-bold text-white mb-2 relative z-10">Coinzinha no WhatsApp</h2>
             <p className="text-gray-400 text-sm mb-6 leading-relaxed relative z-10">
               Converse com sua IA financeira diretamente pelo WhatsApp. Envie áudios de gastos, fotos de notas fiscais ou peça conselhos.
             </p>

             <div className="bg-gray-800/50 rounded-xl p-4 w-full mb-6 border border-gray-800 text-left relative z-10">
                <p className="text-xs text-gray-500 font-bold uppercase mb-2">Como funciona:</p>
                <ul className="text-sm text-gray-300 space-y-2">
                   <li className="flex gap-2 items-start">
                      <span className="text-[#25D366] font-bold">1.</span>
                      <span>Clique no botão abaixo para abrir o chat.</span>
                   </li>
                   <li className="flex gap-2 items-start">
                      <span className="text-[#25D366] font-bold">2.</span>
                      <span>Se for sua primeira vez, envie o código de conexão (ex: <code>join stomach-event</code>).</span>
                   </li>
                   <li className="flex gap-2 items-start">
                      <span className="text-[#25D366] font-bold">3.</span>
                      <span>Pronto! O Coinzinha vai processar tudo e sincronizar aqui.</span>
                   </li>
                </ul>
             </div>

             <a 
               href="https://wa.me/14155238886?text=join%20stomach-event" 
               target="_blank" 
               rel="noreferrer"
               className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,211,102,0.3)] relative z-10"
             >
               <MessageCircle size={20} />
               Abrir WhatsApp
             </a>
          </div>
       </div>
    </div>
  );
};

import { InviteLanding } from './components/InviteLanding';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [pendingTwoFactor, setPendingTwoFactor] = useState<PendingTwoFactor | null>(null);
  const [isVerifyingTwoFactor, setIsVerifyingTwoFactor] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<{ token: string; familyId: string; ownerName?: string } | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isProcessingInvite, setIsProcessingInvite] = useState(false);
  const [showInviteLanding, setShowInviteLanding] = useState(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return !!params.get('inviteToken');
      }
      return false;
  });
  const toast = useToasts();

  // Handle Family Invite Link & Context Loading
  useEffect(() => {
      const loadInvite = async () => {
        let token: string | null = null;
        let familyId: string | null = null;

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            token = params.get('inviteToken');
            familyId = params.get('familyId');

            if (token && familyId) {
                localStorage.setItem('pending_invite_token', token);
                localStorage.setItem('pending_invite_family_id', familyId);
                // Clear URL params
                window.history.replaceState({}, document.title, window.location.pathname);
            } else {
                token = localStorage.getItem('pending_invite_token');
                familyId = localStorage.getItem('pending_invite_family_id');
            }
        }

        if (token && familyId) {
            try {
                const group = await familyService.getFamilyGroup(familyId);
                let ownerName = 'Alguém';
                if (group && group.ownerId) {
                    const ownerProfile = await dbService.getUserProfile(group.ownerId);
                    if (ownerProfile?.name) ownerName = ownerProfile.name;
                }
                setPendingInvite({ token, familyId, ownerName });
                // Only show landing if no user is logged in yet.
                // If logged in, logic further down handles it (showing InviteAcceptModal or auto-joining).
                if (!auth.currentUser) {
                    setShowInviteLanding(true);
                }
            } catch (err) {
                console.error("Erro ao carregar convite:", err);
            }
        }
      };
      loadInvite();
  }, []);


  // Landing variant selector (default waitlist, alt URL unlocks auth landing)
  useEffect(() => {
      if (typeof window === 'undefined') return;

      const updateLandingVariant = () => {
          const params = new URLSearchParams(window.location.search);
          const landingParam = (params.get('landing') || '').toLowerCase();
          const path = window.location.pathname.toLowerCase();
          const isAltLanding = landingParam === 'acesso' || landingParam === 'auth' || path === '/acesso' || path === '/acesso/';
          setLandingVariant(isAltLanding ? 'auth' : 'waitlist');
      };

      updateLandingVariant();
      window.addEventListener('popstate', updateLandingVariant);
      return () => window.removeEventListener('popstate', updateLandingVariant);
  }, []);

  // Trigger Modal after Login
  useEffect(() => {
      if (userId && currentUser && pendingInvite) {
          // Check if already in *this* family or another
          if (currentUser.familyGroupId) {
              if (currentUser.familyGroupId === pendingInvite.familyId) {
                  toast.success("Você já faz parte desta família!");
                  setPendingInvite(null);
                  localStorage.removeItem('pending_invite_token');
                  localStorage.removeItem('pending_invite_family_id');
              } else {
                  // If in another family, we might still show the modal but warn them they need to leave first?
                  // Or just show the modal and let the join fail or handle logic there.
                  // For simplicity: Show modal, let user confirm.
                  setShowInviteModal(true);
              }
          } else {
              setShowInviteModal(true);
          }
      }
  }, [userId, currentUser, pendingInvite]);

  const handleAcceptInvite = async () => {
      if (!userId || !pendingInvite) return;
      setIsProcessingInvite(true);
      try {
          await familyService.joinFamily(userId, pendingInvite.familyId, pendingInvite.token);
          toast.success("Bem-vindo à família! Acesso liberado.");
          
          // Cleanup
          localStorage.removeItem('pending_invite_token');
          localStorage.removeItem('pending_invite_family_id');
          setPendingInvite(null);
          setShowInviteModal(false);
          
          // Refresh profile immediately
          const profile = await dbService.getUserProfile(userId);
          if (profile) setCurrentUser(prev => ({ ...prev!, ...profile }));
      } catch (err: any) {
          toast.error(err.message || "Erro ao entrar na família.");
          // If user is already in another family, the service throws an error.
          // If the error is specifically about leaving the current family, we could offer that option here.
      } finally {
          setIsProcessingInvite(false);
      }
  };

  const handleDeclineInvite = () => {
      localStorage.removeItem('pending_invite_token');
      localStorage.removeItem('pending_invite_family_id');
      setPendingInvite(null);
      setShowInviteModal(false);
      toast.info("Convite recusado.");
  };

  // Handle Stripe Payment Return
  usePaymentStatus(async (planId) => {
    if (userId && currentUser) {
      // Update local state
      const updatedUser = { 
          ...currentUser, 
          subscription: { 
              plan: planId as any, 
              status: 'active' as const, 
              billingCycle: 'monthly' as const, // Simplified assumption or pass via URL
              nextBillingDate: toLocalISOString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
          }
      };
      setCurrentUser(updatedUser);
      await dbService.updateUserProfile(userId, updatedUser);
    }
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'table' | 'reminders' | 'investments' | 'fire' | 'advisor' | 'budgets' | 'connections' | 'subscription' | 'subscriptions'>('dashboard');
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(() => {
    // Check if mobile on initial load
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    if (!isDesktop) return false; // Always start closed on mobile

    const saved = localStorage.getItem('finances_sidebar_open');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Landing Page State
  const [showLanding, setShowLanding] = useState(true);
  const [landingVariant, setLandingVariant] = useState<'waitlist' | 'auth'>(() => {
    if (typeof window === 'undefined') return 'waitlist';
    const params = new URLSearchParams(window.location.search);
    const landingParam = (params.get('landing') || '').toLowerCase();
    const path = window.location.pathname.toLowerCase();
    const isAltLanding = landingParam === 'acesso' || landingParam === 'auth' || path === '/acesso' || path === '/acesso/';
    return isAltLanding ? 'auth' : 'waitlist';
  });

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [familyGoals, setFamilyGoals] = useState<FamilyGoal[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pluggyAccounts, setPluggyAccounts] = useState<ConnectedAccount[]>([]);
  const [pluggyItemIds, setPluggyItemIds] = useState<string[]>([]);
  const [loadingPluggyAccounts, setLoadingPluggyAccounts] = useState(false);
  const [pluggyLastSync, setPluggyLastSync] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  
  // Import Review State
  const [isImportReviewOpen, setIsImportReviewOpen] = useState(false);
  const [importReviewTransactions, setImportReviewTransactions] = useState<Omit<Transaction, 'id'>[]>([]);
  const [importReviewAccountName, setImportReviewAccountName] = useState('');
  const [importReviewItemId, setImportReviewItemId] = useState('');

  // Dashboard Filter State
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [dashboardCategory, setDashboardCategory] = useState<string>(''); // New Category Filter
  const [dashboardDate, setDashboardDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dashboardYear, setDashboardYear] = useState<number>(new Date().getFullYear());
  
  // Projections State
  const [showProjectionMenu, setShowProjectionMenu] = useState(false);
  const [projectionSettings, setProjectionSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_projection_settings');
      return saved !== null ? JSON.parse(saved) : { reminders: false, subscriptions: false, salary: false, vale: false };
    }
    return { reminders: false, subscriptions: false, salary: false, vale: false };
  });

  useEffect(() => {
    localStorage.setItem('finances_projection_settings', JSON.stringify(projectionSettings));
  }, [projectionSettings]);
  
  // Stats Toggles
  const [includeCheckingInStats, setIncludeCheckingInStats] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_include_checking');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  const [includeCreditCardInStats, setIncludeCreditCardInStats] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_include_credit');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  const [creditCardUseTotalLimit, setCreditCardUseTotalLimit] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_cc_use_total_limit');
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });

  const [creditCardUseFullLimit, setCreditCardUseFullLimit] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_cc_use_full_limit');
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('finances_include_checking', JSON.stringify(includeCheckingInStats));
  }, [includeCheckingInStats]);

  useEffect(() => {
    localStorage.setItem('finances_include_credit', JSON.stringify(includeCreditCardInStats));
  }, [includeCreditCardInStats]);

  useEffect(() => {
    localStorage.setItem('finances_cc_use_total_limit', JSON.stringify(creditCardUseTotalLimit));
  }, [creditCardUseTotalLimit]);

  useEffect(() => {
    localStorage.setItem('finances_cc_use_full_limit', JSON.stringify(creditCardUseFullLimit));
  }, [creditCardUseFullLimit]);

  // Member Management State
  const [activeMemberId, setActiveMemberId] = useState<string | 'FAMILY_OVERVIEW'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_active_member_id');
      return (saved as string | 'FAMILY_OVERVIEW') || 'FAMILY_OVERVIEW';
    }
    return 'FAMILY_OVERVIEW';
  });

  // Modals State
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'plan' | 'badges' | 'data' | 'finance'>('profile');

  useEffect(() => {
    if (activeMemberId) {
      localStorage.setItem('finances_active_member_id', activeMemberId);
    }
  }, [activeMemberId]);

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
    toast.success("Open Finance conectado! Atualizando contas...");
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
      // 1. Fetch candidates instead of auto-saving
      const candidates = await fetchPluggyTransactionsForImport(userId, account.itemId, account.id);

      // Filter out transactions that already exist
      const newCandidates = [];
      for (const tx of candidates) {
          const exists = await dbService.transactionExists(userId, tx);
          if (!exists) {
              newCandidates.push(tx);
          }
      }

      if (newCandidates.length === 0) {
        toast.message({ text: "Nenhuma transação nova para importar." });
        setPluggyLastSync(prev => ({ ...prev, [account.id]: toLocalISOString() }));
        return 0;
      }

      // 2. Open Modal
      setImportReviewTransactions(newCandidates);
      setImportReviewAccountName(account.name);
      setImportReviewItemId(account.itemId);
      setIsImportReviewOpen(true);
      
      return newCandidates.length; // Return count found (not necessarily saved yet)
    } catch (err) {
      console.error("Erro ao buscar transacoes Pluggy:", err);
      toast.error("Nao foi possivel buscar os lancamentos.");
      return 0;
    }
  };

  const handleConfirmImport = async (selectedTransactions: Omit<Transaction, 'id'>[]) => {
    if (!userId || !importReviewItemId) return;
    setIsImportReviewOpen(false);

    try {
       let count = 0;
       for (const tx of selectedTransactions) {
          // Add memberId context
          const txWithMember = { ...tx, memberId: syncMemberId };
          
          // Ensure deterministic ID for consistency and sanitize
          const safePluggyId = tx.pluggyId ? tx.pluggyId.replace(/\//g, '_') : undefined;
          const firestoreId = safePluggyId ? `pluggy_${safePluggyId}` : undefined;
          
          // Save
          await dbService.addTransaction(userId, txWithMember, firestoreId);
          count++;

          // Check/Add Subscription Logic (Moved from old handleImport)
          if (tx.type === 'expense') {
              if (tx.isSubscription) {
                 const exists = await subscriptionService.checkSubscriptionExists(userId, tx.description);
                 if (!exists) {
                     await subscriptionService.addSubscription(userId, {
                         userId,
                         name: tx.description,
                         amount: tx.amount,
                         category: tx.category,
                         billingCycle: 'monthly',
                         status: 'active'
                     });
                 }
              } else {
                 const detection = detectSubscriptionService(tx.description);
                 if (detection.isSubscription) {
                     const exists = await subscriptionService.checkSubscriptionExists(userId, detection.name || tx.description);
                     if (!exists) {
                         await subscriptionService.addSubscription(userId, {
                             userId,
                             name: detection.name || tx.description,
                             amount: tx.amount,
                             category: detection.category || tx.category,
                             billingCycle: 'monthly',
                             status: 'active'
                         });
                     }
                 }
              }
          }
       }

       // Mark as imported in local cache to prevent re-appearing
       markTransactionsAsImported(userId, importReviewItemId, selectedTransactions);

       toast.success(`${count} lançamentos importados com sucesso!`);
       
       // Update last sync visual
       // (Find account ID if possible or just refresh state)
    } catch (e) {
       console.error("Erro ao salvar importacao:", e);
       toast.error("Erro ao salvar transações selecionadas.");
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
        setShowInviteLanding(false); // Hide invite landing if user logs in

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

  // Auto-Register Monthly Salary
  useEffect(() => {
    if (!currentUser || !currentUser.baseSalary || !currentUser.salaryPaymentDay || isLoadingData || !userId) return;

    const checkAndAddSalary = async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed
      const currentDay = now.getDate();

      // Determine the target day for this month (handle shorter months)
      const lastDayOfThisMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const targetDay = Math.min(currentUser.salaryPaymentDay!, lastDayOfThisMonth);

      // Only proceed if today is on or after the payment day
      if (currentDay >= targetDay) {
         const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
         const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

         // Check if exists in loaded transactions
         // We check for "Salário Mensal" description AND the current month prefix in date
         const exists = transactions.some(t =>
           t.type === 'income' &&
           t.description === "Salário Mensal" &&
           t.date.startsWith(monthPrefix)
         );

         if (!exists) {
           // Calculate Advance
           let advance = currentUser.salaryAdvanceValue || 0;
           
           // Sanity Check
           if (advance >= currentUser.baseSalary!) {
               advance = 0;
           }
           
           if (!advance && currentUser.salaryAdvancePercent && currentUser.salaryAdvancePercent > 0) {
               advance = currentUser.baseSalary! * (currentUser.salaryAdvancePercent / 100);
           }
           advance = Math.round((advance + Number.EPSILON) * 100) / 100;

           const salaryAmount = Math.max(0, currentUser.baseSalary! - advance);

           const newTx: Omit<Transaction, 'id'> = {
              description: "Salário Mensal",
              amount: salaryAmount,
              type: 'income',
              category: 'Trabalho',
              date: dateString,
              status: 'completed',
              memberId: activeMemberId === 'FAMILY_OVERVIEW' ? (members.find(m => m.role === 'admin')?.id || members[0]?.id) : activeMemberId
           };

           try {
              await dbService.addTransaction(userId, newTx);
              
              // Check/Add Vale separately if needed
              // Note: This auto-register only runs when "Salário Mensal" day arrives.
              // If the user wants Vale to be auto-registered on its own day, we should have a separate check.
              // But for now, we register it together or skip if already exists?
              // Ideally, Vale should be registered on ITS day. 
              // If we register it here (on Salary day), it might be late.
              // But if we register it here, let's check if it exists first.
              
              if (advance > 0) {
                   // Determine Vale Date
                   let valeDateStr = dateString;
                   const pDay = currentUser.salaryPaymentDay || 5;
                   const aDay = currentUser.salaryAdvanceDay;
                   
                   if (aDay) {
                       const vDate = new Date(currentYear, currentMonth, 1); // Start with current month of Salary logic
                       vDate.setDate(aDay);
                       valeDateStr = `${vDate.getFullYear()}-${String(vDate.getMonth() + 1).padStart(2, '0')}-${String(vDate.getDate()).padStart(2, '0')}`;
                   }

                   // Check if Vale exists
                   const valePrefix = valeDateStr.slice(0, 7);
                   const valeExists = transactions.some(t =>
                       t.type === 'income' &&
                       t.description === "Vale / Adiantamento" &&
                       t.date.startsWith(valePrefix)
                   );
                   
                   if (!valeExists) {
                      const advanceTx: Omit<Transaction, 'id'> = {
                          description: "Vale / Adiantamento",
                          amount: advance,
                          type: 'income',
                          category: 'Trabalho',
                          date: valeDateStr,
                          status: 'completed',
                          memberId: newTx.memberId
                      };
                      await dbService.addTransaction(userId, advanceTx);
                   }
              }

              toast.success("Salário mensal registrado automaticamente!");
           } catch (err) {
              console.error("Erro ao registrar salario automatico:", err);
           }
         }
      }
    };

    checkAndAddSalary();
  }, [currentUser?.baseSalary, currentUser?.salaryPaymentDay, transactions.length, isLoadingData, userId]);

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

    const unsubSubs = subscriptionService.listenToSubscriptions(userId, (data) => {
      setSubscriptions(data);
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
        setActiveMemberId(current => {
          if (current !== 'FAMILY_OVERVIEW' && !data.find(m => m.id === current)) {
            return 'FAMILY_OVERVIEW';
          }
          return current;
        });
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
      unsubSubs();
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
      toast.success("Identidade confirmada. Bem-vindo de volta!");
    } catch (err) {
      console.error("Erro ao validar 2FA:", err);
      toast.error("Erro ao validar o código. Tente novamente.");
    } finally {
      setIsVerifyingTwoFactor(false);
    }
  };

  const handleCancelTwoFactor = async () => {
    setPendingTwoFactor(null);
    if (auth) await auth.signOut();
    setUserId(null);
    setCurrentUser(null);
    setShowLanding(true);
  };

  // --- Filter Logic ---

  // 1. Filter by Member (Base filtering)
  const memberFilteredTransactions = useMemo(() => {
    if (activeMemberId === 'FAMILY_OVERVIEW') return transactions;
    return transactions.filter(t => t.memberId === activeMemberId);
  }, [transactions, activeMemberId]);

  const memberInvestments = useMemo(() => {
    if (activeMemberId === 'FAMILY_OVERVIEW') return investments;
    return investments.filter(inv => inv.memberId === activeMemberId);
  }, [investments, activeMemberId]);

  const totalMemberInvestments = useMemo(() => {
    return memberInvestments.reduce((sum, inv) => sum + inv.currentAmount, 0);
  }, [memberInvestments]);

  // NEW: Calculate Account Balances
  const accountBalances = useMemo(() => {
    const checking = pluggyAccounts
        .filter(a => {
          const subtype = (a.subtype || '').toUpperCase();
          if (subtype === 'SAVINGS_ACCOUNT') return false; // savings ficam nas caixinhas
          if (subtype === 'CHECKING_ACCOUNT') return true;
          // se for banco sem subtype, assume conta corrente para n�o somar poupan�a
          return a.type === 'BANK' && !subtype;
        })
        .reduce((sum, a) => sum + (a.balance || 0), 0);
    
    const credit = pluggyAccounts
        .filter(a => a.type === 'CREDIT' || a.subtype === 'CREDIT_CARD')
        .reduce((acc, a) => ({
            used: acc.used + (a.balance || 0),
            available: acc.available + (a.availableCreditLimit || 0),
            limit: acc.limit + (a.creditLimit || 0)
        }), { used: 0, available: 0, limit: 0 });
        
    return { checking, credit };
  }, [pluggyAccounts]);

  // NEW: Filter Savings Accounts
  const connectedSavingsAccounts = useMemo(() => {
    return pluggyAccounts.filter(a => a.subtype === 'SAVINGS_ACCOUNT');
  }, [pluggyAccounts]);

  // NEW: Account Map for Lookups
  const accountMap = useMemo(() => {
      const map = new Map<string, ConnectedAccount>();
      pluggyAccounts.forEach(a => map.set(a.id, a));
      return map;
  }, [pluggyAccounts]);

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
        // Current month + 2 previous months (Start of month-2 to now)
        // Actually, "Last 3 months" usually implies "Recent history".
        // To avoid excluding today/future of current month, we set start date.
        const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1); // 1st day of 2 months ago
        return tDate >= cutoff; // Up to infinity (includes future of current month)
      }

      if (filterMode === 'last6') {
        const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1); // 1st day of 5 months ago
        return tDate >= cutoff;
      }

      return true;
    });
  }, [memberFilteredTransactions, dashboardDate, dashboardYear, filterMode, dashboardCategory]);

  // Apenas considera lancamentos que o usuario manteve (nao ignorados), incluindo pendentes para previsibilidade
  const reviewedDashboardTransactions = useMemo(() => {
    return dashboardFilteredTransactions.filter(t => !t.ignored);
  }, [dashboardFilteredTransactions]);

  const reviewedMemberTransactions = useMemo(() => {
    return memberFilteredTransactions.filter(t => !t.ignored && t.status === 'completed');
  }, [memberFilteredTransactions]);

  // Split transactions by Account Type for different tabs
  const checkingTransactions = useMemo(() => {
    return memberFilteredTransactions.filter(t => {
        const type = (t.accountType || '').toUpperCase();
        return !type.includes('CREDIT') && !type.includes('SAVINGS') && !t.isInvestment;
    });
  }, [memberFilteredTransactions]);

  const creditCardTransactions = useMemo(() => {
    return memberFilteredTransactions.filter(t => {
        const type = (t.accountType || '').toUpperCase();
        return type.includes('CREDIT');
    });
  }, [memberFilteredTransactions]);

  const savingsTransactions = useMemo(() => {
    return memberFilteredTransactions.filter(t => {
        const type = (t.accountType || '').toUpperCase();
        return type.includes('SAVINGS') || t.isInvestment;
    });
  }, [memberFilteredTransactions]);

  const averageMonthlyExpense = useMemo(() => {
    const expensesByMonth: Record<string, number> = {};
    reviewedMemberTransactions.forEach(t => {
      if (t.type !== 'expense') return;
      const monthKey = t.date.slice(0, 7);
      expensesByMonth[monthKey] = (expensesByMonth[monthKey] || 0) + t.amount;
    });
    const months = Object.keys(expensesByMonth).length;
    if (!months) return 0;
    const total = Object.values(expensesByMonth).reduce((sum, val) => sum + val, 0);
    return total / months;
  }, [reviewedMemberTransactions]);

  const averageMonthlySavings = useMemo(() => {
    const monthlyTotals = new Map<string, { income: number; expense: number }>();
    reviewedMemberTransactions.forEach(t => {
      const monthKey = t.date.slice(0, 7);
      const current = monthlyTotals.get(monthKey) || { income: 0, expense: 0 };
      if (t.type === 'income') current.income += t.amount;
      if (t.type === 'expense') current.expense += t.amount;
      monthlyTotals.set(monthKey, current);
    });

    if (!monthlyTotals.size) return 0;

    let sum = 0;
    monthlyTotals.forEach(({ income, expense }) => {
      sum += (income - expense);
    });

    return sum / monthlyTotals.size;
  }, [reviewedMemberTransactions]);

  // 3. Filter Reminders
  const filteredReminders = useMemo(() => {
    if (activeMemberId === 'FAMILY_OVERVIEW') return reminders;
    return reminders.filter(t => t.memberId === activeMemberId);
  }, [reminders, activeMemberId]);

  const overdueRemindersCount = filteredReminders.filter(r => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date((r.dueDate || toLocalISODate()) + "T00:00:00");
    due.setHours(0, 0, 0, 0);
    return due <= today;
  }).length;

  // Stats based on DASHBOARD Filtered
  const stats: DashboardStats = React.useMemo(() => {
    const todayStr = toLocalISODate();
    
    const incomes = reviewedDashboardTransactions.filter(t => {
        if (t.type !== 'income') return false;
        if (t.isInvestment) return false;
        if (t.category.startsWith('Caixinha')) return false;
        
        // Salary Visibility Logic
        if (t.description === "Salário Mensal" && t.date > todayStr && !projectionSettings.salary) {
            return false;
        }
        // Vale Visibility Logic
        if (t.description === "Vale / Adiantamento" && t.date > todayStr && !projectionSettings.vale) {
            return false;
        }
        return true;
    });

    // Base Expenses (All types)
    const baseExpenses = reviewedDashboardTransactions.filter(t => 
        t.type === 'expense' && 
        !t.isInvestment && 
        !t.category.startsWith('Caixinha') // Fallback for older txs
    );
    
    // Split Expenses by Type (Credit Card vs Others)
    const ccTransactions = baseExpenses.filter(t => (t.accountType || '').toUpperCase().includes('CREDIT'));
    const nonCCTransactions = baseExpenses.filter(t => !(t.accountType || '').toUpperCase().includes('CREDIT'));
    
    const totalIncome = incomes.reduce((acc, t) => acc + t.amount, 0);
    const nonCCSpending = nonCCTransactions.reduce((acc, t) => acc + t.amount, 0);
    const ccSpending = ccTransactions.reduce((acc, t) => acc + t.amount, 0);
    
    // Calculate Account-level Credit Data (Debt & Limit)
    let ccBillsInView = 0;
    let ccTotalLimitInView = 0;
    
    if (includeCreditCardInStats) {
        accountMap.forEach((acc) => {
            const type = (acc.subtype || acc.type || "").toUpperCase();
            const isCredit = type.includes('CREDIT');
            
            if (isCredit) {
                ccBillsInView += (acc.balance || 0);
                ccTotalLimitInView += (acc.creditLimit || 0);
            }
        });
    }

    // Determine Final Credit Card Expense Value for Stats
    let finalCCExpense = 0;
    
    if (includeCreditCardInStats) {
        if (creditCardUseFullLimit) {
            finalCCExpense = ccTotalLimitInView;
        } else if (creditCardUseTotalLimit) {
            finalCCExpense = ccBillsInView;
        } else {
            finalCCExpense = ccSpending;
        }
    }

    // Final Totals
    const totalExpense = nonCCSpending + finalCCExpense;
    
    // Calculate Balance
    let calculatedBalance = 0;
    if (includeCheckingInStats) {
       calculatedBalance += accountBalances.checking;
    }
    
    // Subtract CC Liability from Balance (if enabled)
    if (includeCreditCardInStats) {
        calculatedBalance -= finalCCExpense;
    }

    // Period Flow (Savings)
    const periodSavings = totalIncome - totalExpense;

    // 3. Projections (Reminders + Subscriptions) - Adjust totals if needed
    let projectedIncome = 0;
    let projectedExpense = 0;

    if (filterMode === 'month') {
      // Reminders
      if (projectionSettings.reminders) {
        const projectedReminders = filteredReminders.filter(r => {
          if (!r.dueDate.startsWith(dashboardDate)) return false;
          if (dashboardCategory && r.category !== dashboardCategory) return false;
          return true;
        });

        projectedReminders.forEach(r => {
          if (r.type === 'income') {
            projectedIncome += r.amount;
          } else {
            projectedExpense += r.amount;
          }
        });
      }

      // Subscriptions
      if (projectionSettings.subscriptions) {
        const activeSubscriptions = subscriptions.filter(s => 
            s.status === 'active' && 
            s.billingCycle === 'monthly' && 
            (!dashboardCategory || s.category === dashboardCategory)
        );

        activeSubscriptions.forEach(s => {
           const alreadyPaid = reviewedDashboardTransactions.some(t => 
               t.type === 'expense' && 
               t.amount === s.amount && 
               t.description.toLowerCase().includes(s.name.toLowerCase())
           );

           if (!alreadyPaid) {
               projectedExpense += s.amount;
           }
        });
      }
      
      // Salary Projection
      if (projectionSettings.salary && currentUser?.baseSalary) {
           const salaryTx = reviewedDashboardTransactions.find(t => t.type === 'income' && t.description === "Salário Mensal");
           if (!salaryTx || (salaryTx.amount === 0 && currentUser.baseSalary > 0)) {
               let advance = currentUser.salaryAdvanceValue || 0;
               if (!advance && currentUser.salaryAdvancePercent && currentUser.salaryAdvancePercent > 0) {
                   advance = currentUser.baseSalary! * (currentUser.salaryAdvancePercent / 100);
               }
               advance = Math.round((advance + Number.EPSILON) * 100) / 100;
               const salaryAmount = Math.max(0, currentUser.baseSalary! - advance);
               projectedIncome += salaryAmount;
           }
      }

      // Vale Projection
      if (projectionSettings.vale && currentUser?.baseSalary) {
           const valeTx = reviewedDashboardTransactions.find(t => t.type === 'income' && t.description === "Vale / Adiantamento");
           if (!valeTx || (valeTx.amount === 0 && currentUser.baseSalary > 0)) {
               let advance = currentUser.salaryAdvanceValue || 0;
               if (!advance && currentUser.salaryAdvancePercent && currentUser.salaryAdvancePercent > 0) {
                   advance = currentUser.baseSalary! * (currentUser.salaryAdvancePercent / 100);
               }
               advance = Math.round((advance + Number.EPSILON) * 100) / 100;
               if (advance > 0) {
                   projectedIncome += advance;
               }
           }
      }
    }

    // Apply Projections
    const finalTotalIncome = totalIncome + projectedIncome;
    const finalTotalExpense = totalExpense + projectedExpense;
    const finalBalance = calculatedBalance + projectedIncome - projectedExpense;
    const finalMonthlySavings = finalTotalIncome - finalTotalExpense;

    return {
      totalIncome: finalTotalIncome,
      totalExpense: finalTotalExpense,
      totalBalance: finalBalance,
      monthlySavings: finalMonthlySavings,
      creditCardSpending: ccSpending
    };
  }, [reviewedDashboardTransactions, projectionSettings, filterMode, dashboardDate, filteredReminders, includeCheckingInStats, includeCreditCardInStats, creditCardUseTotalLimit, creditCardUseFullLimit, accountBalances, dashboardCategory]);

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
       const plan = currentUser?.subscription?.plan || 'starter';
       const currentCount = members.length;
       
       // Limits:
       // Starter: 1 Total (Admin only) -> Cannot add.
       // Pro: 2 Total (Admin + 1 profile).
       // Family: 5 Total.

                  if (plan === 'starter' && currentCount >= 1) {
                      toast.error("O plano Starter não permite criar perfis adicionais. Faça upgrade para Pro ou Família.");
                      return;
                  }
       
                  if (plan === 'pro' && currentCount >= 2) {
                      toast.error("O plano Plus permite criar apenas 1 perfil adicional. Mude para o plano Família para ter até 5.");
                      return;
                  }       
       if (plan === 'family' && currentCount >= 5) {
           toast.error("Limite de 5 perfis atingido no plano Família.");
           return;
       }

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
      
      // Auto-detect subscription
      if (data.type === 'expense') {
          // 1. Check explicit flag from AI
          if (data.isSubscription) {
             const exists = await subscriptionService.checkSubscriptionExists(userId, data.description);
             if (!exists) {
                 await subscriptionService.addSubscription(userId, {
                     userId,
                     name: data.description,
                     amount: data.amount,
                     category: data.category,
                     billingCycle: 'monthly',
                     status: 'active'
                 });
                 toast.success(`Assinatura "${data.description}" detectada e criada!`);
             }
          } 
          // 2. Check by keyword/regex
          else {
             const detection = detectSubscriptionService(data.description);
             if (detection.isSubscription) {
                 const exists = await subscriptionService.checkSubscriptionExists(userId, detection.name || data.description);
                 if (!exists) {
                     await subscriptionService.addSubscription(userId, {
                         userId,
                         name: detection.name || data.description,
                         amount: data.amount,
                         category: detection.category || data.category,
                         billingCycle: 'monthly',
                         status: 'active'
                     });
                     toast.success(`Assinatura "${detection.name}" identificada!`);
                 }
             }
          }
      }

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
         text: "Transação excluída.",
         actionLabel: "Desfazer",
         onAction: () => {
             if (userId) dbService.restoreTransaction(userId, t);
         }
      });
    } catch (e) {
      toast.error("Erro ao remover.");
    }
  };

  const handleUpdateSalary = async (newSalary: number, paymentDay?: number, advanceOptions?: { advanceValue?: number; advancePercent?: number; advanceDay?: number }) => {
    if (userId) {
      await dbService.updateUserProfile(userId, { 
          baseSalary: newSalary, 
          salaryPaymentDay: paymentDay, 
          salaryAdvanceValue: advanceOptions?.advanceValue,
          salaryAdvancePercent: advanceOptions?.advancePercent,
          salaryAdvanceDay: advanceOptions?.advanceDay
      });
      toast.success("Configurações de renda atualizadas.");
    }
  };

  const handleAddExtraIncome = async (amount: number, description: string, status: 'completed' | 'pending' = 'completed', date?: string) => {
    const admin = members.find(m => m.role === 'admin') || members[0];
    if (!admin) return;

    const extraIncome: Omit<Transaction, 'id'> = {
      description: description,
      amount: amount,
      category: 'Trabalho',
      type: 'income',
      date: date || toLocalISODate(),
      status: status,
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

  const handleUpdateReminder = async (reminder: Reminder) => {
    if (!userId) return;
    try {
      await dbService.updateReminder(userId, reminder);
      toast.success("Lembrete atualizado.");
    } catch (e) {
      toast.error("Erro ao atualizar lembrete.");
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
      date: toLocalISODate(),
      category: reminder.category,
      type: reminder.type || 'expense',
      status: 'completed',
      memberId: reminder.memberId
    };

    await dbService.addTransaction(userId, newTransaction);

    if (reminder.isRecurring) {
      const baseDate = (reminder.dueDate || toLocalISODate()) + "T00:00:00";
      const nextDate = new Date(baseDate);
      if (reminder.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else if (reminder.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
      else nextDate.setMonth(nextDate.getMonth() + 1);

      const updatedReminder = { ...reminder, dueDate: toLocalISODate(nextDate) };
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

  const handleAddSubscription = async (sub: Omit<Subscription, 'id'>) => {
    if (!userId) return;
    await subscriptionService.addSubscription(userId, { ...sub, userId });
    toast.success("Assinatura adicionada!");
  };

  const handleUpdateSubscription = async (sub: Subscription) => {
    if (!userId) return;
    await subscriptionService.updateSubscription(userId, sub);
    toast.success("Assinatura atualizada!");
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!userId) return;
    await subscriptionService.deleteSubscription(userId, id);
    toast.success("Assinatura removida!");
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
      case 'investments': return { title: 'Caixinhas', desc: 'Gerencie suas caixinhas e metas financeiras.' };
      case 'fire': return { title: 'Simulador FIRE', desc: 'Planeje sua aposentadoria antecipada com a regra dos 4%.' };
      case 'advisor': return { title: 'Consultor IA', desc: 'Insights focados neste perfil.' };
      case 'budgets': return { title: 'Orçamentos', desc: 'Planejamento e controle de gastos.' };
      case 'subscriptions': return { title: 'Assinaturas', desc: 'Gestão de serviços recorrentes.' };
      case 'connections': return { title: 'Contas Conectadas', desc: 'Bancos vinculados via Open Finance.' };
      default: return { title: 'Controlar+', desc: '' };
    }
  };

  const headerInfo = getHeaderInfo();

  const isLimitReached = useMemo(() => {
    const plan = currentUser?.subscription?.plan || 'starter';
    if (plan !== 'starter') return false;

    if (activeTab === 'budgets') {
      return budgets.length >= 2;
    }
    if (activeTab === 'investments') {
      return investments.length >= 2;
    }
    return false;
  }, [currentUser, activeTab, budgets, investments]);

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

  // --- RENDERING LOGIC FOR LANDING / AUTH ---
  if (!currentUser) {
    if (showInviteLanding) {
        return (
            <>
                <ToastContainer />
                <InviteLanding 
                    ownerName={pendingInvite?.ownerName || 'Alguém'}
                    onAccept={() => setShowInviteLanding(false)}
                />
            </>
        );
    }

    if (showLanding && !pendingTwoFactor) {
      return (
        <>
          <ToastContainer />
          <LandingPage variant={landingVariant} onLogin={() => setShowLanding(false)} />
        </>
      );
    }
    return (
      <>
        <ToastContainer />
        <AuthModal 
            onLogin={(u) => { 
                // Explicit trigger handled by AuthModal calling this, 
                // but we rely on onAuthStateChanged for main logic. 
                // This callback can be used for immediate UI feedback if needed.
            }} 
            onBack={pendingTwoFactor ? undefined : () => setShowLanding(true)}
            isTwoFactorPending={!!pendingTwoFactor}
            onVerifyTwoFactor={handleVerifyTwoFactor}
            onCancelTwoFactor={handleCancelTwoFactor}
            inviteContext={pendingInvite ? { ...pendingInvite, ownerName: pendingInvite.ownerName || 'Alguém' } : null}
        />
      </>
    );
  }

  // --- MAIN APP ---

  return (
    <div className="min-h-screen bg-gray-950 flex text-[#faf9f5] font-sans selection:bg-[#d97757]/30">
      <ToastContainer />
      <InviteAcceptModal 
          isOpen={showInviteModal} 
          onAccept={handleAcceptInvite} 
          onDecline={handleDeclineInvite} 
          ownerName={pendingInvite?.ownerName || 'Alguém'} 
          isProcessing={isProcessingInvite}
      />

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
          userPlan={currentUser?.subscription?.plan || 'starter'}
        />

        {/* Adjusted Container Padding based on Sidebar State */}
        <div className={`flex-1 space-y-6 custom-scrollbar ${isSidebarOpen ? 'px-3 overflow-y-auto' : 'px-2 overflow-visible'}`}>
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
                  active={activeTab === 'credit_cards'}
                  onClick={() => { setActiveTab('credit_cards'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  icon={<CreditCard size={20} />}
                  label="Cartão de Crédito"
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
                  active={activeTab === 'subscriptions'}
                  onClick={() => { setActiveTab('subscriptions'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  icon={<RotateCcw size={20} />}
                  label="Assinaturas"
                  isOpen={isSidebarOpen}
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
                  icon={<Vault size={20} />}
                  label="Caixinhas"
                  isOpen={isSidebarOpen}
                />
                <NavItem
                  active={activeTab === 'fire'}
                  onClick={() => { setActiveTab('fire'); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  icon={<Flame size={20} />}
                  label="FIRE"
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
              isOpen={isSidebarOpen} // Passado a propriedade para controlar a visibilidade do texto
              onItemConnected={handlePluggyItemConnected}
              onSyncComplete={(count) => {
                if (count > 0) {
                  setActiveTab('table');
                }
              }}
              existingAccountsCount={pluggyAccounts.length}
              userPlan={currentUser?.subscription?.plan || 'starter'}
            />
          </div>

          <div className="space-y-1">
            {isSidebarOpen && <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 animate-fade-in opacity-70">Inteligência</p>}

            <NavItem
                active={false}
                onClick={() => setIsWhatsAppOpen(true)}
                icon={<MessageCircle size={20} className="text-[#25D366]" />}
                label="Coinzinha WhatsApp"
                isOpen={isSidebarOpen}
            />

            <button
              onClick={() => setIsAIModalOpen(true)}
              disabled={activeMemberId === 'FAMILY_OVERVIEW'}
              className={`
                  flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 group shadow-lg relative
                  ${activeMemberId === 'FAMILY_OVERVIEW'
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none w-full justify-start'
                  : isSidebarOpen
                    ? 'w-full justify-start bg-[#d97757] text-[#faf9f5] hover:bg-[#c56a4d] shadow-[#d97757]/20'
                    : 'w-full justify-center bg-transparent text-[#d97757] hover:bg-gray-800 shadow-none'
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

          {isSidebarOpen && (
            <div className="px-3 pb-6 mt-auto animate-fade-in">
                <div className="bg-[#363735] border border-[#3A3B39] rounded-xl p-4 flex items-center gap-3 shadow-sm">
                    <div className="text-[#d97757] shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="icon icon-tabler icons-tabler-filled icon-tabler-flask"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 2a1 1 0 0 1 0 2v4.826l3.932 10.814l.034 .077a1.7 1.7 0 0 1 -.002 1.193l-.07 .162a1.7 1.7 0 0 1 -1.213 .911l-.181 .017h-11l-.181 -.017a1.7 1.7 0 0 1 -1.285 -2.266l.039 -.09l3.927 -10.804v-4.823a1 1 0 1 1 0 -2h6zm-2 2h-2v4h2v-4z" /></svg>
                    </div>
                    <p className="text-xs text-gray-300 leading-snug text-left font-medium">
                        Você está navegando na versão Beta (0.1.0) do Controlar<span className="text-[#d97757] font-bold">+</span>
                    </p>
                </div>
            </div>
          )}
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
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors shrink-0"
            >
              <Menu size={20} />
            </button>

          <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1 overflow-hidden">
            <div className="flex flex-col min-w-0 flex-1 overflow-hidden justify-center">
              <div className="flex items-center gap-2">
                <h1 className="text-sm lg:text-2xl font-bold text-[#faf9f5] tracking-tight truncate leading-tight">
                  {headerInfo.title}
                </h1>
                {isLimitReached && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 animate-fade-in">
                    <Lock size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Limite Atingido</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] lg:text-xs text-gray-400 font-medium truncate leading-tight mt-0.5">
                {headerInfo.desc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Dashboard Advanced Filters */}
            {activeTab === 'dashboard' && activeMemberId !== 'FAMILY_OVERVIEW' && (
              <div className="hidden lg:flex items-center gap-2 flex-wrap">
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

                {/* Forecast Dropdown */}
                {filterMode === 'month' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowProjectionMenu(!showProjectionMenu)}
                      className={`
                        h-11 px-4 flex items-center gap-2 rounded-xl transition-all duration-200 font-medium text-sm whitespace-nowrap border
                        ${(projectionSettings.reminders || projectionSettings.subscriptions || projectionSettings.salary)
                          ? 'bg-[#d97757] text-white shadow-lg shadow-[#d97757]/20 border-[#d97757]' 
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border-gray-700'
                        }
                      `}
                      title="Simular saldo futuro"
                    >
                      <Calendar size={16} className={(projectionSettings.reminders || projectionSettings.subscriptions || projectionSettings.salary) ? "animate-pulse" : ""} />
                      Previsão
                      <ChevronDown size={14} className={`transition-transform duration-200 ${showProjectionMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {showProjectionMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowProjectionMenu(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 p-2 animate-dropdown-open">
                           <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2 py-1.5 mb-1">
                              Incluir na Previsão
                           </div>
                           
                           {/* Toggle Lembretes */}
                           <div 
                              onClick={() => setProjectionSettings(prev => ({ ...prev, reminders: !prev.reminders }))}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors group"
                           >
                              <div className="flex items-center gap-2">
                                 <Bell size={14} className="text-gray-400 group-hover:text-white" />
                                 <span className="text-sm text-gray-300 group-hover:text-white font-medium">Lembretes</span>
                              </div>
                              <div className={`w-8 h-4 rounded-full transition-colors relative ${projectionSettings.reminders ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                                 <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${projectionSettings.reminders ? 'translate-x-4' : ''}`}></div>
                              </div>
                           </div>

                           {/* Toggle Assinaturas */}
                           <div 
                              onClick={() => setProjectionSettings(prev => ({ ...prev, subscriptions: !prev.subscriptions }))}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors group"
                           >
                              <div className="flex items-center gap-2">
                                 <RotateCcw size={14} className="text-gray-400 group-hover:text-white" />
                                 <span className="text-sm text-gray-300 group-hover:text-white font-medium">Assinaturas</span>
                              </div>
                              <div className={`w-8 h-4 rounded-full transition-colors relative ${projectionSettings.subscriptions ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                                 <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${projectionSettings.subscriptions ? 'translate-x-4' : ''}`}></div>
                              </div>
                           </div>

                           {/* Toggle Salário */}
                           <div 
                              onClick={() => setProjectionSettings(prev => ({ ...prev, salary: !prev.salary }))}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors group"
                           >
                              <div className="flex items-center gap-2">
                                 <TrendingUp size={14} className="text-gray-400 group-hover:text-white" />
                                 <span className="text-sm text-gray-300 group-hover:text-white font-medium">Salário</span>
                              </div>
                              <div className={`w-8 h-4 rounded-full transition-colors relative ${projectionSettings.salary ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                                 <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${projectionSettings.salary ? 'translate-x-4' : ''}`}></div>
                              </div>
                           </div>
                           
                           {/* Toggle Vale */}
                           <div 
                              onClick={() => setProjectionSettings(prev => ({ ...prev, vale: !prev.vale }))}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors group"
                           >
                              <div className="flex items-center gap-2">
                                 <TrendingUp size={14} className="text-gray-400 group-hover:text-white" />
                                 <span className="text-sm text-gray-300 group-hover:text-white font-medium">Vale</span>
                              </div>
                              <div className={`w-8 h-4 rounded-full transition-colors relative ${projectionSettings.vale ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                                 <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${projectionSettings.vale ? 'translate-x-4' : ''}`}></div>
                              </div>
                           </div>
                        </div>
                      </>
                    )}
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

        {/* Mobile Dashboard Filters */}
        {activeTab === 'dashboard' && activeMemberId !== 'FAMILY_OVERVIEW' && (
          <div className="lg:hidden bg-gray-950/50 backdrop-blur-sm border-b border-gray-800 px-3 py-3 flex items-center gap-3 overflow-x-auto no-scrollbar snap-x">
            {/* Filter Mode */}
            <div className="shrink-0 w-32 snap-start">
              <CustomSelect
                value={filterMode}
                onChange={(v) => setFilterMode(v as any)}
                options={[
                  { value: 'month', label: 'Mensal' },
                  { value: 'year', label: 'Anual' },
                  { value: 'last3', label: '3 Meses' },
                  { value: 'last6', label: '6 Meses' },
                  { value: 'all', label: 'Tudo' }
                ]}
                icon={<Filter size={14} />}
                className="text-xs h-10"
              />
            </div>

            {/* Dynamic Date Picker */}
            {filterMode === 'month' && (
              <div className="shrink-0 w-40 snap-start">
                <CustomMonthPicker
                  value={dashboardDate}
                  onChange={setDashboardDate}
                />
              </div>
            )}

            {filterMode === 'year' && (
              <div className="shrink-0 w-24 snap-start">
                 <CustomSelect
                    value={dashboardYear}
                    onChange={(v) => setDashboardYear(Number(v))}
                    options={Array.from({ length: 5 }, (_, i) => {
                      const y = new Date().getFullYear() - i;
                      return { value: y, label: String(y) };
                    })}
                    icon={<Calendar size={14} />}
                    className="text-xs h-10"
                 />
              </div>
            )}

            {/* Forecast Toggle */}
            {filterMode === 'month' && (
               <div className="relative shrink-0 snap-start">
                 <button
                    onClick={() => setShowProjectionMenu(!showProjectionMenu)}
                    className={`
                      h-10 px-3 flex items-center gap-2 rounded-xl transition-all duration-200 font-bold text-xs whitespace-nowrap border
                      ${(projectionSettings.reminders || projectionSettings.subscriptions) 
                        ? 'bg-[#d97757] text-white shadow-lg shadow-[#d97757]/20 border-[#d97757]' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border-gray-700'
                      }
                    `}
                 >
                    <Calendar size={14} className={(projectionSettings.reminders || projectionSettings.subscriptions) ? "animate-pulse" : ""} />
                    Previsão
                 </button>
               </div>
            )}

            {/* Clear Filters */}
            {(filterMode !== 'month' || dashboardCategory !== '' || dashboardDate !== `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`) && (
                <button
                  onClick={handleResetFilters}
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700 shrink-0 snap-start"
                >
                  <RotateCcw size={14} />
                </button>
            )}
          </div>
        )}

        <div className="p-3 lg:p-6 max-w-7xl mx-auto">

          {/* Subscription Page - High Priority Render */}
          {activeTab === 'subscription' && currentUser ? (
              <div className="fixed inset-0 z-[60] bg-gray-950 overflow-y-auto">
                  <SubscriptionPage 
                      user={currentUser}
                      onBack={() => setActiveTab('dashboard')}
                      onUpdateUser={async (u) => {
                          if (userId) await dbService.updateUserProfile(userId, u);
                      }}
                  />
              </div>
          ) : (
            /* Normal Dashboard Content */
            activeMemberId === 'FAMILY_OVERVIEW' ? (
              <FamilyDashboard
                transactions={transactions}
                members={members}
                goals={familyGoals}
                onAddGoal={handleAddGoal}
                onUpdateGoal={handleUpdateGoal}
                onDeleteGoal={handleDeleteGoal}
                onAddTransaction={handleAddTransaction}
                currentUser={currentUser}
                userId={userId}
                onUpgrade={() => setActiveTab('subscription')}
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
                        paymentDay={currentUser.salaryPaymentDay}
                        advanceValue={currentUser.salaryAdvanceValue}
                        advancePercent={currentUser.salaryAdvancePercent}
                        advanceDay={currentUser.salaryAdvanceDay}
                        onUpdateSalary={handleUpdateSalary}
                        onAddExtra={handleAddExtraIncome}
                        onEditClick={() => {
                          setSettingsInitialTab('finance');
                          setIsSettingsOpen(true);
                        }}
                        isSalaryLaunched={(() => {
                            const today = new Date();
                            const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                            return memberFilteredTransactions.some(t => 
                                t.description === "Salário Mensal" && 
                                t.date.startsWith(currentMonth) &&
                                !t.ignored
                            );
                        })()}
                      />
                    )}
                    <StatsCards 
                      stats={stats} 
                      isLoading={isLoadingData} 
                      accountBalances={accountBalances}
                      toggles={{
                        includeChecking: includeCheckingInStats,
                        setIncludeChecking: setIncludeCheckingInStats,
                        includeCredit: includeCreditCardInStats,
                        setIncludeCredit: setIncludeCreditCardInStats,
                        creditCardUseTotalLimit: creditCardUseTotalLimit,
                        setCreditCardUseTotalLimit: setCreditCardUseTotalLimit,
                        creditCardUseFullLimit: creditCardUseFullLimit,
                        setCreditCardUseFullLimit: setCreditCardUseFullLimit
                      }}
                    />
                    <div className="animate-fade-in space-y-6">
                      <DashboardCharts transactions={reviewedDashboardTransactions} isLoading={isLoadingData} />
                      {filterMode === 'month' && (
                        <FinanceCalendar
                          month={dashboardDate}
                          transactions={dashboardFilteredTransactions}
                          reminders={filteredReminders}
                          isLoading={isLoadingData}
                        />
                      )}
                    </div>
                  </>
                )}

                {activeTab === 'table' && (
                  <div className="h-[calc(100vh-140px)] animate-fade-in">
                    <ExcelTable
                      transactions={checkingTransactions}
                      onDelete={handleDeleteTransaction}
                      onUpdate={handleUpdateTransaction}
                    />
                  </div>
                )}

                {activeTab === 'credit_cards' && (
                  <div className="h-[calc(100vh-140px)] animate-fade-in">
                    <CreditCardTable
                      transactions={creditCardTransactions}
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
                    onUpdateReminder={handleUpdateReminder}
                  />
                )}

                {activeTab === 'subscriptions' && (
                  <Subscriptions
                    subscriptions={subscriptions}
                    transactions={memberFilteredTransactions}
                    onAddSubscription={handleAddSubscription}
                    onUpdateSubscription={handleUpdateSubscription}
                    onDeleteSubscription={handleDeleteSubscription}
                  />
                )}

                {activeTab === 'investments' && (
                  <div className="h-[calc(100vh-280px)] animate-fade-in">
                    <Investments
                      investments={memberInvestments}
                      connectedSavingsAccounts={connectedSavingsAccounts}
                      transactions={savingsTransactions}
                      onAdd={handleAddInvestment}
                      onUpdate={handleUpdateInvestment}
                      onDelete={handleDeleteInvestment}
                      onAddTransaction={handleAddTransaction}
                      userPlan={currentUser?.subscription?.plan || 'starter'}
                    />
                  </div>
                )}

                {activeTab === 'fire' && (
                  <div className="flex-1 space-y-6 animate-fade-in">
                    <FireCalculator
                      netWorth={totalMemberInvestments}
                      averageMonthlySavings={averageMonthlySavings}
                      averageMonthlyExpense={averageMonthlyExpense}
                      userPlan={currentUser?.subscription?.plan || 'starter'}
                      onUpgradeClick={() => {
                        setSettingsInitialTab('plan');
                        setIsSettingsOpen(true);
                      }}
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
                    <div className="">
                      <div className="flex items-center justify-between gap-3">
                        <div>
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
                          existingAccountsCount={pluggyAccounts.length}
                          userPlan={currentUser?.subscription?.plan || 'starter'}
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
                      userId={userId}
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
                      userPlan={currentUser?.subscription?.plan || 'starter'}
                    />
                  </div>
                )}
              </>
            )
          )}
        </div>
      </main>

      <AIChatAssistant
        onAddTransaction={handleAddTransaction}
        transactions={transactions}
        budgets={budgets}
        investments={investments}
        userPlan={currentUser?.subscription?.plan || 'starter'}
        userName={currentUser?.name}
      />

      <AIModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onConfirm={handleAddTransaction}
      />

      <ImportReviewModal
        isOpen={isImportReviewOpen}
        onClose={() => setIsImportReviewOpen(false)}
        onConfirm={handleConfirmImport}
        transactions={importReviewTransactions}
        accountName={importReviewAccountName}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setSettingsInitialTab('profile');
        }}
        user={currentUser}
        onUpdateUser={async (u) => {
          if (userId) await dbService.updateUserProfile(userId, u);
        }}
        transactions={transactions}
        familyGoals={familyGoals}
        investments={investments}
        reminders={reminders}
        connectedAccounts={pluggyAccounts}
        onNavigateToSubscription={() => {
            setIsSettingsOpen(false);
            setActiveTab('subscription');
        }}
        initialTab={settingsInitialTab}
      />

      <WhatsAppConnect 
        isOpen={isWhatsAppOpen} 
        onClose={() => setIsWhatsAppOpen(false)} 
      />
    </div>
  );
};

export default App;
