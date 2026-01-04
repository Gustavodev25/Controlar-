import React, { useState, useEffect, useMemo } from 'react';
import { X, Ticket, ChevronRight } from './components/Icons';
import { MessageCircle } from 'lucide-react';
import { Transaction, DashboardStats, User, Reminder, Member, FamilyGoal, Budget, ConnectedAccount, PromoPopup as PromoPopupType } from './types';
import { PromoPopup, PromoPopupData } from './components/PromoPopup';
import { StatsCards } from './components/StatsCards';
import { ExcelTable } from './components/ExcelTable';
import { CreditCardTable } from './components/CreditCardTable';
import { AIModal } from './components/AIModal';
import { AuthModal } from './components/AuthModal';
import { LoginNew } from './components/LoginNew';
import { LandingPage } from './components/LandingPage';
import { PublicChangelog } from './components/PublicChangelog';
import { SettingsModal } from './components/SettingsModal';
import { DashboardCharts } from './components/Charts';
import { Reminders } from './components/Reminders';
import { SalaryManager } from './components/SalaryManager';
import { FinanceCalendar } from './components/FinanceCalendar';
import { Investments, Investment } from './components/Investments';
import { Budgets } from './components/Budgets';
import { Sidebar, TabType } from './components/Sidebar';
import { FamilyDashboard } from './components/FamilyDashboard';
import { FamilyOverview } from './components/FamilyOverview';
import { ToastContainer, useToasts } from './components/Toast';
import { GlobalSyncToast } from './components/GlobalSyncToast';
import { FeedbackBanner } from './components/FeedbackBanner';
import { FeedbackModal } from './components/FeedbackModal';
import { saveSyncProgress, clearSyncProgress } from './utils/syncProgress';
import { TwoFactorPrompt } from './components/TwoFactorPrompt';
import { auth } from './services/firebase';
import { onAuthStateChanged } from "firebase/auth";
import * as dbService from './services/database';
import { verifyTOTP } from './services/twoFactor';
import { SystemNotification } from './components/NotificationCenter';
import { Analytics } from '@vercel/analytics/react';
import { AIChatAssistant } from './components/AIChatAssistant';
import { ConnectedAccounts } from './components/ConnectedAccounts';
import { FireCalculator } from './components/FireCalculator';
import { SubscriptionPage } from './components/SubscriptionPage';
import { ProOnboardingModal } from './components/ProOnboardingModal';
import { BankConnectModal } from './components/BankConnectModal';
import { usePaymentStatus } from './components/PaymentStatus';
import { InviteAcceptModal } from './components/InviteAcceptModal';
import { InviteLanding } from './components/InviteLanding';
import { PostSignupModal } from './components/PostSignupModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminWaitlist } from './components/AdminWaitlist';
import { AdminCoupons } from './components/AdminCoupons';
import { AdminPixels } from './components/AdminPixels';
import { PixelPageViewTracker } from './components/PixelPageViewTracker';
import { AdminFeedbacks } from './components/AdminFeedbacks';
import { Roadmap } from './components/Roadmap';
import { AdminUsers } from './components/AdminUsers';
import { AdminSubscriptions } from './components/AdminSubscriptions';
import { AdminControl } from './components/AdminControl';
import { SupportChat } from './components/SupportChat';
import { AdminSupport } from './components/AdminSupport';
import { AdminChangelog } from './components/AdminChangelog';
import { CategoryManager } from './components/CategoryManager';
import AdminEmailMessage from './components/AdminEmailMessage';
import { Header, FilterMode } from './components/Header';
import { Subscriptions } from './components/Subscriptions';
import * as subscriptionService from './services/subscriptionService';
import * as familyService from './services/familyService';
import { Subscription } from './types';
import { detectSubscriptionService } from './utils/subscriptionDetector';
import { translatePluggyCategory } from './services/openFinanceService';
import { toLocalISODate, toLocalISOString } from './utils/dateUtils';
import { getInvoiceMonthKey } from './services/invoiceCalculator';
import { UAParser } from 'ua-parser-js';
import { API_BASE } from './config/api';
import foguete from './assets/foguete.png';

// Removed FilterMode type definition as it is imported from components/Header

