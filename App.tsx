import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  TrendingUp,
  Plus,
  Calendar,
  Filter,
  Tag,
  X,
  Menu,
  Target,
  Building,
  CreditCard,
  Bell,
  RotateCcw,
  LayoutDashboard,
  Users as UsersIcon,
  MathMaxMin
} from './components/Icons';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel } from './components/Dropdown';
import { Flame, Vault, Lock } from 'lucide-react';
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
import { Sidebar, TabType } from './components/Sidebar';
import { FamilyDashboard } from './components/FamilyDashboard';
import { FamilyOverview } from './components/FamilyOverview';
import { ToastContainer, useToasts } from './components/Toast';
import { GlobalSyncToast } from './components/GlobalSyncToast';
import { TwoFactorPrompt } from './components/TwoFactorPrompt';
import { auth } from './services/firebase';
import { onAuthStateChanged } from "firebase/auth";
import * as dbService from './services/database';
import { verifyTOTP } from './services/twoFactor';
import { CustomSelect, CustomMonthPicker } from './components/UIComponents';
import { NotificationCenter, SystemNotification } from './components/NotificationCenter';
import { Analytics } from '@vercel/analytics/react';
import { AIChatAssistant } from './components/AIChatAssistant';
import { BankConnect } from './components/BankConnect';
import { ConnectedAccounts } from './components/ConnectedAccounts';
import { FireCalculator } from './components/FireCalculator';
import { SubscriptionPage } from './components/SubscriptionPage';
import { usePaymentStatus } from './components/PaymentStatus';
import { InviteAcceptModal } from './components/InviteAcceptModal';
import { InviteLanding } from './components/InviteLanding';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminWaitlist } from './components/AdminWaitlist';
import AdminEmailMessage from './components/AdminEmailMessage';

import { Subscriptions } from './components/Subscriptions';
import * as subscriptionService from './services/subscriptionService';
import * as familyService from './services/familyService';
import { Subscription } from './types';
import { detectSubscriptionService } from './utils/subscriptionDetector';
import { toLocalISODate, toLocalISOString } from './utils/dateUtils';

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