// Helper to capture connection details (runs in background, non-blocking)
const captureDeviceDetails = async (uid: string) => {
  try {
    const parser = new UAParser();
    const result = parser.getResult();

    // Fetch IP and Location with timeout to avoid blocking
    let ip = 'Unknown';
    let location = 'Unknown';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        ip = data.ip || 'Unknown';
        location = `${data.city || 'Desconhecido'}, ${data.region_code || ''}`;
      }
    } catch {
      // silently ignore IP fetch failures or timeouts
    }

    const log = {
      id: crypto.randomUUID(),
      os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`,
      browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`,
      device: result.device.type ? `${result.device.vendor || ''} ${result.device.model || ''}` : 'Desktop',
      ip,
      location,
      timestamp: new Date().toISOString(),
      isCurrent: true
    };

    const updatedLogs = await dbService.logConnection(uid, log);
    return updatedLogs;
  } catch (err) {
    console.error("Error capturing device details:", err);
    return null;
  }
};

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
  const [viewFilter, setViewFilter] = useState<'all' | 'credit_card' | 'savings' | 'checking'>('all');
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
        // Only attempt to fetch details if we are already authenticated.
        // Otherwise, Firestore rules will block the read and throw "Missing permissions".
        // The InviteLanding component handles the unauthenticated case gracefully.
        if (auth.currentUser) {
          try {
            const group = await familyService.getFamilyGroup(familyId);
            if (group && group.ownerId) {
              const ownerProfile = await dbService.getUserProfile(group.ownerId);
              if (ownerProfile?.name) ownerName = ownerProfile.name;
            }
          } catch (err) {
            console.log("Could not fetch family details (likely not authorized yet).");
          }
        }

        setPendingInvite({ token, familyId, ownerName });

        if (!auth.currentUser) {
          setShowInviteLanding(true);
        }
      }
    };
    loadInvite();
  }, [userId]);

  // Automatic Category Fix (One-time migration)
  useEffect(() => {
    if (userId && typeof window !== 'undefined') {
      const hasFixed = localStorage.getItem('fixed_categories_v2');
      if (!hasFixed) {
        console.log('[Auto Fix] Starting category translation...');
        dbService.fixCategoriesForUser(userId).then((count) => {
          console.log(`[Auto Fix] Completed. Updated ${count} transactions.`);
          localStorage.setItem('fixed_categories_v2', 'true');
          if (count > 0) {
            toast.success(`Categorias atualizadas automaticamente (${count} registros).`);
          }
        }).catch(err => console.error('[Auto Fix] Error:', err));
      }
    }
  }, [userId]);


  // Landing variant selector (default waitlist, alt URL unlocks auth landing)
  // Landing variant selector (default waitlist, alt URL unlocks auth landing)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateLandingVariant = () => {
      const params = new URLSearchParams(window.location.search);
      const landingParam = (params.get('landing') || '').toLowerCase();

      const isWaitlist = landingParam === 'waitlist';
      setLandingVariant(isWaitlist ? 'waitlist' : 'auth');
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

      // Successfully upgraded: Enable Auto Mode immediately
      if (planId === 'pro' || planId === 'family') {
        setIsProMode(true);
        // Also force-save to local storage so it persists right away
        localStorage.setItem('finances_pro_mode', 'true');
        // Trigger Pro tutorial after upgrade
        localStorage.setItem('show_pro_tutorial', 'true');
        sessionStorage.removeItem('pro_tutorial_session_seen');
      }
    }
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [subscriptionInitialState, setSubscriptionInitialState] = useState<{ planId?: 'starter' | 'pro' | 'family', couponCode?: string } | undefined>(undefined);
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
    if (typeof window === 'undefined') return 'auth';
    const params = new URLSearchParams(window.location.search);
    const landingParam = (params.get('landing') || '').toLowerCase();

    // Explicitly check for waitlist to keep it as an option if needed, but default to 'auth'
    const isWaitlist = landingParam === 'waitlist';

    return isWaitlist ? 'waitlist' : 'auth';
  });

  const [showChangelog, setShowChangelog] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname === '/changelog';
    }
    return false;
  });

  const [showNewLogin, setShowNewLogin] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname === '/login';
    }
    return false;
  });

  // Handle browser back/forward for URL changes
  useEffect(() => {
    const handlePopState = () => {
      setShowChangelog(window.location.pathname === '/changelog');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const effectivePlan = useMemo(() => {
    const sub = currentUser?.subscription;
    // Only grant plan features if status is strictly 'active'
    if (sub?.status === 'active') return sub.plan;
    return 'starter';
  }, [currentUser]);

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
  const [separateCreditCardTxs, setSeparateCreditCardTxs] = useState<dbService.CreditCardTransaction[]>([]);
  const [isSyncingCards, setIsSyncingCards] = useState(false);
  const [promoPopups, setPromoPopups] = useState<PromoPopupType[]>([]);

  // Refs for auto-sync to access latest values without re-creating interval
  const connectedAccountsRef = React.useRef(connectedAccounts);
  const isSyncingCardsRef = React.useRef(isSyncingCards);
  React.useEffect(() => { connectedAccountsRef.current = connectedAccounts; }, [connectedAccounts]);
  React.useEffect(() => { isSyncingCardsRef.current = isSyncingCards; }, [isSyncingCards]);

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
      return saved !== null ? JSON.parse(saved) : false; // Default to Manual mode for safety
    }
    return false;
  });

  // Persist Pro Mode preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('finances_pro_mode', JSON.stringify(isProMode));
    }
  }, [isProMode]);

  // Force Manual Mode for users on free plan (starter) or canceled/refunded users
  useEffect(() => {
    if (!currentUser) return;

    // Use effectivePlan to account for canceled/refunded users
    const isProOrFamily = effectivePlan === 'pro' || effectivePlan === 'family';

    // Only force downgrade if user doesn't have active pro/family plan
    if (effectivePlan === 'starter' && isProMode) {
      setIsProMode(false);
    }
    // Auto-enable Pro Mode for Pro/Family users if they haven't explicitly set a preference
    else if (isProOrFamily && !isProMode) {
      // Priority: Firebase preference > localStorage > default to Auto
      // If user has dataViewMode set in Firebase, that was already loaded on login
      if (currentUser.dataViewMode) {
        // Firebase preference already applied on login, don't override
        return;
      }
      // Check if user has explicitly turned it off before via localStorage
      const saved = localStorage.getItem('finances_pro_mode');
      if (saved === null) {
        setIsProMode(true);
      }
    }
  }, [currentUser, effectivePlan, isProMode]);

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

  const [cardInvoiceTypes, setCardInvoiceTypes] = useState<Record<string, 'current' | 'next' | 'used_total'>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('finances_card_invoice_types');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch { }
      }
    }
    return {};
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

  // Track if initial preferences were loaded from Firebase (to avoid saving on first load)
  const hasLoadedPreferencesRef = React.useRef(false);

  useEffect(() => {
    localStorage.setItem('finances_include_open_finance', JSON.stringify(includeOpenFinanceInStats));
    // Save to Firebase only after initial load and if user is logged in
    if (hasLoadedPreferencesRef.current && userId) {
      dbService.saveDashboardPreferences(userId, {
        includeOpenFinanceInStats,
        cardInvoiceTypes
      }).catch(console.error);
    }
  }, [includeOpenFinanceInStats]);

  useEffect(() => {
    localStorage.setItem('finances_enabled_cc_ids', JSON.stringify(enabledCreditCardIds));
  }, [enabledCreditCardIds]);

  useEffect(() => {
    localStorage.setItem('finances_card_invoice_types', JSON.stringify(cardInvoiceTypes));
    // Save to Firebase only after initial load and if user is logged in
    if (hasLoadedPreferencesRef.current && userId) {
      dbService.saveDashboardPreferences(userId, {
        includeOpenFinanceInStats,
        cardInvoiceTypes
      }).catch(console.error);
    }
  }, [cardInvoiceTypes]);

  // Member Management State
  const [activeMemberId, setActiveMemberId] = useState<string | 'FAMILY_OVERVIEW'>('FAMILY_OVERVIEW');

  // Enforce "Visão Geral" (Admin Profile) as default view on load
  const hasSetInitialMemberRef = React.useRef(false);
  useEffect(() => {
    if (!hasSetInitialMemberRef.current && members.length > 0) {
      const admin = members.find(m => m.role === 'admin') || members[0];
      if (admin) {
        setActiveMemberId(admin.id);
        hasSetInitialMemberRef.current = true;
      }
    }
  }, [members]);

  // Modals State
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiModalContext, setAiModalContext] = useState<'transaction' | 'reminder'>('transaction');
  const handleOpenAIModal = (context: 'transaction' | 'reminder' = 'transaction') => {
    setAiModalContext(context);
    setIsAIModalOpen(true);
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'plan' | 'badges' | 'data' | 'finance'>('profile');

  // Pro Onboarding State
  const [isProOnboardingOpen, setIsProOnboardingOpen] = useState(false);
  const [isBankConnectModalOpen, setIsBankConnectModalOpen] = useState(false);
  const [isPostSignupModalOpen, setIsPostSignupModalOpen] = useState(false);

  useEffect(() => {
    // Check for new signup flag whenever user is set
    // We don't strictly need to wait for isLoadingData to be false to flip the switch
    if (currentUser) {
      const isNewSignup = localStorage.getItem('is_new_signup') === 'true';
      if (isNewSignup) {
        setIsPostSignupModalOpen(true);
        localStorage.removeItem('is_new_signup');
      }
    }
  }, [currentUser]);

  const handlePostSignupPlan = (plan: 'free' | 'pro') => {
    setIsPostSignupModalOpen(false);
    if (plan === 'pro') {
      setActiveTab('subscription');
    }
    // If free, just close (already done)
  };
  // Logic to Trigger Pro Tutorial for new AND existing users
  useEffect(() => {
    if (isLoadingData || !currentUser) return;

    const checkAndShowTutorial = () => {
      // Logic to Trigger Pro Tutorial
      const isProOrFamily = effectivePlan === 'pro' || effectivePlan === 'family' || currentUser?.isAdmin;

      // 1. Check DB flag
      if (currentUser?.hasSeenProTutorial) return;

      // 2. Check LocalStorage Backup (failsafe)
      // 2. Check LocalStorage Backup (failsafe)
      if (userId) {
        const localSeenKey = `confirmed_pro_tutorial_seen_${userId}`;
        if (localStorage.getItem(localSeenKey) === 'true') {
          // Optionally try to sync to DB if missing
          if (!currentUser.hasSeenProTutorial) {
            dbService.updateUserProfile(userId, { hasSeenProTutorial: true }).catch(console.error);
          }
          return;
        }
      }

      const justUpgraded = localStorage.getItem('show_pro_tutorial') === 'true';

      // Check session storage to avoid spamming on every refresh IF the user hasn't completed it yet
      // This resets when the browser/tab is closed
      const seenInThisSession = sessionStorage.getItem('pro_tutorial_session_seen');

      if (isProOrFamily) {
        if (justUpgraded || !seenInThisSession) {
          setTimeout(() => setIsProOnboardingOpen(true), 1000);

          // Mark seen in session
          sessionStorage.setItem('pro_tutorial_session_seen', 'true');

          // Clear the upgrade trigger if present
          if (justUpgraded) {
            localStorage.removeItem('show_pro_tutorial');
          }
        }
      }
    };

    checkAndShowTutorial();
  }, [effectivePlan, currentUser, isLoadingData, userId]);

  useEffect(() => {
    if (activeMemberId) {
      localStorage.setItem('finances_active_member_id', activeMemberId);
    }
  }, [activeMemberId]);

  const [hasUnreadSupport, setHasUnreadSupport] = useState(false);

  // Monitor unread support messages
  useEffect(() => {
    if (!currentUser || activeTab === 'admin_support') return;

    // Only for users (or admins acting as users, though rarely needed)
    // If Admin is chatting, they see it in AdminSupport
    // We want to notify regular users when Admin replies.

    // 1. Get active ticket
    const unsubTicket = dbService.getUserActiveTicket(currentUser.id || '', (ticketId) => {
      if (!ticketId) {
        setHasUnreadSupport(false);
        return;
      }

      // 2. Listen to messages for that ticket
      const unsubMessages = dbService.listenToTicketMessages(ticketId, (msgs) => {
        // Check if there are any unread messages from 'admin'
        // If I am user, senderType === 'admin' && !read
        const hasUnread = msgs.some(m => m.senderType === 'admin' && !m.read);

        // If chat is OPEN, we assume they are being read (handled by SupportChat component),
        // but here we just reflect the state.
        // Ideally, if chat is open, they are marked read instantly, so hasUnread becomes false.
        setHasUnreadSupport(hasUnread);
      });

      return () => unsubMessages();
    });

    return () => unsubTicket();
  }, [currentUser?.id, activeTab]);

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

  // Update lastSyncMap when connectedAccounts changes
  useEffect(() => {
    const newMap: Record<string, string> = {};
    connectedAccounts.forEach(acc => {
      if (acc.lastUpdated) {
        newMap[acc.id] = acc.lastUpdated;
      }
    });
    setLastSyncMap(newMap);
  }, [connectedAccounts]);

  // State for institution names from Pluggy items
  const [itemConnectorNames, setItemConnectorNames] = useState<Record<string, string>>({});

  // Fetch institution names from items-status API
  useEffect(() => {
    if (!userId || connectedAccounts.length === 0) return;

    const fetchConnectorNames = async () => {
      try {
        const response = await fetch(`${API_BASE}/pluggy/items-status?userId=${userId}`);
        const data = await response.json();
        if (data.success && data.items) {
          const namesMap: Record<string, string> = {};
          data.items.forEach((item: { id: string; connectorName?: string }) => {
            if (item.connectorName) {
              namesMap[item.id] = item.connectorName;
            }
          });
          setItemConnectorNames(namesMap);
        }
      } catch (error) {
        console.error('Error fetching connector names:', error);
      }
    };

    fetchConnectorNames();
  }, [userId, connectedAccounts.length]);

  // Enrich connected accounts with institution names from items-status
  const enrichedConnectedAccounts = useMemo(() => {
    return connectedAccounts.map(acc => {
      // Se já tem institution preenchida, mantém
      if (acc.institution && acc.institution !== 'Banco') {
        return acc;
      }
      // Tenta pegar o nome do connector do mapa
      const connectorName = acc.itemId ? itemConnectorNames[acc.itemId] : null;
      if (connectorName) {
        return { ...acc, institution: connectorName };
      }
      return acc;
    });
  }, [connectedAccounts, itemConnectorNames]);

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

  // Listen for promo popups
  useEffect(() => {
    if (!userId) {
      setPromoPopups([]);
      return;
    }
    const unsub = dbService.listenToPromoPopups(userId, (popups) => {
      setPromoPopups(popups);
    });
    return () => unsub();
  }, [userId]);

  const handleDismissPopup = async (popupId: string) => {
    if (!userId) return;
    await dbService.dismissPromoPopup(userId, popupId);
  };

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



          const baseProfile: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || profile?.name || 'Usuário',
            email: firebaseUser.email || '',
            baseSalary: profile?.baseSalary || 0,
            avatarUrl: profile?.avatarUrl,
            twoFactorEnabled: profile?.twoFactorEnabled,
            twoFactorSecret: profile?.twoFactorSecret,
            isAdmin: profile?.isAdmin ?? adminFromClaims,
            // Include family info to ensure Family Goals work correctly from the start
            familyGroupId: profile?.familyGroupId,
            familyRole: profile?.familyRole,
            subscription: profile?.subscription,
            connectionLogs: profile?.connectionLogs || [],
            dailyConnectionCredits: profile?.dailyConnectionCredits || { date: '', count: 0 },
            createdAt: profile?.createdAt,
            dataViewMode: profile?.dataViewMode
          };

          // Load user's saved data view mode preference from Firebase
          if (profile?.dataViewMode) {
            const savedMode = profile.dataViewMode === 'AUTO';
            setIsProMode(savedMode);
            localStorage.setItem('finances_pro_mode', JSON.stringify(savedMode));
          }

          // Load user's dashboard preferences from Firebase
          if (profile?.dashboardPreferences) {
            if (profile.dashboardPreferences.includeOpenFinanceInStats !== undefined) {
              setIncludeOpenFinanceInStats(profile.dashboardPreferences.includeOpenFinanceInStats);
              localStorage.setItem('finances_include_open_finance', JSON.stringify(profile.dashboardPreferences.includeOpenFinanceInStats));
            }
            if (profile.dashboardPreferences.cardInvoiceTypes) {
              setCardInvoiceTypes(profile.dashboardPreferences.cardInvoiceTypes);
              localStorage.setItem('finances_card_invoice_types', JSON.stringify(profile.dashboardPreferences.cardInvoiceTypes));
            }
          }
          // Mark that initial preferences were loaded (to enable saving on subsequent changes)
          setTimeout(() => {
            hasLoadedPreferencesRef.current = true;
          }, 1000);

          // Fix for old users without createdAt: Backfill with oldest known access
          if (!baseProfile.createdAt) {
            // Try to find the oldest log (last in array for chronological add, or sort explicitly)
            // Connection logs are typically prepended (newest first), so oldest is last.
            const logs = baseProfile.connectionLogs || [];
            const oldestLog = logs.length > 0 ? logs[logs.length - 1] : null;

            // Use oldest log date OR current time if absolutely no history
            const backfillDate = oldestLog?.timestamp || new Date().toISOString();

            baseProfile.createdAt = backfillDate;
            // Update in DB (store in profile)
            dbService.updateUserProfile(firebaseUser.uid, { createdAt: backfillDate }).catch(console.error);
          }

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

          // PERFORMANCE: Set loading false IMMEDIATELY so user sees the app
          setIsLoadingAuth(false);

          // Log connection in background (non-blocking) - updates will come via listener
          captureDeviceDetails(firebaseUser.uid).catch(console.error);
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
          setIsLoadingAuth(false); // PERFORMANCE: Also set loading false on error
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
      // Only set loading false here for logout case (login case handles it earlier)
      if (!firebaseUser) {
        setIsLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Poll for pending subscription status
  useEffect(() => {
    if (userId && currentUser?.subscription?.status === 'pending_payment' && currentUser.subscription.asaasSubscriptionId) {
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/asaas/subscription/${currentUser.subscription!.asaasSubscriptionId}`);
          const data = await res.json();
          if (data.success && data.subscription) {
            if (data.subscription.status === 'ACTIVE') {
              // UPDATE DB to ACTIVE
              const updatedUser = {
                ...currentUser,
                subscription: {
                  ...currentUser.subscription!,
                  status: 'active' as const
                }
              };
              await dbService.updateUserProfile(userId, updatedUser);
              // No need to set state here, the listener will pick it up
              toast.success("Sua assinatura foi confirmada! Aproveite os recursos Pro.");
            }
          }
        } catch (e) {
          console.error("Error checking subscription status", e);
        }
      };

      checkStatus();
    }
  }, [userId, currentUser?.subscription?.status, currentUser?.subscription?.asaasSubscriptionId]);

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

      // Auto-cleanup invalid investments (NaN currentAmount, empty name)
      const hasInvalid = data.some(inv =>
        inv.currentAmount === undefined ||
        inv.currentAmount === null ||
        (typeof inv.currentAmount === 'number' && isNaN(inv.currentAmount)) ||
        !inv.name || inv.name.trim() === ''
      );

      if (hasInvalid) {
        dbService.deleteInvalidInvestments(userId).then(count => {
          if (count > 0) {
            console.log(`[Auto-cleanup] Removed ${count} invalid investments`);
          }
        }).catch(console.error);
      }
    });

    const unsubBudgets = dbService.listenToBudgets(userId, (data) => {
      setBudgets(data);
    });

    const unsubSubs = subscriptionService.listenToSubscriptions(userId, (data) => {
      setSubscriptions(data);
    });

    const unsubProfile = dbService.listenToUserProfile(userId, (data) => {
      setCurrentUser(prev => {
        // If no previous user, try to construct from data or return null if insufficient
        if (!prev) {
          if (data.name) return data as User;
          return null;
        }



        // Merge existing user with new profile data
        const updatedUser = { ...prev, ...data };

        // IMPORTANT: Always use the dailyConnectionCredits from the listener
        // The listener always returns this field (even if empty { date: '', count: 0 })
        // This ensures the UI always has the latest credit count from Firebase
        if (data.dailyConnectionCredits) {
          updatedUser.dailyConnectionCredits = data.dailyConnectionCredits;
        }

        // Preserve isAdmin logic (existing)
        if (data.isAdmin === undefined && prev.isAdmin !== undefined) {
          updatedUser.isAdmin = prev.isAdmin;
        }

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

    const unsubCreditCardTxs = dbService.listenToCreditCardTransactions(userId, (data) => {
      console.log('[DEBUG CC-TX] Transações de cartão carregadas:', {
        count: data.length,
        sample: data.slice(0, 3).map(tx => ({ id: tx.id, date: tx.date, desc: tx.description?.slice(0, 30), cardId: tx.cardId }))
      });
      setSeparateCreditCardTxs(data);
    });


    return () => {
      unsubTx();
      unsubRem();
      unsubProfile();
      unsubMembers();
      unsubBudgets();
      unsubSubs();
      unsubAccounts();
      unsubCreditCardTxs();
    };
  }, [userId, currentUser?.name]);

  // Family Goals Logic (Shared)
  // If user is part of a family, goals are stored under families/{familyGroupId}/goals
  // Otherwise, goals are stored under users/{userId}/goals
  useEffect(() => {
    if (!userId) return;

    const familyGroupId = currentUser?.familyGroupId;



    let unsubGoals: () => void;

    if (familyGroupId) {
      // User is part of a family - listen to family's goals collection
      unsubGoals = dbService.listenToGoalsByGroupId(familyGroupId, (data) => {
        setFamilyGoals(data);
      });
    } else {
      // User is not part of a family - listen to user's own goals
      unsubGoals = dbService.listenToGoals(userId, (data) => {
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
        // Save preference to Firebase for persistence across sessions
        await dbService.saveDataViewMode(userId, 'MANUAL');
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
      // Save preference to Firebase for persistence across sessions
      await dbService.saveDataViewMode(userId, 'MANUAL');
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
      // Save preference to Firebase for persistence across sessions
      await dbService.saveDataViewMode(userId, 'AUTO');

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
    // Priority 1: Check for bills (Bills API) - More accurate for "Invoice Amount"
    if (account.bills && account.bills.length > 0) {
      const today = new Date();

      // Sort bills by due date (ascending)
      const sortedByDue = [...account.bills].sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

      // Find the "current" bill logic:
      // 1. First "OPEN" bill
      // 2. OR First future bill (if no OPEN)
      // 3. Fallback to last known bill
      const openBill = sortedByDue.find(b => b.state === 'OPEN');
      const futureBill = sortedByDue.find(b => new Date(b.dueDate) >= today);
      const targetBill = openBill || futureBill || sortedByDue[sortedByDue.length - 1];

      if (targetBill) {
        const amount = Math.abs(targetBill.totalAmount || 0);
        if (amount > 0) return amount;
      }
    }

    // Priority 2: Use the connected balance (Total Used)
    // This acts as a fallback if bills API is not available or empty
    if (account.balance !== undefined && account.balance !== null) {
      const normalized = Math.abs(account.balance);
      if (normalized > 0) {
        return normalized;
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

    // Use enrichedConnectedAccounts to include institution names
    const checkingAccounts = enrichedConnectedAccounts
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

    const creditAccounts = enrichedConnectedAccounts.filter(a => isCreditCard(a));


    const credit = creditAccounts.reduce((acc, a) => ({
      used: acc.used + getCurrentInvoiceAmount(a),
      available: acc.available + (a.availableCreditLimit || 0),
      limit: acc.limit + (a.creditLimit || 0),
      accounts: creditAccounts
    }), { used: 0, available: 0, limit: 0, accounts: [] as ConnectedAccount[] });

    return { checking, checkingAccounts, credit };
  }, [enrichedConnectedAccounts, getCurrentInvoiceAmount]);

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
    return enrichedConnectedAccounts.filter(a =>
      a.type === 'SAVINGS' ||
      a.subtype === 'SAVINGS_ACCOUNT' ||
      a.subtype === 'SAVINGS'
    );
  }, [enrichedConnectedAccounts]);

  // NEW: Account Map for Lookups
  const accountMap = useMemo(() => {
    const map = new Map<string, ConnectedAccount>();
    enrichedConnectedAccounts.forEach(a => map.set(a.id, a));
    return map;
  }, [enrichedConnectedAccounts]);

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

  // Merge separate credit card transactions with main transactions for Dashboard/Calendar/Categories visibility
  const mergedTransactions = useMemo(() => {
    // 1. Map Separate CC Transactions to Transaction format
    const mappedCCTxs: Transaction[] = separateCreditCardTxs.map(ccTx => ({
      id: ccTx.id,
      date: ccTx.date,
      description: ccTx.description,
      amount: ccTx.amount,
      category: ccTx.category,
      type: ccTx.type,
      status: ccTx.status,
      importSource: ccTx.importSource,
      providerId: ccTx.providerId,
      providerItemId: ccTx.providerItemId,
      invoiceDate: (ccTx as any).invoiceDate,
      invoiceDueDate: (ccTx as any).invoiceDueDate || (ccTx as any).dueDate,
      invoiceMonthKey: (ccTx as any).invoiceMonthKey,
      pluggyBillId: (ccTx as any).pluggyBillId,
      invoiceSource: (ccTx as any).invoiceSource,
      isProjected: (ccTx as any).isProjected,
      pluggyRaw: (ccTx as any).pluggyRaw,
      accountId: ccTx.cardId,
      accountType: 'CREDIT_CARD',
    }));

    // 2. Combine with Member Filtered Transactions
    // Create a Set of existing IDs to prevent duplicates if any CC txs are also in main list
    const existingIds = new Set(memberFilteredTransactions.map(t => t.id));
    const uniqueCCTxs = mappedCCTxs.filter(t => !existingIds.has(t.id));

    const combined = [...memberFilteredTransactions, ...uniqueCCTxs];

    // Sort by date desc
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return combined;
  }, [memberFilteredTransactions, separateCreditCardTxs]);

  // Extract available categories from the filtered transactions
  const availableCategories = useMemo(() => {
    const cats = new Set(mergedTransactions.map(t => t.category));
    return Array.from(cats).sort().map(c => ({ value: c, label: c }));
  }, [mergedTransactions]);

  // 2. Filter by Date/Period AND Category (Dashboard Only)
  const dashboardFilteredTransactions = useMemo(() => {
    // First apply Member filter (using merged list)
    let filtered = mergedTransactions;

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

  // Apply View Filter (Global Settings)
  const filteredDashboardTransactions = useMemo(() => {
    if (viewFilter === 'all') return reviewedDashboardTransactions;
    return reviewedDashboardTransactions.filter(t => {
      if (viewFilter === 'credit_card') {
        const isCredit = !!(t.cardId ||
          (t.accountType || '').toUpperCase().includes('CREDIT') ||
          t.invoiceMonthKey ||
          t.pluggyBillId ||
          (t as any).tags?.includes('Cartão de Crédito'));

        if (!isCredit) return false;
        // Show all credit card transactions when explicitly filtering for them
        // ignoring the "Stats" enabled/disabled toggle to prevent "zeroing out"
        return true;
      }
      if (viewFilter === 'savings') {
        const cat = (t.category || '').toLowerCase();
        return !!(t.isInvestment ||
          cat === 'investimentos' ||
          cat === 'poupança' ||
          cat === 'poupanca' ||
          (t.accountType || '').toUpperCase().includes('SAVINGS'));
      }
      if (viewFilter === 'checking') {
        const isCredit = !!(t.cardId ||
          (t.accountType || '').toUpperCase().includes('CREDIT') ||
          t.invoiceMonthKey ||
          t.pluggyBillId ||
          (t as any).tags?.includes('Cartão de Crédito'));
        if (isCredit) return false;

        const cat = (t.category || '').toLowerCase();
        const isSavings = !!(t.isInvestment ||
          cat === 'investimentos' ||
          cat === 'poupança' ||
          cat === 'poupanca' ||
          (t.accountType || '').toUpperCase().includes('SAVINGS'));
        if (isSavings) return false;

        return true;
      }
      return true;
    });
  }, [reviewedDashboardTransactions, viewFilter, enabledCreditCardIds]);

  const filteredCalendarTransactions = useMemo(() => {
    if (viewFilter === 'all') return dashboardFilteredTransactions;
    return dashboardFilteredTransactions.filter(t => {
      if (viewFilter === 'credit_card') {
        const isCredit = !!(t.cardId ||
          (t.accountType || '').toUpperCase().includes('CREDIT') ||
          t.invoiceMonthKey ||
          t.pluggyBillId ||
          (t as any).tags?.includes('Cartão de Crédito'));

        if (!isCredit) return false;
        // Show all credit card transactions when explicitly filtering for them
        // ignoring the "Stats" enabled/disabled toggle to prevent "zeroing out"
        return true;
      }
      if (viewFilter === 'savings') {
        const cat = (t.category || '').toLowerCase();
        return !!(t.isInvestment ||
          cat === 'investimentos' ||
          cat === 'poupança' ||
          cat === 'poupanca' ||
          (t.accountType || '').toUpperCase().includes('SAVINGS'));
      }
      if (viewFilter === 'checking') {
        const isCredit = !!(t.cardId ||
          (t.accountType || '').toUpperCase().includes('CREDIT') ||
          t.invoiceMonthKey ||
          t.pluggyBillId ||
          (t as any).tags?.includes('Cartão de Crédito'));
        if (isCredit) return false;

        const cat = (t.category || '').toLowerCase();
        const isSavings = !!(t.isInvestment ||
          cat === 'investimentos' ||
          cat === 'poupança' ||
          cat === 'poupanca' ||
          (t.accountType || '').toUpperCase().includes('SAVINGS'));
        if (isSavings) return false;

        return true;
      }
      return true;
    });
  }, [dashboardFilteredTransactions, viewFilter, enabledCreditCardIds]);

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
    // 1. Get credit card transactions from main transactions collection
    const fromMainCollection = memberFilteredTransactions.filter(t => {
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

    // 2. Convert separateCreditCardTxs to Transaction format and merge
    const fromSeparateCollection: Transaction[] = separateCreditCardTxs.map(ccTx => ({
      id: ccTx.id,
      date: ccTx.date,
      description: ccTx.description,
      amount: ccTx.amount,
      category: ccTx.category,
      type: ccTx.type,
      status: ccTx.status,
      importSource: ccTx.importSource,
      providerId: ccTx.providerId,
      providerItemId: ccTx.providerItemId,
      invoiceDate: (ccTx as any).invoiceDate,
      invoiceDueDate: (ccTx as any).invoiceDueDate || (ccTx as any).dueDate,
      invoiceMonthKey: (ccTx as any).invoiceMonthKey,
      pluggyBillId: (ccTx as any).pluggyBillId,
      invoiceSource: (ccTx as any).invoiceSource,
      isProjected: (ccTx as any).isProjected,
      pluggyRaw: (ccTx as any).pluggyRaw,
      accountId: ccTx.cardId, // Map cardId to accountId
      accountType: 'CREDIT_CARD',
    }));

    // 3. Merge and deduplicate by id
    const allCCTransactions = [...fromMainCollection];
    const existingIds = new Set(fromMainCollection.map(t => t.id));

    for (const tx of fromSeparateCollection) {
      if (!existingIds.has(tx.id)) {
        allCCTransactions.push(tx);
      }
    }

    // Sort by date descending
    allCCTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return allCCTransactions;
  }, [memberFilteredTransactions, accountMap, separateCreditCardTxs]);


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
    const currentMonthKey = todayStr.slice(0, 7);
    const isCurrentMonthView = filterMode === 'month' && dashboardDate === currentMonthKey;

    // Build a Set of all credit card account IDs for fast lookup
    // Build a Set of all credit card account IDs for fast lookup directly from the recognized cards
    // This ensures consistency: if it's in the Card Carousel, its transactions are excluded from Base Expenses.
    const creditCardAccountIds = new Set<string>();
    if (accountBalances?.credit?.accounts) {
      accountBalances.credit.accounts.forEach(acc => creditCardAccountIds.add(acc.id));
    }
    // Fallback: Check explicitly for credit types in the map (for detached accounts)
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
      const isCreditCardByAccountId = t.accountId && (creditCardAccountIds.has(t.accountId) || enabledCreditCardIds.includes(t.accountId));
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

      // EXCLUDE checking account transactions from Income if toggle is OFF
      // REMOVED: behavior changed to keep flow stats visible
      // if (!includeCheckingInStats && isAccountTransaction) return false;

      return true;
    };

    const incomes = filteredDashboardTransactions.filter(incomeFilter);

    // Initial filtering for Checking Expenses (Logic kept, logs removed)
    const checkingTxs = filteredDashboardTransactions.filter(t => t.accountId && checkingAccountIds.has(t.accountId));

    // Base Expenses (All types) - Exclude credit card transactions entirely
    const baseExpenses = filteredDashboardTransactions.filter(t => {
      // Check description for expense patterns (for transactions that may have wrong type)
      const desc = (t.description || '').toUpperCase();

      // EXCLUDE internal transfers and credit card payments (prevent double counting)
      const isTransfer =
        desc.includes('TRANSFERENCIA') ||
        desc.includes('TRANSF') ||
        desc.includes('TEV') ||
        desc.includes('DOC/TED') ||
        desc.includes('APLICACAO') ||
        desc.includes('RESGATE');

      const isCreditCardPayment =
        desc.includes('PAGAMENTO FATURA') ||
        desc.includes('PAG FATURA') ||
        desc.includes('PGTO FATURA') ||
        desc.includes('PGTO CARTAO') ||
        desc.includes('PAGTO CARTAO') ||
        desc.includes('CREDIT CARD') ||
        desc.includes('CARTAO DE CREDITO') ||
        desc.includes('FATURA CARTAO') ||
        desc.includes('DEBITO AUT. FATURA') ||
        desc.includes('DEBITO AUTOMATICO FATURA') ||
        desc.includes('PGTO TITULO BANCO') ||
        // Novos padrões para bancos digitais (Inter, Nubank, C6, etc.)
        (desc.includes('PAGAMENTO') && desc.includes('FATURA')) ||
        (desc.includes('PAGAMENTO EFETUADO') && desc.includes('FATURA')) ||
        (desc.includes('PAGAMENTO EFETUADO') && desc.includes('CARTAO')) ||
        (desc.includes('PAG') && desc.includes('FATURA') && desc.includes('CARTAO')) ||
        desc.includes('FATURA INTER') ||
        desc.includes('FATURA NUBANK') ||
        desc.includes('FATURA C6') ||
        desc.includes('FATURA ITAU') ||
        desc.includes('FATURA BRADESCO') ||
        desc.includes('FATURA SANTANDER') ||
        desc.includes('FATURA BB') ||
        desc.includes('FATURA CAIXA') ||
        (t.category && t.category.toUpperCase().includes('FATURA')) ||
        (t.category && t.category.toUpperCase().includes('CARTÃO'));

      if (isTransfer || isCreditCardPayment) return false;
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

      if (!isExpense) return false;
      if (t.isInvestment) return false;
      if (t.category.startsWith('Caixinha')) return false;

      // Check if this is a checking/savings account transaction
      const isAccountTransaction = (t as any).sourceType === 'account' ||
        (t.accountId && checkingAccountIds.has(t.accountId));

      // Check if it's a credit card transaction
      const isCreditCardByType = (t.accountType || '').toUpperCase().includes('CREDIT');
      const isCreditCardByAccountId = t.accountId && (creditCardAccountIds.has(t.accountId) || enabledCreditCardIds.includes(t.accountId));
      const isCreditCardBySource = (t as any).sourceType === 'credit_card' || ((t as any).tags || []).includes('Cartão de Crédito');
      const isCreditCard = isCreditCardByType || isCreditCardByAccountId || isCreditCardBySource;

      // If it's a credit card transaction, exclude it (will be calculated from invoice)
      if (isCreditCard) {
        return false;
      }

      // Filter Open Finance - check if transaction belongs to Open Finance
      const isOpenFinanceTx = !!(t.importSource || (t as any).providerId || isAccountTransaction);
      if (!includeOpenFinanceInStats && isOpenFinanceTx) {
        return false;
      }

      // EXCLUDE checking account transactions from Expenses if toggle is OFF
      // REMOVED: behavior changed to keep flow stats visible
      // if (!includeCheckingInStats && isAccountTransaction) {
      //   return false;
      // }

      return true;
    });

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
        // Note: filteredDashboardTransactions is filtered by Date, Category AND viewFilter.
        // StatsCards typically ignores Category for the invoice display, but for the Total Expense stats,
        // it makes sense to respect the global category filter if applied.
        const currentViewCCTransactions = filteredDashboardTransactions.filter(t => {
          if ((t.accountType || '').toUpperCase().includes('CREDIT')) return true;
          if (t.accountId && creditCardAccountIds.has(t.accountId)) return true;
          if ((t as any).sourceType === 'credit_card' || ((t as any).tags || []).includes('Cartão de Crédito')) return true;
          return false;
        });

        // 3. Iterate enabled cards and sum their matched transactions
        allCreditAccounts.forEach((card, cardIndex) => {
          if (!enabledCreditCardIds.includes(card.id)) return;

          const selectedType = cardInvoiceTypes[card.id] || 'current';
          const isConnectedCard = card.connectionMode !== 'MANUAL';
          const connectedInvoiceAmount = isConnectedCard ? getCurrentInvoiceAmount(card) : Math.abs(card.balance || 0);
          const hasConnectedData = isConnectedCard && (
            (card.balance !== undefined && card.balance !== null) ||
            ((card.bills || []).length > 0)
          );

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

          if (isConnectedCard && hasConnectedData && isCurrentMonthView) {
            accInvoice = connectedInvoiceAmount;
          } else if (cardTransactions.length > 0) {
            accInvoice = cardTransactions.reduce((sum, t) => {
              if (t.type === 'expense') return sum + Math.abs(t.amount);
              if (t.type === 'income') return sum - Math.abs(t.amount);
              return sum;
            }, 0);
          } else if (isConnectedCard && hasConnectedData) {
            // If we have connected data but no transactions matched (or we're viewing another period), use the provider invoice
            accInvoice = connectedInvoiceAmount;
          } else {
            // Fallback to absolute balance if no transactions found (Aligns with StatsCards)
            // This fixes issues where negative balances (liabilities) were ignored by getCurrentInvoiceAmount
            accInvoice = Math.abs(card.balance || 0);
          }

          const currentInvoiceAmount = Math.max(0, accInvoice);

          // Determine next invoice amount from bills when available
          const nextInvoiceAmount = (() => {
            const bills = card.bills || [];
            if (bills.length === 0) return null;

            const today = new Date();
            const sortedBills = [...bills].sort((a, b) =>
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            );

            const currentBill = sortedBills.find(b => {
              const dueDate = new Date(b.dueDate);
              return dueDate >= today || b.state === 'OPEN';
            }) || sortedBills.find(b => b.state === 'OPEN');

            const currentBillIndex = currentBill ? sortedBills.indexOf(currentBill) : -1;
            const nextBill = currentBillIndex >= 0 && currentBillIndex < sortedBills.length - 1
              ? sortedBills[currentBillIndex + 1]
              : null;

            if (nextBill) {
              const amount = Math.abs(nextBill.totalAmount || 0);
              if (amount > 0) return amount;
            }

            return null;
          })();

          // Calculate robust Used Total (matching StatsCards logic)
          let usedTotalValue = 0;
          const hasValidUsedLimit = card.usedCreditLimit !== undefined && card.usedCreditLimit !== null && card.usedCreditLimit >= 0;
          const hasValidCreditLimit = card.creditLimit !== undefined && card.creditLimit !== null && card.creditLimit > 0;
          const hasValidAvailableLimit = card.availableCreditLimit !== undefined && card.availableCreditLimit !== null;

          if (hasValidUsedLimit) {
            usedTotalValue = card.usedCreditLimit!;
          } else if (hasValidCreditLimit && hasValidAvailableLimit) {
            usedTotalValue = Math.max(0, card.creditLimit! - card.availableCreditLimit!);
          } else if (card.balance !== undefined && card.balance !== null && Math.abs(card.balance) > 0) {
            usedTotalValue = Math.abs(card.balance);
          } else {
            usedTotalValue = currentInvoiceAmount;
          }

          const selectedInvoiceAmount = selectedType === 'next' && nextInvoiceAmount !== null
            ? nextInvoiceAmount
            : selectedType === 'used_total'
              ? usedTotalValue
              : currentInvoiceAmount;

          finalCCExpense += selectedInvoiceAmount;
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
        const activeSubscriptions = subscriptions.filter(s => {
          if (s.status !== 'active') return false;
          if (s.billingCycle !== 'monthly') return false;
          if (dashboardCategory && s.category !== dashboardCategory) return false;

          // Se a assinatura foi marcada como paga no mês do dashboard, não inclui nas projeções
          if ((s.paidMonths || []).includes(dashboardDate)) return false;

          return true;
        });

        activeSubscriptions.forEach(s => {
          const alreadyPaid = filteredDashboardTransactions.some(t =>
            (t.type === 'expense' &&
              t.amount === s.amount &&
              t.description.toLowerCase().includes(s.name.toLowerCase())) ||
            (t.paidSubscriptionId === s.id)
          );

          if (!alreadyPaid) {
            projectedExpense += s.amount;
          }
        });
      }

      // Salary Projection
      if (projectionSettings.salary && currentUser?.baseSalary) {
        const salaryTx = filteredDashboardTransactions.find(t => t.type === 'income' && t.description === "Salário Mensal");
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
        const valeTx = filteredDashboardTransactions.find(t => t.type === 'income' && t.description === "Vale / Adiantamento");
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

    // Calculate Final Balance
    let finalBalance = 0;

    if (includeCheckingInStats) {
      // If Checking is Enabled: Balance = Current Funds (API) + Projected Flow
      // We DO NOT add past income/expense because the API balance already includes them.
      // This prevents the "double counting" issue.
      finalBalance = accountBalances.checking + (projectedIncome - projectedExpense);
    } else {
      // If Checking is Disabled: Balance = Net Monthly Flow (Income - Expense)
      finalBalance = finalTotalIncome - finalTotalExpense;
    }
    const finalMonthlySavings = finalTotalIncome - finalTotalExpense;

    return {
      totalIncome: finalTotalIncome,
      totalExpense: finalTotalExpense,
      totalBalance: finalBalance,
      monthlySavings: finalMonthlySavings,
      creditCardSpending: finalCCExpense
    };
  }, [reviewedDashboardTransactions, projectionSettings, filterMode, dashboardDate, filteredReminders, includeCheckingInStats, includeCreditCardInStats, creditCardUseTotalLimit, creditCardUseFullLimit, accountBalances, dashboardCategory, accountMap, getCurrentInvoiceAmount, includeOpenFinanceInStats, enabledCreditCardIds, creditCardTransactions, cardInvoiceTypes, subscriptions]);

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
      const plan = effectivePlan;
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

  // Sync credit card transactions from Pluggy without reconnecting
  // --- SYNC STATUS LISTENER (Real-time Feedback) ---
  useEffect(() => {
    if (!userId) return;

    // Listen to sync status from Firestore
    const unsubscribe = dbService.listenToSyncStatus(userId, (status) => {
      if (!status) return;

      // Only react to updates fresher than 1 minute to avoid stale state on page load
      const updateTime = new Date(status.lastUpdated).getTime();
      const now = Date.now();
      if (now - updateTime > 60000 && status.state !== 'in_progress') {
        return;
      }

      if (status.state === 'in_progress' || status.state === 'pending') {
        setIsSyncingCards(true);
        saveSyncProgress({
          step: status.message,
          current: status.current || 0,
          total: status.total || 100,
          startedAt: updateTime
        });
      } else if (status.state === 'success') {
        // Only show completion if we were syncing (or if it's a very recent auto-sync)
        saveSyncProgress({
          step: status.message,
          current: 100,
          total: 100,
          isComplete: true,
          startedAt: updateTime
        });

        // Auto-close toast
        setTimeout(() => {
          setIsSyncingCards(false);
          clearSyncProgress();
        }, 5000);
      } else if (status.state === 'error') {
        saveSyncProgress({
          step: status.message,
          error: status.details || status.message,
          current: 0,
          total: 100,
          isComplete: true,
          startedAt: updateTime
        });
        setTimeout(() => {
          setIsSyncingCards(false);
          clearSyncProgress();
        }, 5000);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  const handleBulkUpdateTransactions = async (ids: string[], updates: Partial<Transaction>) => {
    if (!userId) return;
    try {
      await dbService.bulkUpdateTransactions(userId, ids, updates);
      toast.success(`${ids.length} lançamentos atualizados!`);
    } catch (error) {
      console.error('Error bulk updating transactions:', error);
      toast.error('Erro ao atualizar lançamentos.');
    }
  };

  const handleBulkUpdateCreditCardTransactions = async (ids: string[], updates: Partial<Transaction>) => {
    if (!userId) return;
    try {
      await dbService.bulkUpdateCreditCardTransactions(userId, ids, updates as any);
      toast.success(`${ids.length} lançamentos de cartão atualizados!`);
    } catch (error) {
      console.error('Error bulk updating credit card transactions:', error);
      toast.error('Erro ao atualizar lançamentos de cartão.');
    }
  };

  const handleSyncOpenFinance = async () => {
    if (!userId || isSyncingCards) return;

    // Get unique itemIds from ALL connected accounts
    const allAccounts = connectedAccounts.filter(acc => !!acc.itemId);
    const itemIds = [...new Set(allAccounts.map(acc => acc.itemId).filter(Boolean))];

    if (itemIds.length === 0) {
      toast.error("Nenhuma conta conectada para sincronizar.");
      return;
    }

    // Set initial local state for immediate feedback
    setIsSyncingCards(true);
    saveSyncProgress({
      step: 'Solicitando atualização...',
      current: 0,
      total: itemIds.length,
      startedAt: Date.now()
    });

    try {
      let triggered = 0;
      for (let i = 0; i < itemIds.length; i++) {
        const itemId = itemIds[i];

        // Call the new Trigger endpoint
        const res = await fetch(`${API_BASE}/pluggy/trigger-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, userId }) // Pass userId for status updates
        });

        if (res.ok) triggered++;
      }

      if (triggered > 0) {
        toast.info("Sincronização solicitada. Aguarde...");
        // The listener will pick up the 'pending'/'in_progress' status from Firestore
      } else {
        throw new Error("Falha ao disparar sincronização.");
      }

    } catch (error) {
      console.error('Sync error:', error);
      toast.error("Erro ao solicitar sincronização.");
      setIsSyncingCards(false);
      clearSyncProgress();
    }
  };

  // Automatic Sync at 00:00 (Midnight)
  useEffect(() => {
    if (!userId || !isProMode) return;

    const checkAndSync = async () => {
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const lastSyncDate = localStorage.getItem('last_auto_sync_date');

      // Check if already ran today
      if (lastSyncDate === todayStr) return;

      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Sync window: 00:00 to 00:05
      if (hours === 0 && minutes < 5) {
        console.log('[Auto Sync] Executing midnight sync...');

        // Mark as done for today immediately to prevent double trigger
        localStorage.setItem('last_auto_sync_date', todayStr);

        // Trigger the standard sync flow
        handleSyncOpenFinance();
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkAndSync, 30 * 1000);

    // Run check immediately on mount
    checkAndSync();

    return () => clearInterval(interval);
  }, [userId, isProMode, connectedAccounts]); // Re-run when accounts change to update closure in handleSyncOpenFinance

  // DEBUG: Manual trigger for auto-sync (bypasses time check)
  const handleDebugSync = async () => {
    if (!userId) {
      console.log('[Debug Sync] Sem userId, abortando');
      toast.error('Usuário não logado');
      return;
    }

    const currentAccounts = connectedAccountsRef.current;
    const currentlySyncing = isSyncingCardsRef.current;

    if (currentlySyncing) {
      console.log('[Debug Sync] Já sincronizando');
      toast.error('Já está sincronizando');
      return;
    }

    const syncAccounts = currentAccounts.filter(acc => !acc.connectionMode || acc.connectionMode === 'AUTO');
    if (syncAccounts.length === 0) {
      console.log('[Debug Sync] Nenhuma conta AUTO');
      toast.error('Nenhuma conta em modo AUTO');
      return;
    }

    const itemIds = [...new Set(syncAccounts.map(acc => acc.itemId).filter(Boolean))];
    if (itemIds.length === 0) {
      console.log('[Debug Sync] Nenhum itemId encontrado');
      toast.error('Nenhum itemId encontrado');
      return;
    }

    console.log('[Debug Sync] Iniciando com', itemIds.length, 'items');
    setIsSyncingCards(true);

    try {
      saveSyncProgress({
        step: '[DEBUG] Sincronização manual...',
        current: 0,
        total: itemIds.length,
        startedAt: Date.now()
      });

      let totalCards = 0;

      for (let i = 0; i < itemIds.length; i++) {
        const itemId = itemIds[i];

        saveSyncProgress({
          step: `[DEBUG] Conexão ${i + 1} de ${itemIds.length}...`,
          current: i,
          total: itemIds.length,
          startedAt: Date.now()
        });

        const response = await fetch(`${API_BASE}/pluggy/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, monthsBack: 12, monthsForward: 1 })
        });

        const data = await response.json();
        if (!response.ok) {
          console.error('[Debug Sync] Erro para item', itemId, data);
          continue;
        }

        // Process each account
        for (const entry of data.accounts || []) {
          if (!entry?.account) continue;

          const account = entry.account;
          const type = (account.type || '').toUpperCase();
          const subtype = (account.subtype || '').toUpperCase();
          const isCredit = type.includes('CREDIT') || subtype.includes('CREDIT');
          const isSavings = type === 'SAVINGS' || subtype === 'SAVINGS' || subtype === 'SAVINGS_ACCOUNT';

          // Update account info
          console.log('[Debug Sync] Atualizando conta:', account.marketingName || account.name, 'Saldo:', account.balance);
          await dbService.addConnectedAccount(userId, {
            id: account.id,
            itemId: account.itemId,
            name: account.marketingName || account.name || 'Conta',
            type: account.type,
            subtype: account.subtype,
            institution: account.connector?.name || 'Banco',
            balance: account.balance ?? 0,
            currency: account.currencyCode || 'BRL',
            lastUpdated: new Date().toISOString(),
            connectionMode: 'AUTO'
          });

          // Process transactions
          for (const tx of entry.transactions || []) {
            const txDate = (tx?.date)?.split('T')[0];
            if (!txDate) continue;

            const rawAmount = Number(tx?.amount || 0);

            if (isCredit) {
              const meta = tx?.creditCardMetadata || {};
              const amount = Math.abs(meta.totalInstallments && meta.totalAmount
                ? (meta.totalAmount / meta.totalInstallments)
                : rawAmount);

              const txData: Omit<dbService.CreditCardTransaction, 'id'> = {
                date: txDate,
                description: tx?.description || 'Lançamento Cartão',
                amount,
                category: translatePluggyCategory(tx?.category),
                type: rawAmount >= 0 ? 'expense' : 'income',
                status: 'completed',
                cardId: account.id,
                cardName: account.name || 'Cartão',
                installmentNumber: meta.installmentNumber || 0,
                totalInstallments: meta.totalInstallments || 0,
                importSource: 'pluggy',
                providerId: tx?.id,
                isProjected: false
              };

              // Use upsert to allow updates
              await dbService.upsertCreditCardTransaction(userId, txData);
              totalCards++;
              console.log('[Debug Sync] Upsert transação cartão:', tx?.description);

            } else {
              const txData: Omit<Transaction, 'id'> = {
                date: txDate,
                description: tx?.description || 'Transação Bancária',
                amount: Math.abs(rawAmount),
                category: translatePluggyCategory(tx?.category),
                type: rawAmount >= 0 ? 'income' : 'expense',
                status: 'completed',
                accountId: account.id,
                accountType: isSavings ? 'SAVINGS' : 'CHECKING_ACCOUNT',
                importSource: 'pluggy',
                providerId: tx?.id
              };

              // Use upsert to allow updates
              await dbService.upsertImportedTransaction(userId, txData);
              totalCards++;
              console.log('[Debug Sync] Upsert transação bancária:', tx?.description);
            }
          }
        }
      }

      const summary = totalCards > 0
        ? `[DEBUG] ${totalCards} novas transações sincronizadas!`
        : '[DEBUG] Nenhuma nova transação encontrada.';
      console.log('[Debug Sync]', summary);
      toast.success(summary);

      saveSyncProgress({
        step: summary,
        current: itemIds.length,
        total: itemIds.length,
        isComplete: true,
        startedAt: Date.now()
      });

      setTimeout(() => clearSyncProgress(), 5000);
    } catch (error) {
      console.error('[Debug Sync] Erro:', error);
      toast.error('Erro na sincronização de debug');
      saveSyncProgress({
        step: 'Erro na sincronização',
        error: 'Falha na sincronização de debug',
        current: 0,
        total: 1,
        isComplete: true,
        startedAt: Date.now()
      });
    } finally {
      setIsSyncingCards(false);
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




  const handleRegularBulkUpdate = async (ids: string[], updates: Partial<Transaction>) => {
    if (!userId) return;
    try {
      await dbService.bulkUpdateTransactions(userId, ids, updates);
      toast.success(`${ids.length} transações atualizadas com sucesso!`);
    } catch (e) {
      console.error("Error bulk updating transactions:", e);
      toast.error("Erro ao atualizar transações.");
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
          if (userId && deleted) dbService.restoreTransaction(userId, deleted);
        }
      });
    } catch (e) {
      toast.error("Erro ao remover.");
    }
  };

  const handleDeleteCreditCardTransaction = async (id: string) => {
    if (!userId) return;
    try {
      await dbService.deleteCreditCardTransaction(userId, id);
    } catch (e) {
      console.error("Error deleting credit card transaction:", e);
    }
  };

  const handleUpdateSalary = async (newSalary: number, paymentDay?: number, advanceOptions?: { advanceValue?: number; advancePercent?: number; advanceDay?: number }, salaryExemptFromDiscounts?: boolean) => {
    if (userId) {
      await dbService.updateUserProfile(userId, {
        baseSalary: newSalary,
        salaryPaymentDay: paymentDay,
        salaryAdvanceValue: advanceOptions?.advanceValue,
        salaryAdvancePercent: advanceOptions?.advancePercent,
        salaryAdvanceDay: advanceOptions?.advanceDay,
        salaryExemptFromDiscounts: salaryExemptFromDiscounts
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

    // Só lança transação no modo Manual
    // No modo Auto, as transações vêm automaticamente do banco
    if (!isProMode) {
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
    }

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
      // Update connected account (nickname)
      await dbService.updateConnectedAccount(userId, connectedAcc.id, { name: investment.name });
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

  const handlePaySubscription = async (sub: Subscription) => {
    if (!userId) return;

    const now = new Date();
    const filterYear = parseInt(dashboardDate.split('-')[0]);
    const filterMonth = parseInt(dashboardDate.split('-')[1]) - 1;
    const paymentDate = new Date(filterYear, filterMonth, Math.min(now.getDate(), 28));
    const dateStr = toLocalISODate(paymentDate);

    const newTx: Omit<Transaction, 'id'> = {
      description: sub.name,
      amount: sub.amount,
      date: dateStr,
      category: sub.category,
      type: 'expense',
      status: 'completed',
      paidSubscriptionId: sub.id,
      accountId: '',
      accountType: 'CHECKING_ACCOUNT'
    };

    try {
      await dbService.addTransaction(userId, newTx);

      const paidMonths = sub.paidMonths || [];
      if (!paidMonths.includes(dashboardDate)) {
        await subscriptionService.updateSubscription(userId, {
          ...sub,
          paidMonths: [...paidMonths, dashboardDate]
        });
      }

      toast.success("Pagamento registrado!");
    } catch (error) {
      console.error("Error paying subscription:", error);
      toast.error("Erro ao registrar pagamento.");
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!userId) return;
    await subscriptionService.deleteSubscription(userId, id);
    toast.success("Assinatura removida!");
  };

  const isLimitReached = useMemo(() => {
    // Use effectivePlan to ensure canceled/refunded users are treated as starter
    if (effectivePlan !== 'starter') return false;

    if (activeTab === 'budgets') {
      return budgets.length >= 2;
    }
    if (activeTab === 'investments') {
      return investments.length >= 2;
    }
    return false;
  }, [effectivePlan, activeTab, budgets, investments]);

  if (isLoadingAuth) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin"></div>
    </div>
  }



  if (showNewLogin) {
    return <LoginNew />;
  }

  if (showChangelog) {
    return (
      <PublicChangelog
        onBack={() => {
          // If logged in, go to dashboard, else home
          const target = currentUser ? '/dashboard' : '/';
          window.history.pushState({}, '', target);
          setShowChangelog(false);
        }}
      />
    );
  }

  // --- RENDERING LOGIC FOR LANDING / AUTH ---
  if (!currentUser) {

    if (showInviteLanding) {
      return (
        <>
          <PixelPageViewTracker activeTab="invite-landing" />
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
          <PixelPageViewTracker activeTab={`landing-${landingVariant}`} />
          <ToastContainer />
          <LandingPage variant={landingVariant} onLogin={() => setShowLanding(false)} />
        </>
      );
    }
    return (
      <>
        <PixelPageViewTracker activeTab="auth" />
        <ToastContainer />
        <LoginNew />
      </>
    );
  }

  // --- MAIN APP ---

  return (
    <div className="min-h-screen bg-gray-950 flex text-[#faf9f5] font-sans selection:bg-[#d97757]/30">
      <Analytics />

      <ToastContainer />
      <GlobalSyncToast />
      <PixelPageViewTracker activeTab={activeTab} />
      <ToastContainer />
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
        userPlan={effectivePlan}
        isAdmin={currentUser?.isAdmin}
        overdueRemindersCount={overdueRemindersCount}
        onOpenAIModal={() => handleOpenAIModal('transaction')}
        onOpenFeedback={() => setIsFeedbackModalOpen(true)}
        onOpenSupport={() => setIsSupportChatOpen(true)}
        hasUnreadSupport={hasUnreadSupport}
        isProMode={isProMode}
      />


      {/* Main Content */}
      <main className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} relative main-content-area ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${activeTab === 'chat' ? 'flex flex-col h-screen overflow-hidden' : ''}`}>
        <Header
          isSidebarOpen={isSidebarOpen}
          setSidebarOpen={setSidebarOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeMemberId={activeMemberId}
          members={members}
          currentUser={currentUser}
          isLimitReached={isLimitReached}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          dashboardDate={dashboardDate}
          setDashboardDate={setDashboardDate}
          dashboardYear={dashboardYear}
          setDashboardYear={setDashboardYear}
          dashboardCategory={dashboardCategory}
          projectionSettings={projectionSettings}
          setProjectionSettings={setProjectionSettings}
          isProMode={isProMode}
          showProjectionMenu={showProjectionMenu}
          setShowProjectionMenu={setShowProjectionMenu}
          onResetFilters={handleResetFilters}
          reminders={reminders}
          budgets={budgets}
          transactions={transactions}
          subscriptions={subscriptions}
          notifications={notifications}
          onArchiveNotification={handleArchiveNotification}
          onDeleteNotification={handleDeleteNotification}
          onMarkReadNotification={handleMarkReadNotification}
          isAdminMode={isAdminMode}
          setIsAdminMode={setIsAdminMode}
          setIsSettingsOpen={setIsSettingsOpen}
          onLogout={() => auth.signOut()}
          onFamilyView={() => setActiveMemberId('FAMILY_OVERVIEW')}
          onBackToProfile={() => {
            const admin = members.find(m => m.role === 'admin') || members[0];
            if (admin) setActiveMemberId(admin.id);
          }}
          isInFamilyView={activeMemberId === 'FAMILY_OVERVIEW'}
          showFamilyOption={effectivePlan === 'family'}
          userId={userId}
          hasConnectedAccounts={connectedAccounts.length > 0}
        />

        {/* Feedback Banner - Only on Dashboard */}
        {activeTab === 'dashboard' && (
          <FeedbackBanner
            userEmail={currentUser?.email}
            userName={currentUser?.name}
            userId={userId || undefined}
          />
        )}

        <div className={activeTab === 'chat' ? "flex-1 overflow-hidden relative" : activeTab === 'credit_cards' || activeTab === 'table' ? "p-3 lg:p-6" : activeTab === 'admin_support' ? "h-[calc(100vh-80px)] overflow-hidden" : "p-3 lg:p-6 max-w-7xl mx-auto"}>

          {/* Subscription Page - High Priority Render */}
          {activeTab === 'subscription' && currentUser ? (
            <div className="fixed inset-0 z-[60] bg-gray-950 overflow-y-auto">
              <SubscriptionPage
                user={currentUser}
                onBack={() => {
                  setActiveTab('dashboard');
                  setSubscriptionInitialState(undefined);
                }}
                onUpdateUser={async (u) => {
                  if (userId) await dbService.updateUserProfile(userId, u);
                }}
                initialPlanId={subscriptionInitialState?.planId}
                initialCouponCode={subscriptionInitialState?.couponCode}
              />
            </div>
          ) : activeTab === 'admin_overview' ? (
            <AdminDashboard user={currentUser} />
          ) : activeTab === 'admin_waitlist' ? (
            <AdminWaitlist />
          ) : activeTab === 'admin_email' ? (
            <AdminEmailMessage currentUser={currentUser} />
          ) : activeTab === 'admin_coupons' ? (
            <AdminCoupons />
          ) : activeTab === 'admin_pixels' ? (
            <AdminPixels />
          ) : activeTab === 'admin_feedbacks' ? (
            <AdminFeedbacks />
          ) : activeTab === 'admin_support' ? (
            <AdminSupport currentUser={currentUser} />
          ) : activeTab === 'admin_changelog' ? (
            <AdminChangelog />
          ) : activeTab === 'admin_control' || activeTab === 'admin_users' || activeTab === 'admin_subscriptions' ? (
            <AdminControl />
          ) : (
            /* Normal Dashboard Content */
            /* Normal Dashboard Content */
            <>
              {activeTab === 'dashboard' && (
                <>

                  {/* Promo Banner - New Year */}
                  {effectivePlan === 'starter' && (
                    <div
                      onClick={() => {
                        setSubscriptionInitialState({ planId: 'pro', couponCode: 'FELIZ2026' });
                        setActiveTab('subscription');
                      }}
                      className="relative overflow-hidden rounded-xl bg-[#30302E] border border-[#373734] p-4 mb-6 cursor-pointer group hover:border-gray-600 transition-colors"
                    >
                      <div className="absolute top-0 right-0 -mt-2 -mr-2 opacity-20">
                        <Ticket size={100} className="rotate-12 text-white" />
                      </div>

                      <div className="relative flex flex-col sm:flex-row items-center justify-between h-full">
                        <div className="flex items-center gap-4 w-full">
                          <div className="bg-[#d97757]/10 p-3 rounded-xl text-[#d97757] group-hover:scale-110 transition-transform duration-300 shrink-0">
                            <img src={foguete} alt="Foguete" className="w-6 h-6 object-contain" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-white flex flex-wrap items-center gap-2 text-sm sm:text-base">
                              Promoção de Ano Novo <span className="bg-[#d97757] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">FELIZ2026</span>
                            </h3>
                            <p className="text-gray-400 text-xs sm:text-sm mt-1 leading-snug">
                              Comece 2026 com o pé direito! Assine o plano Pro por apenas <span className="text-emerald-400 font-bold">R$ 9,90</span> no primeiro mês.
                            </p>
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-1 pl-4 border-l border-gray-800 ml-4 shrink-0">
                          <span className="text-sm font-bold text-[#d97757] group-hover:text-orange-400 transition-colors whitespace-nowrap">Resgatar Oferta</span>
                          <ChevronRight size={16} className="text-[#d97757] group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  )}

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
                      salaryExemptFromDiscounts={currentUser.salaryExemptFromDiscounts}
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
                        // Validação extra: Usuários Starter não podem ativar modo AUTO
                        // Use effectivePlan to ensure canceled/refunded users are treated as starter
                        if (effectivePlan === 'starter' && val) {
                          // Ignorar tentativa de ativar Auto para Starter
                          return;
                        }
                        if (val) {
                          setShowGlobalModeModal('AUTO');
                        } else {
                          setShowGlobalModeModal('MANUAL');
                        }
                      }}
                      userPlan={effectivePlan}
                      onUpgradeClick={() => setActiveTab('subscription')}
                      includeOpenFinance={includeOpenFinanceInStats}
                      onToggleOpenFinance={setIncludeOpenFinanceInStats}
                      viewFilter={viewFilter}
                      onViewFilterChange={setViewFilter}
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
                      setEnabledCreditCardIds: setEnabledCreditCardIds,
                      cardInvoiceTypes: cardInvoiceTypes,
                      setCardInvoiceTypes: setCardInvoiceTypes
                    }}

                    isProMode={isProMode}
                    onActivateProMode={() => setIsProMode(true)}
                    userPlan={effectivePlan}
                    onUpgradeClick={() => setActiveTab('subscription')}
                    onPromoClick={() => {
                      setSubscriptionInitialState({ planId: 'pro', couponCode: 'FELIZ2026' });
                      setActiveTab('subscription');
                    }}
                  />                    <div className="animate-fade-in space-y-6">
                    <DashboardCharts
                      transactions={filteredDashboardTransactions}
                      userId={userId || undefined}
                    />
                    {filterMode === 'month' && (
                      <FinanceCalendar
                        month={dashboardDate}
                        transactions={filteredCalendarTransactions}
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
                    isManualMode={!isProMode}
                    onAdd={handleAddTransaction}

                    accounts={accountBalances.checkingAccounts}
                    userId={userId || undefined}
                    onBulkUpdate={handleRegularBulkUpdate}
                  />
                </div>
              )}

              {activeTab === 'credit_cards' && (
                <div className="h-[calc(100vh-140px)] animate-fade-in">
                  <CreditCardTable
                    transactions={creditCardTransactions}
                    onDelete={handleDeleteCreditCardTransaction}
                    onUpdate={handleUpdateTransaction}
                    creditCardAccounts={accountBalances?.credit?.accounts}
                    userId={userId || undefined}
                    onSync={handleSyncOpenFinance}
                    isSyncing={isSyncingCards}
                    isManualMode={!isProMode}
                    onAdd={handleAddTransaction}
                    onUpdateAccount={async (accountId, updates) => {
                      if (!userId) return;
                      await dbService.updateConnectedAccount(userId, accountId, updates);
                    }}
                    onOpenFeedback={() => setIsFeedbackModalOpen(true)}
                    onBulkUpdate={async (ids, updates) => {
                      if (!userId) return;
                      try {
                        await dbService.bulkUpdateCreditCardTransactions(userId, ids, updates as any);
                        toast.success(`${ids.length} transações atualizadas com sucesso!`);
                      } catch (error) {
                        console.error("Error bulk updating credit card transactions:", error);
                        toast.error("Erro ao atualizar transações.");
                      }
                    }}
                  />
                </div>
              )}

              {activeTab === 'categories' && userId && (
                <div className="flex-1 animate-fade-in">
                  <CategoryManager userId={userId} />
                </div>
              )}

              {activeTab === 'reminders' && (
                <Reminders
                  reminders={filteredReminders}
                  onAddReminder={handleAddReminder}
                  onDeleteReminder={handleDeleteReminder}
                  onPayReminder={handlePayReminder}
                  onUpdateReminder={handleUpdateReminder}
                  isProMode={isProMode}
                  userPlan={effectivePlan}
                  onUpgrade={() => setActiveTab('subscription')}
                />
              )}

              {activeTab === 'subscriptions' && (
                <Subscriptions
                  subscriptions={subscriptions}
                  transactions={memberFilteredTransactions}
                  onAddSubscription={handleAddSubscription}
                  onUpdateSubscription={handleUpdateSubscription}
                  onDeleteSubscription={handleDeleteSubscription}
                  currentDate={filterMode === 'month' ? dashboardDate : undefined}
                  isProMode={isProMode}
                  userPlan={effectivePlan}
                  onUpgrade={() => setActiveTab('subscription')}
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
                    userPlan={effectivePlan}
                  />
                </div>
              )}

              {activeTab === 'fire' && (
                <div className="flex-1 space-y-6 animate-fade-in">
                  <FireCalculator
                    netWorth={totalMemberInvestments}
                    averageMonthlySavings={averageMonthlySavings}
                    averageMonthlyExpense={averageMonthlyExpense}
                    userPlan={effectivePlan}
                    onUpgradeClick={() => {
                      setSettingsInitialTab('plan');
                      setIsSettingsOpen(true);
                    }}
                  />
                </div>
              )}


              {activeTab === 'connections' && (
                <div className="flex-1 space-y-6 animate-fade-in">
                  <ConnectedAccounts
                    accounts={enrichedConnectedAccounts}
                    onRefresh={async () => {
                      if (!userId) return;
                      // Force a manual fetch to ensure we have the absolute latest data
                      // Listeners sometimes have a slight delay or race condition with the "completed" status
                      try {
                        const [newTxs, newCcTxs, newAccounts] = await Promise.all([
                          dbService.getTransactions(userId),
                          dbService.getCreditCardTransactions(userId),
                          dbService.getConnectedAccounts(userId)
                        ]);

                        setTransactions(newTxs);
                        setSeparateCreditCardTxs(newCcTxs);
                        setConnectedAccounts(newAccounts);

                        // Also re-fetch item statuses just in case
                        // (Already handled by ConnectedAccounts internally, but good to be safe if moved)

                        setTimeout(() => {
                          toast.success("Dados atualizados!");
                        }, 500);
                      } catch (err) {
                        console.error("Error manual refresh:", err);
                      }
                    }}
                    lastSynced={lastSyncMap}
                    userId={userId}
                    isProMode={isProMode}
                    isAdmin={currentUser?.isAdmin}
                    onDebugSync={handleDebugSync}
                    userPlan={effectivePlan}
                    onUpgrade={() => setActiveTab('subscription')}
                    dailyCredits={currentUser?.dailyConnectionCredits}
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
                    userPlan={effectivePlan}
                  />
                </div>
              )}

              {activeTab === 'roadmap' && (
                <div className="flex-1 p-4 lg:p-8 overflow-y-auto custom-scrollbar animate-fade-in">
                  <Roadmap currentUser={currentUser} userId={userId} />
                </div>
              )}
            </>
          )}
          {activeTab === 'chat' && (
            <div className="h-full animate-fade-in relative z-10">
              <AIChatAssistant
                onAddTransaction={handleAddTransaction}
                onAddReminder={handleAddReminder}
                onAddSubscription={handleAddSubscription}
                transactions={transactions}
                budgets={budgets}
                investments={investments}
                userPlan={effectivePlan}
                userName={currentUser?.name}
                userId={userId || undefined}
                isProMode={isProMode}
                onUpgrade={() => setActiveTab('subscription')}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            </div>
          )}
        </div>
      </main>

      {/* Floating Chat Assistant (Visible on all tabs except 'chat' and admin mode) */}
      {activeTab !== 'chat' && !isAdminMode && (
        <AIChatAssistant
          onAddTransaction={handleAddTransaction}
          onAddReminder={handleAddReminder}
          onAddSubscription={handleAddSubscription}
          transactions={transactions}
          budgets={budgets}
          investments={investments}
          userPlan={effectivePlan}
          userName={currentUser?.name}
          userId={userId || undefined}
          isProMode={isProMode}
          onUpgrade={() => setActiveTab('subscription')}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}



      <AIModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onConfirm={handleAddTransaction}
        onCreateReminder={handleAddReminder}
        initialContext={aiModalContext}
        userPlan={effectivePlan}
        onUpgrade={() => setActiveTab('subscription')}
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
        connectedAccounts={enrichedConnectedAccounts}
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

      <SupportChat
        isOpen={isSupportChatOpen}
        onClose={() => setIsSupportChatOpen(false)}
        userId={userId || ''}
        userEmail={currentUser?.email || ''}
        userName={currentUser?.name || 'User'}
        sidebarOpen={isSidebarOpen}
      />

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        userEmail={currentUser?.email}
        userName={currentUser?.name}
        userId={userId || undefined}
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




      {/* Pro Onboarding Tutorial */}
      <ProOnboardingModal
        isOpen={isProOnboardingOpen}
        onClose={async () => {
          setIsProOnboardingOpen(false);
          // Persist "Has Seen" to Database so it never shows again even if skipped
          if (currentUser && userId) {
            localStorage.setItem(`confirmed_pro_tutorial_seen_${userId}`, 'true');
            try {
              await dbService.updateUserProfile(userId, { hasSeenProTutorial: true });
            } catch (error) {
              console.error("[App] Failed to save tutorial state:", error);
            }
          }
        }}
        userName={currentUser?.name || 'Pro User'}
        onConnectBank={() => setIsBankConnectModalOpen(true)}
        onComplete={async () => {
          setIsProOnboardingOpen(false);
          // Persist "Has Seen" to Database so it never shows again
          if (currentUser && userId) {
            localStorage.setItem(`confirmed_pro_tutorial_seen_${userId}`, 'true');
            console.log('[App] Pro Tutorial Completed. Persisting state to DB.');
            try {
              await dbService.updateUserProfile(userId, { hasSeenProTutorial: true });
            } catch (error) {
              console.error("[App] Failed to save tutorial state:", error);
            }
          }
        }}
        toggles={{
          includeChecking: includeCheckingInStats,
          setIncludeChecking: setIncludeCheckingInStats,
          includeCredit: includeCreditCardInStats,
          setIncludeCredit: setIncludeCreditCardInStats
        }}
        onNavigateTo={(tab) => setActiveTab(tab as any)}
      />

      <BankConnectModal
        isOpen={isBankConnectModalOpen}
        onClose={() => setIsBankConnectModalOpen(false)}
        userId={userId}
        dailyCredits={currentUser?.dailyConnectionCredits}
        userPlan={effectivePlan}
        isAdmin={currentUser?.isAdmin}
        onSuccess={async () => {
          // Success logic is handled by listener updates, but we can show a success message?
          // BankConnectModal usually handles its own toasts.
          setIsBankConnectModalOpen(false);
        }}
      />

      {/* Post Signup Plan Selection Modal */}
      {currentUser && (
        <PostSignupModal
          isOpen={isPostSignupModalOpen}
          onClose={() => setIsPostSignupModalOpen(false)}
          onSelectPlan={handlePostSignupPlan}
          userName={currentUser.name}
        />
      )}

      {/* Promo Popup from Admin */}
      <PromoPopup
        popup={promoPopups.length > 0 ? {
          ...promoPopups[0],
          type: promoPopups[0].type as 'info' | 'promo' | 'update'
        } : null}
        onDismiss={handleDismissPopup}
      />
    </div>
  );
};

export default App;