import { GlobalModeModal } from './components/GlobalModeModal';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showGlobalModeModal, setShowGlobalModeModal] = useState<'AUTO' | 'MANUAL' | null>(null);
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
        let ownerName = 'Alguém';
        try {
          const group = await familyService.getFamilyGroup(familyId);
          if (group && group.ownerId) {
            const ownerProfile = await dbService.getUserProfile(group.ownerId);
            if (ownerProfile?.name) ownerName = ownerProfile.name;
          }
        } catch (err) {
          console.log("Ainda não é possível carregar detalhes do grupo (provavelmente não autenticado).");
        }

        setPendingInvite({ token, familyId, ownerName });

        if (!auth.currentUser) {
          setShowInviteLanding(true);
        }
      }
    };
    loadInvite();
  }, [userId]);


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

  // Handle Klavi Callback (Popup Mode)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      // Klavi docs say it returns 'link_id' and 'external_info' on success
      // We also keep 'item_id' and 'code' for backward compatibility/other providers
      const itemId = params.get('link_id') || params.get('item_id') || params.get('code');

      if (itemId && window.opener) {
        console.log("[Popup] Klavi success detected. ID:", itemId);
        // We are inside the popup. Send message to main window and close.
        // Use '*' to allow communication between Localhost (Opener) and Ngrok (Popup)
        window.opener.postMessage({ type: 'KLAVI_SUCCESS', itemId }, '*');
        window.close();
      }
    }
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
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isAdminMode, setIsAdminMode] = useState(false);
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
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [lastSyncMap, setLastSyncMap] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);

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

  // Pro Mode State (Pro = Open Finance integration, Manual = manual entry)
  const [isProMode, setIsProMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_pro_mode');
      return saved !== null ? JSON.parse(saved) : true; // Default to Pro mode
    }
    return true;
  });

  // Persist Pro Mode preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('finances_pro_mode', JSON.stringify(isProMode));
    }
  }, [isProMode]);

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

  const [includeOpenFinanceInStats, setIncludeOpenFinanceInStats] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_include_open_finance');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  // Track which credit cards are enabled for expense calculation (by account ID)
  const [enabledCreditCardIds, setEnabledCreditCardIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_enabled_cc_ids');
      return saved !== null ? JSON.parse(saved) : [];
    }
    return [];
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

  useEffect(() => {
    localStorage.setItem('finances_include_open_finance', JSON.stringify(includeOpenFinanceInStats));
  }, [includeOpenFinanceInStats]);

  useEffect(() => {
    localStorage.setItem('finances_enabled_cc_ids', JSON.stringify(enabledCreditCardIds));
  }, [enabledCreditCardIds]);

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
      setConnectedAccounts([]);
      setLastSyncMap({});
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

        let adminFromClaims = false;
        try {
          const tokenResult = await firebaseUser.getIdTokenResult?.();
          adminFromClaims = !!(tokenResult?.claims?.admin || tokenResult?.claims?.isAdmin);
          const profile = await dbService.getUserProfile(firebaseUser.uid);

          console.log('[Auth] Profile loaded:', {
            profileIsAdmin: profile?.isAdmin,
            adminFromClaims,
            finalIsAdmin: profile?.isAdmin ?? adminFromClaims
          });

          const baseProfile: User = {
            name: firebaseUser.displayName || profile?.name || 'Usuário',
            email: firebaseUser.email || '',
            baseSalary: profile?.baseSalary || 0,
            avatarUrl: profile?.avatarUrl,
            twoFactorEnabled: profile?.twoFactorEnabled,
            twoFactorSecret: profile?.twoFactorSecret,
            isAdmin: profile?.isAdmin ?? adminFromClaims,
            // Include family info to ensure Family Goals work correctly from the start
            familyGroupId: profile?.familyGroupId,
            familyRole: profile?.familyRole
          };

          if (profile?.twoFactorEnabled && profile?.twoFactorSecret) {
            setPendingTwoFactor({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: baseProfile.name,
              profile: { ...profile, isAdmin: profile?.isAdmin ?? adminFromClaims },
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
            baseSalary: 0,
            isAdmin: adminFromClaims
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

    const unsubSubs = subscriptionService.listenToSubscriptions(userId, (data) => {
      setSubscriptions(data);
    });

    const unsubProfile = dbService.listenToUserProfile(userId, (data) => {
      setCurrentUser(prev => {
        if (!prev) return null;

        console.log('[Profile Listener] Profile update received:', {
          prevIsAdmin: prev.isAdmin,
          dataIsAdmin: data.isAdmin,
          willPreserve: data.isAdmin === undefined && prev.isAdmin !== undefined
        });

        // Preserve isAdmin if it was already set and new data doesn't have it
        const updatedUser = { ...prev, ...data };
        // If the new data doesn't have isAdmin defined but prev had it, keep prev's value
        if (data.isAdmin === undefined && prev.isAdmin !== undefined) {
          updatedUser.isAdmin = prev.isAdmin;
        }

        console.log('[Profile Listener] Final user isAdmin:', updatedUser.isAdmin);
        return updatedUser;
      });
    });

    const unsubMembers = dbService.listenToMembers(userId, (data) => {
      if (data.length === 0 && currentUser) {
        const adminMember: Omit<Member, 'id'> = {
          name: currentUser.name,
          avatarUrl: currentUser.avatarUrl || 'bg-gradient-to-br from-purple-600 to-blue-600',
          role: currentUser.familyRole === 'member' ? 'member' : 'admin'
        };
        dbService.addMember(userId, adminMember).then(id => {
          setActiveMemberId(id);
        });
      } else {
        setMembers(data);

        // Self-healing: Ensure local member role matches family role
        if (currentUser.familyRole === 'member') {
          // Find self (simplest heuristic: by name or if list has 1 item)
          // In a robust app, we'd store the linked memberId in user profile
          const me = data.find(m => m.name === currentUser.name) || (data.length === 1 ? data[0] : null);
          if (me && me.role === 'admin') {
            console.log("[App] Correcting member role to 'member' for family guest.");
            dbService.updateMember(userId, { ...me, role: 'member' });
          }
        }

        setActiveMemberId(current => {
          if (current !== 'FAMILY_OVERVIEW' && !data.find(m => m.id === current)) {
            return 'FAMILY_OVERVIEW';
          }
          return current;
        });
      }
    });

    const unsubAccounts = dbService.listenToConnectedAccounts(userId, (data) => {
      setConnectedAccounts(data);
    });

    return () => {
      unsubTx();
      unsubRem();
      unsubProfile();
      unsubMembers();
      unsubBudgets();
      unsubSubs();
      unsubAccounts();
    };
  }, [userId, currentUser?.name]);

  // Family Goals Logic (Shared)
  // If user is part of a family, goals are stored under families/{familyGroupId}/goals
  // Otherwise, goals are stored under users/{userId}/goals
  useEffect(() => {
    if (!userId) return;

    const familyGroupId = currentUser?.familyGroupId;

    console.log('[Family Goals] Setting up goals listener:', {
      userId,
      familyGroupId,
      familyRole: currentUser?.familyRole,
      usingFamilyGoals: !!familyGroupId
    });

    let unsubGoals: () => void;

    if (familyGroupId) {
      // User is part of a family - listen to family's goals collection
      console.log('[Family Goals] Listening to family goals at families/' + familyGroupId + '/goals');
      unsubGoals = dbService.listenToGoalsByGroupId(familyGroupId, (data) => {
        console.log('[Family Goals] Received family goals:', data.length);
        setFamilyGoals(data);
      });
    } else {
      // User is not part of a family - listen to user's own goals
      console.log('[Family Goals] Listening to user goals at users/' + userId + '/goals');
      unsubGoals = dbService.listenToGoals(userId, (data) => {
        console.log('[Family Goals] Received user goals:', data.length);
        setFamilyGoals(data);
      });
    }

    return () => unsubGoals();
  }, [userId, currentUser?.familyGroupId]);

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
        twoFactorSecret: pendingTwoFactor.profile.twoFactorSecret,
        isAdmin: pendingTwoFactor.profile.isAdmin
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

  const handleGlobalManualConfirm = async (keepHistory: boolean) => {
    if (!userId) return;
    try {
      // Immediately signal stop to any running syncs
      localStorage.setItem('finances_pro_mode', 'false');

      // If NOT keeping history ("Começar do Zero"), delete ALL transactions (Manual + Imported)
      // The user requested to wipe everything to start fresh
      if (!keepHistory) {
        await dbService.deleteAllUserTransactions(userId);
        await dbService.deleteAllConnectedAccounts(userId);
        
        // Since we deleted accounts, we can't update them. Just log audit and finish.
        await dbService.addAuditLog(userId, {
            timestamp: new Date().toISOString(),
            action: 'MODE_CHANGE_TO_MANUAL',
            details: {
              previousMode: 'AUTO',
              newMode: 'MANUAL',
              keepHistory: false,
              isGlobal: true
            }
        });
        
        setIsProMode(false);
        setShowGlobalModeModal(null);
        toast.success("Modo Manual ativado. Histórico e conexões apagados. Começando do zero.");
        return; // EXIT HERE
      }

      // Then update each account mode (Only if we KEPT history and thus kept accounts)
      for (const acc of connectedAccounts) {
        if (keepHistory) {
          await dbService.updateConnectedAccountMode(userId, acc.id, 'MANUAL');
        } else {
          // Pass false to skip deleting again per-account since we already deleted all above
          await dbService.resetAccountData(userId, acc.id, 0, false);
        }

        // Register audit event for each account
        await dbService.addAuditLog(userId, {
          timestamp: new Date().toISOString(),
          action: 'MODE_CHANGE_TO_MANUAL',
          accountId: acc.id,
          accountName: acc.name || acc.institution || 'Conta',
          details: {
            previousMode: 'AUTO',
            newMode: 'MANUAL',
            keepHistory,
            isGlobal: true
          }
        });
      }
      setIsProMode(false);
      setShowGlobalModeModal(null);
      toast.success(keepHistory
        ? "Modo Manual ativado. Histórico mantido."
        : "Modo Manual ativado. Histórico apagado, começando do zero."
      );
    } catch (error) {
      console.error("Error switching global manual:", error);
      toast.error("Erro ao mudar para modo manual.");
    }
  };

  const handleGlobalAutoConfirm = async () => {
    if (!userId) return;
    try {
      localStorage.setItem('finances_pro_mode', 'true');
      setIsProMode(true); // Set immediately to prevent auto-recreation of manual data

      // 1. Delete ALL manual transactions (Global wipe of manual data)
      await dbService.deleteAllManualTransactions(userId);

      // 2. Update connected accounts to AUTO mode
      for (const acc of connectedAccounts) {
        await dbService.updateConnectedAccountMode(userId, acc.id, 'AUTO');

        // Register audit event for each account
        await dbService.addAuditLog(userId, {
          timestamp: new Date().toISOString(),
          action: 'MODE_CHANGE_TO_AUTO',
          accountId: acc.id,
          accountName: acc.name || acc.institution || 'Conta',
          details: {
            previousMode: 'MANUAL',
            newMode: 'AUTO',
            isGlobal: true
          }
        });
      }
      
      setShowGlobalModeModal(null);
      toast.success("Modo Automático reativado. Todos os lançamentos manuais foram removidos.");
    } catch (error) {
      console.error("Error switching to global auto:", error);
      toast.error("Erro ao reativar modo automático.");
      setIsProMode(false); // Revert on error
    }
  };

  // --- Filter Logic ---

  // Helper: Get current invoice amount from Bills API
  const getCurrentInvoiceAmount = React.useCallback((account: ConnectedAccount): number => {
    // Priority 1: Use account balance (most reliable for current invoice)
    // The balance field represents the current outstanding amount on the card
    if (account.balance !== undefined && account.balance !== null && account.balance > 0) {
      return account.balance;
    }

    // Priority 2: Try to find upcoming bill from Bills API
    if (account.bills && account.bills.length > 0) {
      const today = new Date();

      // Sort bills by due date (ascending)
      const sortedByDue = [...account.bills].sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

      // Find the next bill to pay (due date is in the future)
      const futureBills = sortedByDue.filter(bill => new Date(bill.dueDate) > today);

      if (futureBills.length > 0) {
        return futureBills[0].totalAmount;
      }

      // If no future bills, get the most recent one
      if (sortedByDue.length > 0) {
        return sortedByDue[sortedByDue.length - 1].totalAmount;
      }
    }

    // Fallback to zero if nothing found
    return 0;
  }, []);

  // NEW: Calculate Account Balances
  const accountBalances = useMemo(() => {
    // Helper to check if an account is a credit card
    const isCreditCard = (a: ConnectedAccount) => {
      const type = (a.type || '').toUpperCase();
      const subtype = (a.subtype || '').toUpperCase();
      const id = (a.id || '').toLowerCase();
      
      return type === 'CREDIT' || 
             type === 'CREDIT_CARD' || 
             subtype === 'CREDIT_CARD' || 
             subtype.includes('CREDIT') ||
             id.includes('_cc_') ||
             id.includes('credit');
    };

    const checkingAccounts = connectedAccounts
      .filter(a => {
        const subtype = (a.subtype || '').toUpperCase();
        const type = (a.type || '').toUpperCase();

        // Excluir poupança (vai para caixinhas) e cartões de crédito
        if (subtype === 'SAVINGS_ACCOUNT' || subtype === 'SAVINGS') return false;
        
        // Use robust credit card check
        if (isCreditCard(a)) return false;

        // Incluir conta corrente (type=CHECKING ou type=BANK com subtype=CHECKING_ACCOUNT)
        if (type === 'CHECKING') return true;
        if (subtype === 'CHECKING_ACCOUNT') return true;
        if (subtype === 'CHECKING') return true;

        // Incluir conta salário e outras contas bancárias
        if (subtype === 'SALARY_ACCOUNT' || subtype === 'SALARY') return true;
        if (subtype === 'PAYMENT_ACCOUNT' || subtype === 'PAYMENT') return true;
        if (subtype === 'INDIVIDUAL') return true; // Conta individual

        // Se for banco sem subtype específico, assume conta corrente
        if (type === 'BANK' && !subtype) return true;

        // Incluir qualquer outro tipo de conta bancária que não foi excluído
        if (type === 'BANK') return true;

        return false;
      });

    const checking = checkingAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    const creditAccounts = connectedAccounts.filter(a => isCreditCard(a));


    const credit = creditAccounts.reduce((acc, a) => ({
      used: acc.used + getCurrentInvoiceAmount(a),
      available: acc.available + (a.availableCreditLimit || 0),
      limit: acc.limit + (a.creditLimit || 0),
      accounts: creditAccounts
    }), { used: 0, available: 0, limit: 0, accounts: [] as ConnectedAccount[] });

    return { checking, checkingAccounts, credit };
  }, [connectedAccounts, getCurrentInvoiceAmount]);

  // AUTO-ENABLE ALL CARDS ON LOAD (Only if user hasn't configured preferences yet)
  useEffect(() => {
     // Check if user has ever configured this preference
     const hasConfigured = localStorage.getItem('finances_enabled_cc_ids') !== null;
     
     // Only auto-enable if NOT configured yet AND we have cards available
     if (!hasConfigured && accountBalances.credit.accounts.length > 0) {
        const allCardIds = accountBalances.credit.accounts.map(a => a.id);
        setEnabledCreditCardIds(allCardIds);
     }
  }, [accountBalances.credit.accounts]);

  // NEW: Filter Savings Accounts
  const connectedSavingsAccounts = useMemo(() => {
    return connectedAccounts.filter(a => 
      a.type === 'SAVINGS' || 
      a.subtype === 'SAVINGS_ACCOUNT' || 
      a.subtype === 'SAVINGS'
    );
  }, [connectedAccounts]);

  // NEW: Account Map for Lookups
  const accountMap = useMemo(() => {
    const map = new Map<string, ConnectedAccount>();
    connectedAccounts.forEach(a => map.set(a.id, a));
    return map;
  }, [connectedAccounts]);

  // 1. Filter by Member (Base filtering) AND Account Mode Visibility

  const memberFilteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply Account Mode Visibility Rules
    filtered = filtered.filter(t => {
      if (!t.accountId) return true; // Manual transaction without account link -> Always show

      const account = accountMap.get(t.accountId);
      if (!account) return true; // Account deleted or not found -> Show (safer)

      const isManualMode = account.connectionMode === 'MANUAL';
      const isAutoTx = !!t.importSource;

      // In Manual Mode: Hide Auto transactions
      // REMOVED to allow "Keep History" to work (show imported data even in manual mode)
      // if (isManualMode && isAutoTx) return false;

      // In Auto Mode: Hide Manual transactions (Strict "No Mixing")
      // REMOVED to allow manual adjustments/historic data to appear
      // if (!isManualMode && !isAutoTx) return false;

      return true;
    });

    if (activeMemberId === 'FAMILY_OVERVIEW') return filtered;
    // Keep unassigned transactions visible for any member (e.g., Pluggy imports before members exist)
    return filtered.filter(t => !t.memberId || t.memberId === activeMemberId);
  }, [transactions, activeMemberId, accountMap]);

  const memberInvestments = useMemo(() => {
    if (activeMemberId === 'FAMILY_OVERVIEW') return investments;
    return investments.filter(inv => inv.memberId === activeMemberId);
  }, [investments, activeMemberId]);

  const totalMemberInvestments = useMemo(() => {
    return memberInvestments.reduce((sum, inv) => sum + inv.currentAmount, 0);
  }, [memberInvestments]);

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

  const dashboardCreditCardTransactions = useMemo(() => {
    return reviewedDashboardTransactions.filter(t => (t.accountType || '').toUpperCase().includes('CREDIT'));
  }, [reviewedDashboardTransactions]);

  const reviewedMemberTransactions = useMemo(() => {
    return memberFilteredTransactions.filter(t => !t.ignored && t.status === 'completed');
  }, [memberFilteredTransactions]);

  // Split transactions by Account Type for different tabs
  const checkingTransactions = useMemo(() => {
    return memberFilteredTransactions.filter(t => {
      // Check linked account first
      if (t.accountId) {
        const account = accountMap.get(t.accountId);
        if (account) {
          const type = (account.type || '').toUpperCase();
          const subtype = (account.subtype || '').toUpperCase();
          const id = (account.id || '').toLowerCase();
          
          const isCredit = type.includes('CREDIT') || 
                           subtype.includes('CREDIT') || 
                           subtype.includes('CARD') ||
                           id.includes('_cc_') ||
                           id.includes('credit');
                           
          const isSavings = type.includes('SAVINGS') || subtype.includes('SAVINGS');
          
          if (isCredit || isSavings) return false;
          // Also exclude investments if needed, but checking usually includes investments as "transfers" unless specified
          if (t.isInvestment) return false; 
          return true;
        }
      }

      const type = (t.accountType || '').toUpperCase();
      return !type.includes('CREDIT') && !type.includes('SAVINGS') && !t.isInvestment;
    });
  }, [memberFilteredTransactions, accountMap]);

  const creditCardTransactions = useMemo(() => {
    return memberFilteredTransactions.filter(t => {
      // Check linked account first
      if (t.accountId) {
        const account = accountMap.get(t.accountId);
        if (account) {
          const type = (account.type || '').toUpperCase();
          const subtype = (account.subtype || '').toUpperCase();
          const id = (account.id || '').toLowerCase();
          
          if (type.includes('CREDIT') || 
              subtype.includes('CREDIT') || 
              subtype.includes('CARD') ||
              id.includes('_cc_') ||
              id.includes('credit')) {
            return true;
          }
        }
      }

      const type = (t.accountType || '').toUpperCase();
      const sourceType = (t as any).sourceType || '';
      const tags = (t as any).tags || [];

      // Match by accountType (legacy/manual entries) OR sourceType/tags (Klavi entries)
      return type.includes('CREDIT') ||
        sourceType === 'credit_card' ||
        tags.includes('Cartão de Crédito');
    });
  }, [memberFilteredTransactions, accountMap]);


  const savingsTransactions = useMemo(() => {
    return memberFilteredTransactions.filter(t => {
      // Check linked account first
      if (t.accountId) {
        const account = accountMap.get(t.accountId);
        if (account) {
          const type = (account.type || '').toUpperCase();
          const subtype = (account.subtype || '').toUpperCase();
          if (type.includes('SAVINGS') || subtype.includes('SAVINGS')) {
            return true;
          }
        }
      }

      const type = (t.accountType || '').toUpperCase();
      return type.includes('SAVINGS') || t.isInvestment;
    });
  }, [memberFilteredTransactions, accountMap]);

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

    // Build a Set of all credit card account IDs for fast lookup
    const creditCardAccountIds = new Set<string>();
    accountMap.forEach((acc) => {
      const type = (acc.subtype || acc.type || "").toUpperCase();
      const isCreditId = acc.id && (acc.id.includes('_cc_') || acc.id.includes('credit'));
      if (type.includes('CREDIT') || isCreditId) {
        creditCardAccountIds.add(acc.id);
      }
    });

    // Build a set of checking/savings account IDs (non-credit card accounts)
    const checkingAccountIds = new Set<string>();
    accountMap.forEach((acc) => {
      if (!creditCardAccountIds.has(acc.id)) {
        checkingAccountIds.add(acc.id);
      }
    });

    const incomeFilter = (t: Transaction) => {
      // Check description for expense patterns - exclude these from income
      const desc = (t.description || '').toUpperCase();
      const isExpenseByDescription =
        desc.includes('ENVIADO') ||
        desc.includes('ENVIADA') ||
        desc.includes('PAG ') ||
        desc.includes('PAGAMENTO') ||
        desc.includes('DEBITO') ||
        desc.includes('DÉBITO') ||
        desc.includes('EMPRESTIMO') ||
        desc.includes('EMPRÉSTIMO') ||
        desc.includes('TRANSFERENCIA ENVIADA') ||
        desc.includes('TRANSFERÊNCIA ENVIADA') ||
        desc.includes('SAQUE') ||
        desc.includes('COMPRA') ||
        desc.includes('TARIFA');

      // Exclude transactions that look like expenses by description
      if (isExpenseByDescription) return false;

      // Consider as income if type is 'income' AND amount is positive (for Open Finance transactions)
      const isIncome = t.type === 'income' && t.amount >= 0;
      if (!isIncome) return false;
      if (t.isInvestment) return false;
      if (t.category.startsWith('Caixinha')) return false;

      // Exclude Internal Transfers
      if (t.category === 'Transferência') return false;

      // EXCLUDE credit card transactions from Income
      const isCreditCardByType = (t.accountType || '').toUpperCase().includes('CREDIT');
      const isCreditCardByAccountId = t.accountId && creditCardAccountIds.has(t.accountId);
      if (isCreditCardByType || isCreditCardByAccountId) return false;

      // Salary Visibility Logic
      if (t.description === "Salário Mensal" && t.date > todayStr && !projectionSettings.salary) {
        return false;
      }
      // Vale Visibility Logic
      if (t.description === "Vale / Adiantamento" && t.date > todayStr && !projectionSettings.vale) {
        return false;
      }

      // Check if this is a checking/savings account transaction
      const isAccountTransaction = (t as any).sourceType === 'account' ||
        (t.accountId && checkingAccountIds.has(t.accountId));

      // Filter Open Finance - check if transaction belongs to Open Finance
      const isOpenFinanceTx = !!(t.importSource || (t as any).providerId || isAccountTransaction);
      if (!includeOpenFinanceInStats && isOpenFinanceTx) return false;

      return true;
    };

    const incomes = reviewedDashboardTransactions.filter(incomeFilter);

    // DEBUG: Log all transactions to see what's coming from Open Finance
    console.log('=== DEBUG DESPESAS ===');
    console.log('includeOpenFinanceInStats:', includeOpenFinanceInStats);
    console.log('Total reviewedDashboardTransactions:', reviewedDashboardTransactions.length);
    console.log('checkingAccountIds:', Array.from(checkingAccountIds));
    console.log('creditCardAccountIds:', Array.from(creditCardAccountIds));

    // Log transactions that have accountId in checkingAccountIds
    const checkingTxs = reviewedDashboardTransactions.filter(t => t.accountId && checkingAccountIds.has(t.accountId));
    console.log('Transações de conta corrente encontradas:', checkingTxs.length);
    
    // DEBUG: Specific check for checking account expenses
    const checkingExpenses = checkingTxs.filter(t => {
       const desc = (t.description || '').toUpperCase();
       const isExpenseByDesc =
        desc.includes('ENVIADO') ||
        desc.includes('ENVIADA') ||
        desc.includes('PAG ') ||
        desc.includes('PAGAMENTO') ||
        desc.includes('DEBITO') ||
        desc.includes('DÉBITO') ||
        desc.includes('EMPRESTIMO') ||
        desc.includes('EMPRÉSTIMO') ||
        desc.includes('TRANSFERENCIA ENVIADA') ||
        desc.includes('TRANSFERÊNCIA ENVIADA') ||
        desc.includes('SAQUE') ||
        desc.includes('COMPRA') ||
        desc.includes('TARIFA');
       
       return t.type === 'expense' || t.amount < 0 || isExpenseByDesc;
    });
    console.log('Despesas reais em conta corrente:', checkingExpenses.length);
    checkingExpenses.slice(0, 5).forEach(t => {
      console.log(`  Checking Expense: "${t.description}" | type: ${t.type} | amount: ${t.amount}`);
    });

    // DEBUG: Raw Transactions Check
    console.log('=== RAW TRANSACTIONS CHECK ===');
    const rawCheckingTxs = transactions.filter(t => 
      t.accountId && 
      (t.accountId.includes('klavi_acc_22518081502090_3402_43346088') || 
       t.accountId.includes('klavi_acc_22518081502090_6710_73468350'))
    );
    console.log('Total Raw Transactions for target accounts:', rawCheckingTxs.length);
    const rawExpenses = rawCheckingTxs.filter(t => t.type === 'expense' || t.amount < 0);
    console.log('Raw Expenses found:', rawExpenses.length);
    rawExpenses.forEach(t => {
       console.log(`  RAW EXPENSE: "${t.description}" | amount: ${t.amount} | date: ${t.date} | ignored: ${t.ignored}`);
    });
    console.log('=== END RAW CHECK ===');

    checkingTxs.slice(0, 10).forEach(t => {
      console.log(`  - "${t.description}" | type: ${t.type} | amount: ${t.amount} | accountId: ${t.accountId} | sourceType: ${(t as any).sourceType} | providerId: ${(t as any).providerId}`);
    });

    // Base Expenses (All types) - Exclude credit card transactions entirely
    // Credit card expenses will be calculated from the invoice amount of enabled cards
    const baseExpenses = reviewedDashboardTransactions.filter(t => {
      // Check description for expense patterns (for transactions that may have wrong type)
      const desc = (t.description || '').toUpperCase();
      const isExpenseByDescription =
        desc.includes('ENVIADO') ||
        desc.includes('ENVIADA') ||
        desc.includes('PAG ') ||
        desc.includes('PAGAMENTO') ||
        desc.includes('DEBITO') ||
        desc.includes('DÉBITO') ||
        desc.includes('EMPRESTIMO') ||
        desc.includes('EMPRÉSTIMO') ||
        desc.includes('TRANSFERENCIA ENVIADA') ||
        desc.includes('TRANSFERÊNCIA ENVIADA') ||
        desc.includes('SAQUE') ||
        desc.includes('COMPRA') ||
        desc.includes('TARIFA');

      // Consider as expense if type is 'expense' OR amount is negative OR description indicates expense
      const isExpense = t.type === 'expense' || t.amount < 0 || isExpenseByDescription;

      // DEBUG: Log why transaction is/isn't considered expense
      if (t.accountId && checkingAccountIds.has(t.accountId)) {
        console.log(`[EXPENSE CHECK] "${t.description}" | type=${t.type} | amount=${t.amount} | isExpenseByDesc=${isExpenseByDescription} | isExpense=${isExpense}`);
      }

      if (!isExpense) return false;
      if (t.isInvestment) return false;
      if (t.category.startsWith('Caixinha')) return false;

      // Check if this is a checking/savings account transaction
      // Either by sourceType or by accountId belonging to a non-credit account
      const isAccountTransaction = (t as any).sourceType === 'account' ||
        (t.accountId && checkingAccountIds.has(t.accountId));

      // Check if it's a credit card transaction
      const isCreditCardByType = (t.accountType || '').toUpperCase().includes('CREDIT');
      const isCreditCardByAccountId = t.accountId && creditCardAccountIds.has(t.accountId);
      const isCreditCardBySource = (t as any).sourceType === 'credit_card' || ((t as any).tags || []).includes('Cartão de Crédito');
      const isCreditCard = isCreditCardByType || isCreditCardByAccountId || isCreditCardBySource;

      // If it's a credit card transaction, exclude it (will be calculated from invoice)
      if (isCreditCard) {
        console.log(`[FILTERED - CREDIT CARD] "${t.description}"`);
        return false;
      }

      // Filter Open Finance - check if transaction belongs to Open Finance
      const isOpenFinanceTx = !!(t.importSource || (t as any).providerId || isAccountTransaction);
      if (!includeOpenFinanceInStats && isOpenFinanceTx) {
        console.log(`[FILTERED - OPEN FINANCE OFF] "${t.description}" | isOpenFinanceTx=${isOpenFinanceTx}`);
        return false;
      }

      console.log(`[INCLUDED AS EXPENSE] "${t.description}" | amount=${t.amount}`);
      return true;
    });

    console.log('baseExpenses encontradas:', baseExpenses.length);
    console.log('=== FIM DEBUG ===');

    const totalIncome = incomes.reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const nonCCSpending = baseExpenses.reduce((acc, t) => acc + Math.abs(t.amount), 0);

    // Calculate Account-level Credit Data (Debt & Limit) - Only for ENABLED cards
    let ccBillsInView = 0;
    let ccTotalLimitInView = 0;

    if (includeOpenFinanceInStats) {
      accountMap.forEach((acc) => {
        const type = (acc.subtype || acc.type || "").toUpperCase();
        const isCredit = type.includes('CREDIT');

        // Only include this card if it's in the enabled list
        if (isCredit && enabledCreditCardIds.includes(acc.id)) {
          ccBillsInView += getCurrentInvoiceAmount(acc);
          ccTotalLimitInView += (acc.creditLimit || 0);
        }
      });
    }

    // Determine Final Credit Card Expense Value for Stats
    // Based on individual card toggles (enabledCreditCardIds)
    let finalCCExpense = 0;
    const hasEnabledCards = enabledCreditCardIds.length > 0;

    // We calculate if there are enabled cards, regardless of the global Open Finance toggle.
    // Explicit selection of a card overrides the global "hide" setting for that specific card.
    if (hasEnabledCards) {
      if (creditCardUseFullLimit) {
        finalCCExpense = ccTotalLimitInView;
      } else {
        // Use the exact same list of accounts as StatsCards
        const allCreditAccounts = accountBalances.credit.accounts || [];

        // 1. Establish stable matching context using ALL-TIME transactions from the memo
        // This ensures Strategy 1 (Index Matching) works identically to StatsCards
        const stableUniqueAccountIds = [...new Set(creditCardTransactions.map(tx => tx.accountId).filter(Boolean))];

        // 2. Filter current view transactions for Credit Cards
        // Note: reviewedDashboardTransactions is filtered by Date AND Category. 
        // StatsCards typically ignores Category for the invoice display, but for the Total Expense stats, 
        // it makes sense to respect the global category filter if applied.
        const currentViewCCTransactions = reviewedDashboardTransactions.filter(t => {
           if ((t.accountType || '').toUpperCase().includes('CREDIT')) return true;
           if (t.accountId && creditCardAccountIds.has(t.accountId)) return true;
           if ((t as any).sourceType === 'credit_card' || ((t as any).tags || []).includes('Cartão de Crédito')) return true;
           return false;
        });

        // 3. Iterate enabled cards and sum their matched transactions
        allCreditAccounts.forEach((card, cardIndex) => {
             if (!enabledCreditCardIds.includes(card.id)) return;

             // Check if Open Finance is disabled and this is an automated account
             const isManual = card.connectionMode === 'MANUAL';
             if (!includeOpenFinanceInStats && !isManual) return;

             // Robust Matching Strategy
             let cardTransactions = currentViewCCTransactions.filter(tx => tx.accountId === card.id);

             if (cardTransactions.length === 0) {
                // Strategy 1: Map by index if counts match (using stable all-time IDs)
                if (stableUniqueAccountIds.length === allCreditAccounts.length && stableUniqueAccountIds.length > 0) {
                   const sortedAccountIds = [...stableUniqueAccountIds].sort();
                   const targetAccountId = sortedAccountIds[cardIndex];
                   cardTransactions = currentViewCCTransactions.filter(tx => tx.accountId === targetAccountId);
                }

                // Strategy 2: Single card fallback
                if (cardTransactions.length === 0 && allCreditAccounts.length === 1) {
                   cardTransactions = currentViewCCTransactions;
                }
             }
             
             let accInvoice = 0;
             if (cardTransactions.length > 0) {
                 accInvoice = cardTransactions.reduce((sum, t) => {
                     if (t.type === 'expense') return sum + Math.abs(t.amount);
                     if (t.type === 'income') return sum - Math.abs(t.amount);
                     return sum;
                 }, 0);
             } else {
                 // Fallback to absolute balance if no transactions found (Aligns with StatsCards)
                 // This fixes issues where negative balances (liabilities) were ignored by getCurrentInvoiceAmount
                 accInvoice = Math.abs(card.balance || 0);
             }
             
             finalCCExpense += Math.max(0, accInvoice);
         });
      }
    }

    // Final Totals
    const totalExpense = finalCCExpense + nonCCSpending;

    // Calculate Balance
    let calculatedBalance = 0;
    if (includeCheckingInStats) {
      calculatedBalance += accountBalances.checking;
    }

    // Subtract CC Liability from Balance (if any cards enabled)
    if (hasEnabledCards) {
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
      creditCardSpending: finalCCExpense
    };
  }, [reviewedDashboardTransactions, projectionSettings, filterMode, dashboardDate, filteredReminders, includeCheckingInStats, includeCreditCardInStats, creditCardUseTotalLimit, creditCardUseFullLimit, accountBalances, dashboardCategory, accountMap, getCurrentInvoiceAmount, includeOpenFinanceInStats, enabledCreditCardIds, creditCardTransactions]);

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
      if (plan === 'family' && currentCount >= 3) {
        toast.error("Limite de 3 perfis atingido no plano Família.");
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
    const familyGroupId = currentUser?.familyGroupId;
    if (familyGroupId) {
      // User is part of a family - save to family's goals collection
      await dbService.addFamilyGoalByGroupId(familyGroupId, goal);
    } else if (userId) {
      // User is not part of a family - save to user's own goals
      await dbService.addFamilyGoal(userId, goal);
    }
    toast.success("Meta criada!");
  };
  const handleUpdateGoal = async (goal: FamilyGoal) => {
    const familyGroupId = currentUser?.familyGroupId;
    if (familyGroupId) {
      await dbService.updateFamilyGoalByGroupId(familyGroupId, goal);
    } else if (userId) {
      await dbService.updateFamilyGoal(userId, goal);
    }
    toast.success("Meta atualizada!");
  };
  const handleDeleteGoal = async (id: string) => {
    const familyGroupId = currentUser?.familyGroupId;
    if (familyGroupId) {
      await dbService.deleteFamilyGoalByGroupId(familyGroupId, id);
    } else if (userId) {
      await dbService.deleteFamilyGoal(userId, id);
    }
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
    
    // Check if it's a connected account (ID usually starts with provider prefix like 'klavi_' or comes from accounts list)
    // We can check if it exists in our connectedAccounts list
    const connectedAcc = connectedAccounts.find(acc => acc.id === investment.id);
    
    if (connectedAcc) {
        // Update connected account (nickname/icon)
        const updatedAccount: ConnectedAccount = {
            ...connectedAcc,
            name: investment.name, // Use the new name as the nickname
            // We might want to store the custom icon too if ConnectedAccount supports it?
            // Assuming ConnectedAccount has 'name' field which we overwrite. 
            // (Original name usually in 'institution' or we can keep original in another field if needed, 
            // but usually users want to rename it).
        };
        await dbService.updateConnectedAccount(userId, updatedAccount);
        toast.success("Apelido da conta atualizado!");
    } else {
        // Standard manual investment update
        await dbService.updateInvestment(userId, investment);
        toast.success("Investimento atualizado!");
    }
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
      case 'table': return { title: 'Movimentações', desc: 'Histórico completo de movimentações.' };
      case 'reminders': return { title: 'Lembretes', desc: 'Organize seus lembretes.' };
      case 'investments': return { title: 'Caixinhas', desc: 'Gerencie suas caixinhas e metas financeiras.' };
      case 'fire': return { title: 'Simulador FIRE', desc: 'Planeje sua aposentadoria antecipada com a regra dos 4%.' };
      case 'advisor': return { title: 'Consultor IA', desc: 'Insights focados neste perfil.' };
      case 'budgets': return { title: 'Metas', desc: 'Planejamento e controle de gastos.' };
      case 'subscriptions': return { title: 'Assinaturas', desc: 'Gestão de serviços recorrentes.' };
      case 'connections': return { title: 'Contas Conectadas', desc: 'Bancos vinculados via Open Finance.' };
      case 'admin_overview': return { title: 'Painel Administrativo', desc: 'Visão geral do sistema.' };
      case 'admin_waitlist': return { title: 'Lista de Espera', desc: 'Gerenciar usuários interessados.' };
      case 'admin_email': return { title: 'Campanhas de Email', desc: 'Criar e enviar mensagens.' };
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
            onAccept={() => {
              setShowInviteLanding(false);
              setShowLanding(false);
            }}
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
      <Analytics />
      <ToastContainer />
      <GlobalSyncToast />
      <InviteAcceptModal
        isOpen={showInviteModal}
        onAccept={handleAcceptInvite}
        onDecline={handleDeclineInvite}
        ownerName={pendingInvite?.ownerName || 'Alguém'}
        isProcessing={isProcessingInvite}
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdminMode={isAdminMode}
        activeMemberId={activeMemberId}
        members={members}
        onSelectMember={setActiveMemberId}
        onAddMember={handleAddMember}
        onDeleteMember={handleDeleteMember}
        userPlan={currentUser?.subscription?.plan || 'starter'}
        isAdmin={currentUser?.isAdmin}
        overdueRemindersCount={overdueRemindersCount}
        onOpenAIModal={() => setIsAIModalOpen(true)}
      />

      {/* Main Content */}

      <main className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} relative main-content-area ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <header className="h-16 lg:h-20 border-b border-gray-800 sticky top-0 z-40 px-3 lg:px-6 flex items-center justify-between gap-2 lg:gap-4">
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
                  <Dropdown>
                    <DropdownTrigger className={`
                        h-11 px-4 flex items-center gap-2 rounded-xl transition-all duration-200 font-medium text-sm whitespace-nowrap border cursor-pointer
                        ${(projectionSettings.reminders || projectionSettings.subscriptions || projectionSettings.salary)
                        ? 'bg-[#d97757] text-white shadow-lg shadow-[#d97757]/20 border-[#d97757]'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border-gray-700'
                      }
                      `}>
                      <Calendar size={16} className={(projectionSettings.reminders || projectionSettings.subscriptions || projectionSettings.salary) ? "animate-pulse" : ""} />
                      Previsão
                      <ChevronDown size={14} className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </DropdownTrigger>

                    <DropdownContent width="w-56" align="right" portal>
                      <DropdownLabel>Incluir na Previsão</DropdownLabel>

                      {/* Toggle Lembretes */}
                      <div
                        onClick={() => setProjectionSettings(prev => ({ ...prev, reminders: !prev.reminders }))}
                        className="flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <Bell size={14} className="text-gray-400 group-hover:text-white" />
                          <span className="text-sm text-gray-300 group-hover:text-white font-medium">Lembretes</span>
                        </div>
                        <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${projectionSettings.reminders ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.reminders ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                      </div>

                      {/* Toggle Assinaturas */}
                      <div
                        onClick={() => setProjectionSettings(prev => ({ ...prev, subscriptions: !prev.subscriptions }))}
                        className="flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <RotateCcw size={14} className="text-gray-400 group-hover:text-white" />
                          <span className="text-sm text-gray-300 group-hover:text-white font-medium">Assinaturas</span>
                        </div>
                        <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${projectionSettings.subscriptions ? 'bg-[#d97757]' : 'bg-gray-700'}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.subscriptions ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                      </div>

                      {/* Toggle Salário */}
                      <div
                        onClick={() => !isProMode && setProjectionSettings(prev => ({ ...prev, salary: !prev.salary }))}
                        className={`flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg transition-colors group ${isProMode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'}`}
                        title={isProMode ? "Gerenciado automaticamente no Modo Auto" : ""}
                      >
                        <div className="flex items-center gap-2">
                          <TrendingUp size={14} className="text-gray-400 group-hover:text-white" />
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-300 group-hover:text-white font-medium">Salário</span>
                            {isProMode && <span className="text-[9px] text-[#d97757]">Automático</span>}
                          </div>
                        </div>
                        <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${isProMode ? 'bg-gray-800' : (projectionSettings.salary ? 'bg-[#d97757]' : 'bg-gray-700')}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.salary || isProMode ? 'translate-x-4' : 'translate-x-0.5'} ${isProMode ? 'opacity-50' : ''}`} />
                        </div>
                      </div>

                      {/* Toggle Vale */}
                      <div
                        onClick={() => !isProMode && setProjectionSettings(prev => ({ ...prev, vale: !prev.vale }))}
                        className={`flex items-center justify-between px-3 py-2.5 mx-1 rounded-lg transition-colors group ${isProMode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'}`}
                        title={isProMode ? "Gerenciado automaticamente no Modo Auto" : ""}
                      >
                        <div className="flex items-center gap-2">
                          <TrendingUp size={14} className="text-gray-400 group-hover:text-white" />
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-300 group-hover:text-white font-medium">Vale</span>
                            {isProMode && <span className="text-[9px] text-[#d97757]">Automático</span>}
                          </div>
                        </div>
                        <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${isProMode ? 'bg-gray-800' : (projectionSettings.vale ? 'bg-[#d97757]' : 'bg-gray-700')}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${projectionSettings.vale || isProMode ? 'translate-x-4' : 'translate-x-0.5'} ${isProMode ? 'opacity-50' : ''}`} />
                        </div>
                      </div>
                    </DropdownContent>
                  </Dropdown>
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
              isAdminMode={isAdminMode}
              onToggleAdminMode={() => {
                const nextMode = !isAdminMode;
                setIsAdminMode(nextMode);
                if (nextMode) {
                  setActiveTab('admin_overview');
                } else {
                  setActiveTab('dashboard');
                }
              }}
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
          ) : activeTab === 'admin_overview' ? (
            <AdminDashboard user={currentUser} />
          ) : activeTab === 'admin_waitlist' ? (
            <AdminWaitlist />
          ) : activeTab === 'admin_email' ? (
            <AdminEmailMessage currentUser={currentUser} />
          ) : (
            /* Normal Dashboard Content */
            activeMemberId === 'FAMILY_OVERVIEW' ? (
              <FamilyOverview
                stats={stats}
                goals={familyGoals}
                isLoading={isLoadingData}
                accountBalances={accountBalances}
                creditCardTransactions={creditCardTransactions}
                dashboardDate={filterMode === 'month' ? dashboardDate : undefined}
                toggles={{
                  includeChecking: includeCheckingInStats,
                  setIncludeChecking: setIncludeCheckingInStats,
                  includeCredit: includeCreditCardInStats,
                  setIncludeCredit: setIncludeCreditCardInStats,
                  creditCardUseTotalLimit: creditCardUseTotalLimit,
                  setCreditCardUseTotalLimit: setCreditCardUseTotalLimit,
                  creditCardUseFullLimit: creditCardUseFullLimit,
                  setCreditCardUseFullLimit: setCreditCardUseFullLimit,
                  includeOpenFinance: includeOpenFinanceInStats,
                  setIncludeOpenFinance: setIncludeOpenFinanceInStats,
                  enabledCreditCardIds: enabledCreditCardIds,
                  setEnabledCreditCardIds: setEnabledCreditCardIds
                }}
                isProMode={isProMode}
                onActivateProMode={() => setIsProMode(true)}
                userPlan={currentUser?.subscription?.plan || 'starter'}
                onUpgradeClick={() => setActiveTab('subscription')}
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
                        estimatedSalary={stats.totalIncome}
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
                        isProMode={isProMode}
                        onToggleProMode={(val) => {
                          if (val) {
                            setShowGlobalModeModal('AUTO');
                          } else {
                            setShowGlobalModeModal('MANUAL');
                          }
                        }}
                        userPlan={currentUser?.subscription?.plan || 'starter'}
                        onUpgradeClick={() => setActiveTab('subscription')}
                        includeOpenFinance={includeOpenFinanceInStats}
                        onToggleOpenFinance={setIncludeOpenFinanceInStats}
                      />
                    )}
                    <StatsCards
                      stats={stats}
                      isLoading={isLoadingData}
                      accountBalances={accountBalances}
                      creditCardTransactions={creditCardTransactions}
                      dashboardDate={filterMode === 'month' ? dashboardDate : undefined}
                      toggles={{
                        includeChecking: includeCheckingInStats,
                        setIncludeChecking: setIncludeCheckingInStats,
                        includeCredit: includeCreditCardInStats,
                        setIncludeCredit: setIncludeCreditCardInStats,
                        creditCardUseTotalLimit: creditCardUseTotalLimit,
                        setCreditCardUseTotalLimit: setCreditCardUseTotalLimit,
                        creditCardUseFullLimit: creditCardUseFullLimit,
                        setCreditCardUseFullLimit: setCreditCardUseFullLimit,
                        includeOpenFinance: includeOpenFinanceInStats,
                        setIncludeOpenFinance: setIncludeOpenFinanceInStats,
                        enabledCreditCardIds: enabledCreditCardIds,
                        setEnabledCreditCardIds: setEnabledCreditCardIds
                      }}
                      isProMode={isProMode}
                      onActivateProMode={() => setIsProMode(true)}
                      userPlan={currentUser?.subscription?.plan || 'starter'}
                      onUpgradeClick={() => setActiveTab('subscription')}
                    />
                    <div className="animate-fade-in space-y-6">
                      <DashboardCharts
                      transactions={reviewedDashboardTransactions}
                      reminders={filteredReminders}
                      stats={stats}
                      dashboardDate={dashboardDate}
                      filterMode={filterMode}
                    />
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
                    <ConnectedAccounts
                      accounts={connectedAccounts}
                      lastSynced={lastSyncMap}
                      userId={userId}
                      isProMode={isProMode}
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

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setSettingsInitialTab('profile');
        }}
        user={currentUser}
        userId={userId || undefined}
        members={members}
        onUpdateUser={async (u) => {
          if (userId) await dbService.updateUserProfile(userId, u);
        }}
        transactions={transactions}
        familyGoals={familyGoals}
        investments={investments}
        reminders={reminders}
        connectedAccounts={connectedAccounts}
        onNavigateToSubscription={() => {
          setIsSettingsOpen(false);
          setActiveTab('subscription');
        }}
        onAddGoal={handleAddGoal}
        onUpdateGoal={handleUpdateGoal}
        onDeleteGoal={handleDeleteGoal}
        onAddTransaction={handleAddTransaction}
        onUpgrade={() => setActiveTab('subscription')}
        initialTab={settingsInitialTab}
      />

      <WhatsAppConnect
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
      />

      {showGlobalModeModal && (
        <GlobalModeModal
          isOpen={!!showGlobalModeModal}
          onClose={() => setShowGlobalModeModal(null)}
          onConfirmManual={handleGlobalManualConfirm}
          onConfirmAuto={handleGlobalAutoConfirm}
          targetMode={showGlobalModeModal}
        />
      )}
    </div>
  );
};

export default App;
