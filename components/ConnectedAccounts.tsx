import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectedAccount } from "../types";
import { Wallet, Building, CreditCard, RotateCcw, ChevronLeft, ChevronRight, Trash2, Lock, Plus, Pig, Clock, CheckCircle, Check, AlertCircle, Loader2, LinkIcon, AnimatedClock, Info, X } from "./Icons";
import { Plus as LucidePlus, RotateCcw as LucideRotateCcw, Trash2 as LucideTrash2, Clock as LucideClock, AlertCircle as LucideAlertCircle, Calendar, ChevronRight as LucideChevronRight, ChevronLeft as LucideChevronLeft, Wallet as LucideWallet, CreditCard as LucideCreditCard, PiggyBank as LucidePiggyBank, Coins, RefreshCw, Eye, EyeOff, Pencil } from "lucide-react";
import NumberFlow from '@number-flow/react';
import { toast as sonnerToast } from "sonner";

import { EmptyState } from "./EmptyState";
import { saveSyncProgress, clearSyncProgress } from "../utils/syncProgress";
import * as dbService from "../services/database";
import { useToasts } from "./Toast";
import { TooltipIcon } from "./UIComponents";
import { UniversalModal } from "./UniversalModal";
import { BankConnectModal } from "./BankConnectModal";
import { ManageManualAccountModal } from "./ManageManualAccountModal";
import Lottie from "lottie-react";
import linkAnimation from "../assets/link.json";
import { toLocalISODate } from "../utils/dateUtils";

// API Base URL - uses Railway in production, local /api in development
const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ConnectedAccountsProps {
  accounts: ConnectedAccount[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onDebugSync?: () => void;
  lastSynced?: Record<string, string>;
  userId?: string | null;
  selectedMemberId?: string;

  isAdmin?: boolean;
  userPlan?: string;
  onUpgrade?: () => void;
  dailyCredits?: { date: string, count: number };
}

const formatCurrency = (value?: number, currency: string = "BRL") => {
  if (value === undefined || value === null || isNaN(value)) return "--";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)} `;
  }
};

const translateAccountType = (type?: string, subtype?: string): string => {
  const typeMap: Record<string, string> = {
    'BANK': 'Banco',
    'CREDIT': 'Crédito',
    'SAVINGS': 'Poupança',
    'INVESTMENT': 'Investimento',
  };

  const subtypeMap: Record<string, string> = {
    'SAVINGS_ACCOUNT': 'Conta Poupança',
    'CHECKING_ACCOUNT': 'Conta Corrente',
    'CREDIT_CARD': 'Cartão de Crédito',
    'SAVINGS': 'Poupança',
    'CHECKING': 'Conta Corrente',
  };

  if (subtype && subtypeMap[subtype]) {
    return subtypeMap[subtype];
  }

  const translatedType = type ? (typeMap[type] || type) : '';
  const translatedSubtype = subtype ? (subtypeMap[subtype] || subtype) : '';

  if (translatedType && translatedSubtype) {
    return `${translatedType} - ${translatedSubtype} `;
  }

  return translatedType || translatedSubtype || 'Conta';
};

interface ItemSyncStatus {
  id: string; // itemId
  status: string; // 'UPDATED', 'UPDATING', 'LOGIN_ERROR', etc.
  lastUpdatedAt: string | null;
  connectorName?: string;
}

interface GlobalSyncStatus {
  state: string;
  message?: string;
  details?: any;
  lastUpdated?: string;
}

export const ConnectedAccounts: React.FC<ConnectedAccountsProps> = ({
  accounts,
  isLoading = false,
  onRefresh,
  onDebugSync,
  lastSynced = {},
  userId,

  isAdmin = false,
  userPlan = 'starter',
  onUpgrade,
  dailyCredits
}) => {
  const [limitView, setLimitView] = useState<Set<string>>(new Set());
  const activeToastId = useRef<string | number | null>(null);
  const [accountPages, setAccountPages] = useState<Record<string, number>>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteData, setDeleteData] = useState<{ accounts: ConnectedAccount[], institutionName: string } | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ConnectedAccount | null>(null);
  const [forceSyncItemId, setForceSyncItemId] = useState<string | null>(null);
  const [timers, setTimers] = useState<Record<string, { auto: { h: number; m: number; s: number }; cooldownMs: number; syncedToday: boolean; connectedToday?: boolean; isFresh: boolean } | null>>({});

  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemSyncStatus>>({});
  const [isSyncingItem, setIsSyncingItem] = useState<Record<string, boolean>>({});
  const [globalSyncStatus, setGlobalSyncStatus] = useState<GlobalSyncStatus | null>(null);
  const [syncJobs, setSyncJobs] = useState<Record<string, dbService.SyncJob>>({});

  const accountsPerPage = 3;
  const toast = useToasts();

  // --- DAILY CREDIT LOGIC ---
  const MAX_CREDITS_PER_DAY = (userPlan === 'starter') ? 0 : 3;
  // Use today's date to validate credits
  const todayDateStr = toLocalISODate(); // YYYY-MM-DD local

  // Debug logic
  // useEffect(() => {
  //   console.log('[ConnectedAccounts] Received dailyCredits:', dailyCredits, 'Today:', todayDateStr);
  // }, [dailyCredits, todayDateStr]);

  // NOTE: When dailyCredits is undefined, it means the user has NEVER used credits before
  // (the field doesn't exist in Firebase yet). This is different from "loading".
  // In this case, the user has all credits available (count = 0).
  // We know data is loaded because we have userId from the parent component.
  const effectiveCredits = dailyCredits || { date: '', count: 0 };

  // Logic: if date is today, use the count. If date is different (yesterday or empty), credits reset to 0.
  const creditsUsedToday = (effectiveCredits.date === todayDateStr) ? effectiveCredits.count : 0;

  // hasCredit logic:
  // - Admin: always true (unlimited credits)
  // - Starter plan: always false (no credits available)
  // - Otherwise: check if credits used today < max
  // NOTE: undefined dailyCredits means user never used credits = has all credits available
  const hasCredit = isAdmin
    ? true
    : (userPlan === 'starter')
      ? false
      : (creditsUsedToday < MAX_CREDITS_PER_DAY);

  // For UI purposes - we consider credits "loaded" if we have a userId (user data is loaded)
  const isCreditsLoaded = !!userId;
  const creditsRemaining = isAdmin ? Infinity : Math.max(0, MAX_CREDITS_PER_DAY - creditsUsedToday);
  const showCreditAnimation = userPlan !== 'starter' && (isAdmin || creditsRemaining > 1);

  // Debug Helper
  const handleDebugIncrement = async () => {
    if (userId) {
      console.log('[Debug] Manually triggering credit increment...');
      const newCount = await dbService.incrementDailyConnectionCredits(userId);
      toast.success(`Debug: Créditos incrementados para ${newCount} `);
    }
  };

  const calculateTimers = (lastSyncedStr: string, connectedAtStr?: string) => {
    const now = new Date();

    // Global Reset is always next midnight
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const nextAutoSyncMs = nextMidnight.getTime() - now.getTime();

    const h = Math.floor(nextAutoSyncMs / (1000 * 60 * 60));
    const m = Math.floor((nextAutoSyncMs % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((nextAutoSyncMs % (1000 * 60)) / 1000);

    const todayDate = toLocalISODate(now); // YYYY-MM-DD

    // Check if account was connected today (first connection counts as "sync for today")
    let connectedToday = false;
    if (connectedAtStr) {
      const connectedAt = new Date(connectedAtStr);
      if (!isNaN(connectedAt.getTime())) {
        const connectedDate = toLocalISODate(connectedAt);
        connectedToday = connectedDate === todayDate;
      }
    }

    // Check if last sync was today
    let syncedToday = false;
    let elapsed = 0;
    if (lastSyncedStr) {
      const lastSync = new Date(lastSyncedStr);
      if (!isNaN(lastSync.getTime())) {
        elapsed = now.getTime() - lastSync.getTime();
        const lastSyncDate = toLocalISODate(lastSync);
        syncedToday = lastSyncDate === todayDate;
      }
    }

    // User can only sync once per day, starting at midnight
    // If connected today OR synced today, they must wait until next midnight
    const usedTodayQuota = connectedToday || syncedToday;

    return {
      auto: { h, m, s },
      cooldownMs: usedTodayQuota ? nextAutoSyncMs : 0,
      syncedToday: usedTodayQuota, // True if already used the daily quota
      connectedToday,
      isFresh: elapsed < 5 * 60 * 1000 // 5 mins fresh
    };
  };

  // Maintain timer state for display
  useEffect(() => {
    const updateTimers = () => {
      const newTimers: Record<string, { auto: { h: number; m: number; s: number }, cooldownMs: number, syncedToday: boolean, connectedToday?: boolean, isFresh: boolean } | null> = {};

      // Build lookup maps for lastSynced and connectedAt by itemId
      const lastSyncedByItem: Record<string, string> = { ...lastSynced };
      const connectedAtByItem: Record<string, string> = {};

      // Get connectedAt from accounts (grouped by itemId)
      accounts.forEach(acc => {
        if (acc.itemId) {
          if (acc.connectedAt && !connectedAtByItem[acc.itemId]) {
            connectedAtByItem[acc.itemId] = acc.connectedAt;
          }
          if (acc.lastSyncedAt) {
            // Use account lastSyncedAt as preference
            lastSyncedByItem[acc.itemId] = acc.lastSyncedAt;
          }
        }
      });

      // Also use itemStatuses for lastUpdatedAt
      Object.values(itemStatuses).forEach(status => {
        if (status.lastUpdatedAt) {
          lastSyncedByItem[status.id] = status.lastUpdatedAt;
        }
      });

      // Calculate timers for each item
      Object.keys({ ...lastSyncedByItem, ...connectedAtByItem }).forEach(itemId => {
        const lastSyncStr = lastSyncedByItem[itemId];
        const connectedAtStr = connectedAtByItem[itemId];
        newTimers[itemId] = calculateTimers(lastSyncStr, connectedAtStr);
      });

      setTimers(newTimers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 60000); // 60 segundos
    return () => clearInterval(interval);
  }, [lastSynced, itemStatuses, accounts]);

  // Auto-cleanup invalid accounts (NaN balance) on load
  const hasCleanedUp = useRef(false);
  useEffect(() => {
    if (!userId || hasCleanedUp.current) return;

    // Check if there are any accounts with invalid balance
    const hasInvalidAccounts = accounts.some(acc =>
      acc.balance === undefined ||
      acc.balance === null ||
      (typeof acc.balance === 'number' && isNaN(acc.balance))
    );

    if (hasInvalidAccounts) {
      hasCleanedUp.current = true;
      // Run cleanup silently
      dbService.deleteInvalidAccounts(userId).then(count => {
        if (count > 0) {
          console.log(`[Auto-cleanup] Removed ${count} invalid accounts`);
          onRefresh?.();
        }
      }).catch(console.error);
    }
  }, [userId, accounts, onRefresh]);

  let connectButtonTooltip = "";
  if (userPlan === 'starter') {
    connectButtonTooltip = "Plano Starter não permite conexões automáticas. Faça um upgrade!";
  } else if (!isCreditsLoaded) {
    connectButtonTooltip = "Carregando informações de crédito...";
  } else if (!hasCredit) {
    connectButtonTooltip = `Limite de ${MAX_CREDITS_PER_DAY} conexões diárias atingido.Aguarde até meia - noite.`;
  }

  const handleBankConnected = async (newAccounts: ConnectedAccount[], syncJobId?: string) => {
    // Connection started - show initial feedback
    // Progress will be shown via sync jobs listener
    if (forceSyncItemId) {
      sonnerToast.info("Sincronização iniciada! Acompanhe o progresso abaixo.", { duration: 3000 });
    } else {
      sonnerToast.info("Conexão iniciada! Seus dados aparecerão em breve.", { duration: 3000 });
    }

    // console.log('[ConnectedAccounts] Bank connected, syncJobId:', syncJobId);

    // Refresh to show the new connection (if any)
    if (onRefresh) onRefresh();
  };

  const fetchItemStatuses = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_BASE}/pluggy/items-status?userId=${userId}`);
      const data = await response.json();
      if (data.success && data.items) {
        const statusMap: Record<string, ItemSyncStatus> = {};
        data.items.forEach((item: any) => {
          statusMap[item.id] = {
            id: item.id,
            status: item.status,
            lastUpdatedAt: item.lastUpdatedAt,
            connectorName: item.connectorName || null
          };
        });
        setItemStatuses(statusMap);

        if (data.syncStatus) {
          setGlobalSyncStatus(data.syncStatus);
        }

        if (data.syncStatus && activeToastId.current) {
          const { state, message } = data.syncStatus;

          if (state === 'in_progress' || state === 'pending') {
            // Loading state...
          } else if (state === 'success') {
            sonnerToast.success(message || "Sincronização concluída!", { id: activeToastId.current });
            activeToastId.current = null;
            if (onRefresh) onRefresh();
          } else if (state === 'error') {
            sonnerToast.error(message || "Erro na sincronização.", { id: activeToastId.current });
            activeToastId.current = null;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching statuses", error);
    }
  }, [userId, onRefresh]);

  // Real-time Sync Status Listener (Firestore)
  useEffect(() => {
    if (!userId) return;

    // Listen to Global Sync Status
    const unsubscribe = dbService.listenToSyncStatus(userId, (status) => {
      setGlobalSyncStatus(status);

      // Handle Toast Notifications driven by Backend Status
      if (status && activeToastId.current) {
        const { state, message } = status;

        if (state === 'success') {
          sonnerToast.success(message || "Sincronização concluída!", { id: activeToastId.current });
          activeToastId.current = null;
          if (onRefresh) onRefresh();
        } else if (state === 'error') {
          sonnerToast.error(message || "Erro na sincronização.", { id: activeToastId.current });
          activeToastId.current = null;
        } else if (state === 'in_progress') {
          // Should we update the loading toast text?
          if (message) {
            sonnerToast.loading(message, { id: activeToastId.current });
          }
        }
      }
    });

    // Also fetch items initially and periodically (less frequent, e.g. 30s) just to keep balance fresh
    // But for status updates, rely on the listener above.
    fetchItemStatuses(); // Initial fetch

    return () => {
      unsubscribe();
    };
  }, [userId, onRefresh]);

  // Listen to Sync Jobs for real-time progress tracking
  // Ref to track the last known status of jobs to prevent duplicate toasts on refresh
  const lastJobStatuses = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;

    const unsubscribeJobs = dbService.listenToSyncJobs(userId, (jobs) => {
      // Map jobs by itemId for easy lookup
      const jobMap: Record<string, dbService.SyncJob> = {};
      const newStatuses: Record<string, string> = {};
      let hasActiveJob = false;

      jobs.forEach((job) => {
        // Only keep the most recent job per itemId
        if (!jobMap[job.itemId] ||
          (job.createdAt && jobMap[job.itemId].createdAt &&
            job.createdAt > jobMap[job.itemId].createdAt)) {
          jobMap[job.itemId] = job;
        }

        // Logic to trigger toasts only on status CHANGE
        const previousStatus = lastJobStatuses.current[job.id];
        const currentStatus = job.status;

        // If we haven't seen this job before (first load), and it's already finished, don't toast
        // UNLESS it's a very recent job (e.g. < 45s), which means it likely finished just now during a page transition
        const isTerminalState = currentStatus === 'completed' || currentStatus === 'failed';
        const isFirstLoadOfTerminalState = !previousStatus && isTerminalState;

        // Check recency
        const now = Date.now();
        let isRecent = false;
        const jobTimeStr = job.createdAt;
        if (jobTimeStr) {
          const jobTime = (typeof jobTimeStr === 'object' && 'seconds' in jobTimeStr)
            ? (jobTimeStr as any).seconds * 1000
            : new Date(jobTimeStr).getTime();
          isRecent = (now - jobTime) < 45000; // 45 seconds tolerance
        }

        // Update progress toast for active jobs - ONLY if job is recent (< 3 min old)
        // This prevents showing toast for stale/zombie jobs on page load
        if (currentStatus === 'processing' || currentStatus === 'pending' || currentStatus === 'retrying') {
          // Check if job is recent enough to show progress
          const jobUpdatedStr = job.updatedAt || job.createdAt;
          let jobAge = Infinity;
          if (jobUpdatedStr) {
            const jobUpdatedTime = (typeof jobUpdatedStr === 'object' && 'seconds' in jobUpdatedStr)
              ? (jobUpdatedStr as any).seconds * 1000
              : new Date(jobUpdatedStr).getTime();
            jobAge = now - jobUpdatedTime;
          }

          // Only show progress toast if job was updated in the last 3 minutes
          const MAX_JOB_AGE_MS = 3 * 60 * 1000; // 3 minutes
          if (jobAge < MAX_JOB_AGE_MS) {
            hasActiveJob = true;
            const progress = job.progress;
            if (progress && typeof progress === 'object') {
              saveSyncProgress({
                step: progress.step || 'Sincronizando...',
                current: progress.current || 0,
                total: progress.total || 100,
                startedAt: Date.now()
              });
            } else {
              // Fallback for legacy format
              saveSyncProgress({
                step: 'Processando...',
                current: typeof progress === 'number' ? progress : 0,
                total: 100,
                startedAt: Date.now()
              });
            }
          }
        }

        // Trigger if: Status changed OR (It's the first load of a done job AND it's fresh)
        if ((currentStatus !== previousStatus && !isFirstLoadOfTerminalState) || (isFirstLoadOfTerminalState && isRecent)) {
          if (currentStatus === 'completed') {
            // Show completion in progress toast
            const message = job.message || 'Dados sincronizados!';
            saveSyncProgress({
              step: message,
              current: 100,
              total: 100,
              isComplete: true,
              startedAt: Date.now()
            });
            // Delay refresh to ensure Firestore propagation
            setTimeout(() => {
              fetchItemStatuses();
              if (onRefresh) onRefresh();
            }, 3000);
          } else if (currentStatus === 'failed') {
            const errorMessage = job.creditRefunded
              ? 'Sincronização falhou. Crédito reembolsado.'
              : (job.lastError || 'Sincronização falhou.');
            saveSyncProgress({
              step: 'Erro',
              current: 0,
              total: 100,
              error: errorMessage,
              startedAt: Date.now()
            });
            fetchItemStatuses(); // Also update statuses on failure
          }
        }

        // Update status for next run
        newStatuses[job.id] = currentStatus;
      });

      // Clear progress toast if no active jobs
      if (!hasActiveJob && jobs.length === 0) {
        // Don't clear immediately - let the completion/error toast show
      }

      setSyncJobs(jobMap);

      // Update our ref with the latest statuses, merging with existing to keep history of jobs not in current snapshot (if any, though listenToSyncJobs limits to 10)
      // Actually, we only care about the ones currently being tracked.
      // But safer to just merge:
      lastJobStatuses.current = { ...lastJobStatuses.current, ...newStatuses };
    });

    return () => {
      unsubscribeJobs();
    };
  }, [userId, onRefresh, fetchItemStatuses]);

  // Global Timer Display Logic - Updates every second for smooth animation
  const [globalTimerDisplay, setGlobalTimerDisplay] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const updateGlobalTimer = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const diff = nextMidnight.getTime() - now.getTime();

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setGlobalTimerDisplay({ h, m, s });
    };

    updateGlobalTimer(); // Initial
    const interval = setInterval(updateGlobalTimer, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);


  const groupedAccounts = useMemo(() => {
    const groups: Record<string, { accounts: ConnectedAccount[], itemId: string, institution: string }> = {};

    // 1. Group existing accounts
    accounts.forEach((acc) => {
      const key = acc.itemId || acc.institution || "Outros";
      const itemStatus = acc.itemId ? itemStatuses[acc.itemId] : null;
      const connectorName = itemStatus?.connectorName;
      const institutionName = connectorName || acc.connector?.name || acc.institution || "Banco";

      if (!groups[key]) {
        groups[key] = {
          accounts: [],
          itemId: acc.itemId,
          institution: institutionName
        };
      }
      groups[key].accounts.push(acc);
      if (institutionName !== "Banco" && groups[key].institution === "Banco") {
        groups[key].institution = institutionName;
      }
    });

    // 2. Add orphan items (Connected in Pluggy but accounts not saved in DB yet)
    // This fixes the "Connected but not showing" issue
    Object.values(itemStatuses).forEach(status => {
      const itemId = status.id;
      // If this item is NOT already in the groups, add it
      if (!groups[itemId]) {
        groups[itemId] = {
          accounts: [],
          itemId: itemId,
          institution: status.connectorName || "Banco Conectado (Sem contas)"
        };
      }
    });

    return groups;
  }, [accounts, itemStatuses]);

  // Stale threshold for pending connections (1 minute - reduced to fix stuck cards)
  const STALE_JOB_THRESHOLD_MS = 60 * 1000;

  const pendingCreationItems = useMemo(() => {
    const now = Date.now();
    return Object.values(syncJobs).filter(job => {
      // Must be a relevant status
      // We also include 'completed' to cover the gap between "Job Done" and "Account appears in List"
      const isActive = ['pending', 'processing', 'retrying', 'completed'].includes(job.status);
      if (!isActive) return false;

      // Must not be already in the main list
      const alreadyExists = accounts.some(acc => acc.itemId === job.itemId);
      if (alreadyExists) return false;

      // Must be recent (prevent stuck ghost cards)
      // Check both createdAt and updatedAt if available
      const jobTimeStr = job.updatedAt || job.createdAt;
      let jobTime = 0;

      if (jobTimeStr) {
        // Handle Firebase Timestamp objects or strings
        if (typeof jobTimeStr === 'object' && 'seconds' in jobTimeStr) {
          jobTime = (jobTimeStr as any).seconds * 1000;
        } else {
          jobTime = new Date(jobTimeStr).getTime();
        }
      }

      if (jobTime && (now - jobTime > STALE_JOB_THRESHOLD_MS)) {
        return false; // Too old, likely zombie job
      }

      return true;
    });
  }, [syncJobs, accounts]);

  const toggleLimitView = (id: string) => {
    setLimitView(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCardFromInstitution = (acc: ConnectedAccount) => {
    const type = (acc.type || "").toLowerCase();
    const subtype = (acc.subtype || "").toLowerCase();
    return type.includes("credit") || subtype.includes("credit") || subtype.includes("card");
  };

  const isSavingsAccount = (acc: ConnectedAccount) => {
    const type = (acc.type || "").toUpperCase();
    const subtype = (acc.subtype || "").toUpperCase();
    return type === 'SAVINGS' || subtype === 'SAVINGS' || subtype === 'SAVINGS_ACCOUNT';
  };

  const getAccountIcon = (acc: ConnectedAccount) => {
    if (isCardFromInstitution(acc)) {
      return { icon: <CreditCard size={18} />, bgClass: 'bg-amber-500/10 text-amber-500' };
    }
    if (isSavingsAccount(acc)) {
      return { icon: <Pig size={18} />, bgClass: 'bg-emerald-500/10 text-emerald-400' };
    }
    return { icon: <Wallet size={18} />, bgClass: 'bg-[#d97757]/10 text-[#d97757]' };
  };

  const handleManualSync = async (itemId: string, force = false, fullSync = false) => {
    // Early return if no user or already syncing this item
    if (!userId) {
      console.log('[handleManualSync] No userId, aborting');
      return;
    }

    if (isSyncingItem[itemId]) {
      console.log('[handleManualSync] Already syncing item:', itemId);
      return;
    }

    // Admins bypass all sync restrictions
    if (!force && !isAdmin) {
      // Check if already synced or connected today
      // IMPORTANT: Only check timer if it exists (has been calculated)
      const itemTimer = timers[itemId];

      // If timer exists and shows synced today, block with message
      if (itemTimer && itemTimer.syncedToday) {
        const message = itemTimer.connectedToday
          ? `Banco conectado hoje. Sincronização liberada à meia-noite (${itemTimer.auto.h}h ${itemTimer.auto.m}m).`
          : `Já sincronizado hoje. Próxima sincronização em ${itemTimer.auto.h}h ${itemTimer.auto.m}m.`;
        toast.error(message);
        return;
      }

      // Check if user has credits available
      if (!hasCredit) {
        toast.error(`Você já usou seus ${MAX_CREDITS_PER_DAY} créditos diários. Aguarde até meia-noite.`);
        return;
      }
    }

    setIsSyncingItem(prev => ({ ...prev, [itemId]: true }));
    try {
      const response = await fetch(`${API_BASE}/pluggy/trigger-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, userId, force, fullSync })
      });
      const data = await response.json();

      if (data.success) {
        toast.info(fullSync
          ? "Sincronização COMPLETA iniciada! Buscando 12 meses de transações..."
          : "Sincronização iniciada com sucesso!");
        fetchItemStatuses();
      } else if (data.needsReconnect || data.code === 'ITEM_NOT_FOUND') {
        // Item não existe mais na Pluggy - precisa reconectar
        toast.error("Conexão expirada. Por favor, reconecte este banco.", "A conexão com seu banco expirou.");
        // Opcionalmente abrir o modal de conexão para reconectar
        setForceSyncItemId(null);
        setShowBankModal(true);
      } else {
        toast.error(data.error || "Erro ao iniciar sincronização.");
      }
    } catch (error) {
      console.error("Sync error", error);
      toast.error("Erro ao sincronizar. Verifique sua conexão.");
    } finally {
      setIsSyncingItem(prev => ({ ...prev, [itemId]: false }));
    }
  };


  const handleCleanupDuplicates = async () => {
    if (!userId) return;
    const toastId = toast.loading('Removendo duplicatas...');
    try {
      const response = await fetch(`${API_BASE}/pluggy/cleanup-duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      toast.dismiss(toastId);
      if (data.success) {
        toast.success(`Limpeza concluída! ${data.deleted} duplicatas removidas.`);
        onRefresh?.();
      } else {
        toast.error('Erro ao limpar duplicatas.');
      }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('Erro de conexão.');
    }
  };

  const handleCleanupInvalidAccounts = async () => {
    if (!userId) return;
    const toastId = toast.loading('Removendo contas inválidas...');
    try {
      const deletedCount = await dbService.deleteInvalidAccounts(userId);
      toast.dismiss(toastId);
      if (deletedCount > 0) {
        toast.success(`${deletedCount} conta(s) inválida(s) removida(s)!`);
        onRefresh?.();
      } else {
        toast.info('Nenhuma conta inválida encontrada.');
      }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('Erro ao remover contas inválidas.');
    }
  };

  const [deleteIncludeTransactions, setDeleteIncludeTransactions] = useState(false); // New state for checkbox

  const handleDeleteInstitution = async () => {
    if (!userId || !deleteData) return;
    const { accounts: institutionAccounts, institutionName } = deleteData;
    setIsDeleting(institutionName);
    try {
      for (const acc of institutionAccounts) {
        // If checkbox is checked, delete related transactions first
        if (deleteIncludeTransactions) {
          await dbService.deleteAllTransactionsForAccount(userId, acc.id);
          await dbService.deleteAllCreditCardTransactionsForAccount(userId, acc.id);
        }
        await dbService.deleteConnectedAccount(userId, acc.id);
      }
      toast.success(`${institutionAccounts.length} conta(s) removida(s) com sucesso!`);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao remover contas:", error);
      toast.error("Erro ao remover as contas.");
    } finally {
      setIsDeleting(null);
      setDeleteData(null);
      setDeleteIncludeTransactions(false); // Reset checkbox
    }
  };

  const handleToggleHidden = async (acc: ConnectedAccount) => {
    if (!userId) return;
    try {
      const newHiddenState = !acc.hidden;
      await dbService.updateConnectedAccount(userId, acc.id, { hidden: newHiddenState });
      toast.success(newHiddenState ? "Conta ocultada das caixinhas." : "Conta visível novamente.");
      // No need to manual refresh if using real-time listener in parent, but good to ensure
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao alterar visibilidade:", error);
      toast.error("Erro ao atualizar conta.");
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-950 border border-gray-800 rounded-2xl p-6 space-y-4 animate-pulse shadow-xl">
            <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4">
              <div className="w-10 h-10 bg-gray-900 rounded-full"></div>
              <div className="h-4 bg-gray-900 rounded w-1/3"></div>
            </div>
            <div className="space-y-3">
              <div className="h-16 bg-gray-900/50 rounded-xl w-full"></div>
              <div className="h-16 bg-gray-900/50 rounded-xl w-full"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }



  return (
    <div className="w-full space-y-8 animate-fade-in font-sans pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Gestão de Contas</h2>
            <div className="flex items-center gap-1.5 mt-1 text-gray-400">
              {userPlan !== 'starter' && (
                <div className="w-5 h-5 flex items-center justify-center -ml-1">
                  {showCreditAnimation ? (
                    <Lottie animationData={linkAnimation} loop={true} />
                  ) : (
                    <LinkIcon size={16} className="text-[#d97757]" />
                  )}
                </div>
              )}
              <p className="text-sm">
                {userPlan === 'starter'
                  ? 'Conexão automática indisponível no Starter'
                  : isAdmin
                    ? 'Créditos ilimitados (Admin)'
                    : `${creditsUsedToday} de ${MAX_CREDITS_PER_DAY} conexões usadas`
                }
              </p>
              {userPlan !== 'starter' && !isAdmin && (
                <TooltipIcon content="Seus créditos diários são renovados automaticamente à meia-noite.">
                  <Info size={14} className="text-gray-500 hover:text-gray-300 cursor-help" />
                </TooltipIcon>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Global Timer Display - VALID IF: Not Starter AND Has Accounts AND Timer Loaded */}
          {userPlan !== 'starter' && accounts.length > 0 && globalTimerDisplay && (
            <div className="flex items-center gap-3 mr-2 animate-fade-in bg-gray-900/30 px-3 py-1.5 rounded-xl border border-gray-800/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                <span className="hidden md:inline">Próxima Sincronização:</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-white font-bold text-sm bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800 shadow-inner">
                <NumberFlow value={globalTimerDisplay.h} format={{ minimumIntegerDigits: 2 }} transformTiming={{ duration: 500 }} />
                <span className="text-gray-600">:</span>
                <NumberFlow value={globalTimerDisplay.m} format={{ minimumIntegerDigits: 2 }} transformTiming={{ duration: 500 }} />
                <span className="text-gray-600">:</span>
                <NumberFlow value={globalTimerDisplay.s} format={{ minimumIntegerDigits: 2 }} transformTiming={{ duration: 500 }} />
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setEditingAccount(null);
              setShowManualModal(true);
            }}
            className="px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg font-bold text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Banco (Manual)</span>
          </button>

          <TooltipIcon content={connectButtonTooltip || (isAdmin ? "Conectar nova instituição" : "Conectar nova instituição (Consome 1 crédito)")}>
            <button
              id="open-finance-connect-btn"
              onClick={() => {
                if (userPlan === 'starter' && onUpgrade) {
                  onUpgrade();
                  return;
                }
                if (!hasCredit || !isCreditsLoaded) return;
                setForceSyncItemId(null);
                setShowBankModal(true);
              }}
              disabled={(!hasCredit || !isCreditsLoaded) && userPlan !== 'starter'}
              className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg font-bold text-sm ${hasCredit && isCreditsLoaded
                ? 'bg-[#d97757] hover:bg-[#c66646] text-white'
                : userPlan === 'starter'
                  ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white cursor-pointer'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                } `}
            >
              {userPlan === 'starter' ? <Lock size={18} /> : <Plus size={18} />}
              <span className="hidden sm:inline">
                {userPlan === 'starter'
                  ? 'Desbloquear Conexão'
                  : !isCreditsLoaded
                    ? 'Carregando...'
                    : 'Banco (Automático)'}
              </span>
            </button>
          </TooltipIcon>

          {/* Button removed as per user request for automatic updates */}
        </div>
      </div>

      {/* Sync Warning Banner - Compact Version */}
      <div className="mt-4 mb-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 shadow-sm">
        <AlertCircle className="text-amber-500 shrink-0" size={18} />
        <div className="text-xs text-amber-200/80">
          <span className="text-amber-500 font-bold mr-1">Sincronização Manual:</span>
          As contas <strong className="text-amber-200">não atualizam sozinhas</strong>. Clique em <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-amber-500/20 rounded text-amber-500 mx-0.5 align-middle font-bold"><RotateCcw size={10} className="mr-1" /> Sincronizar</span> no card do banco para buscar novos dados.
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold">Suas conexões</p>
          <h3 className="text-lg text-white font-semibold">Todos os bancos vinculados</h3>
        </div>
        <span className="text-xs text-gray-500 bg-gray-900/70 border border-gray-800 rounded-full px-3 py-1">
          {accounts.length} no total
        </span>
      </div>

      {accounts.length === 0 && Object.keys(syncJobs).length === 0 ? (
        <EmptyState
          title="Nenhuma conta conectada"
          description="Conecte seus bancos para ver tudo em um só lugar."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* Skeleton Cards for Pending New Connections */}
          {pendingCreationItems.map((job) => {
            const handleCancelSync = async (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!userId || !job.id) return;
              try {
                await fetch(`${API_BASE}/pluggy/cancel-sync`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, syncJobId: job.id })
                });
                sonnerToast.info("Cancelamento solicitado.");
              } catch (err) {
                console.error('Failed to cancel sync:', err);
              }
            };

            const isCompleted = job.status === 'completed';

            return (
              <div key={`skeleton - ${job.itemId} `} className="group border border-gray-800 rounded-2xl shadow-xl flex flex-col relative overflow-hidden bg-[#30302E]">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#d97757]"></div>

                {/* Header Skeleton */}
                <div className="p-5 rounded-t-2xl border-b border-gray-800 flex flex-col gap-4 bg-[#333432]">
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-10 h-10 rounded-xl bg-gray-800/50 animate-pulse flex-shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-2 w-16 bg-gray-800/50 rounded animate-pulse"></div>
                      <div className="h-4 w-32 bg-gray-800/50 rounded animate-pulse"></div>
                    </div>

                    {/* Cancel Button */}
                    <button
                      onClick={handleCancelSync}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white z-20"
                      title="Cancelar Sincronização"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <CheckCircle size={12} className="text-emerald-500" />
                        <span className="text-[10px] text-emerald-500 font-bold uppercase">
                          Finalizando...
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#d97757]/10 border border-[#d97757]/30">
                        <Loader2 size={12} className="text-[#d97757] animate-spin" />
                        <span className="text-[10px] text-[#d97757] font-bold uppercase">
                          Conectando Banco...
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Body Skeleton */}
                <div className="p-4 flex-1 bg-[#30302E] space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="border border-gray-800/60 rounded-xl p-4 bg-gray-900/30">
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex gap-3 items-center flex-1">
                          <div className="w-8 h-8 rounded-lg bg-gray-800/50 animate-pulse"></div>
                          <div className="space-y-1.5 flex-1">
                            <div className="h-3 w-24 bg-gray-800/50 rounded animate-pulse"></div>
                            <div className="h-2 w-16 bg-gray-800/50 rounded animate-pulse"></div>
                          </div>
                        </div>
                        <div className="w-20 h-5 bg-gray-800/50 rounded animate-pulse"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {Object.entries(groupedAccounts).map(([groupKey, data]) => {
            const { accounts: institutionAccounts, institution: institutionName, itemId } = data;

            const timer = itemId ? timers[itemId] : null;
            const itemStatus = itemId ? itemStatuses[itemId] : null;
            const syncJob = itemId ? syncJobs[itemId] : null;

            // Determine sync state from multiple sources
            // Fix infinite loading: Force stop spinning if job is older than 5 minutes
            const now = Date.now();
            const jobTime = syncJob?.updatedAt
              ? (typeof syncJob.updatedAt === 'object' && 'seconds' in syncJob.updatedAt ? (syncJob.updatedAt as any).seconds * 1000 : new Date(syncJob.updatedAt).getTime())
              : (syncJob?.createdAt ? (typeof syncJob.createdAt === 'object' && 'seconds' in syncJob.createdAt ? (syncJob.createdAt as any).seconds * 1000 : new Date(syncJob.createdAt).getTime()) : 0);

            const isStuck = jobTime > 0 && (now - jobTime > 5 * 60 * 1000); // 5 minutes timeout

            const isJobProcessing = !isStuck && (syncJob?.status === 'processing' || syncJob?.status === 'pending');
            const isJobRetrying = !isStuck && (syncJob?.status === 'retrying');
            // const isJobFailed = syncJob?.status === 'failed'; // Hidden as per user request (toast only)
            // const wasRefunded = syncJob?.creditRefunded;

            const isUpdating = !isStuck && (itemStatus?.status === 'UPDATING' || isSyncingItem[itemId || ''] === true || isJobProcessing);
            const isLoginError = itemStatus?.status === 'LOGIN_ERROR';
            const isWait = itemStatus?.status === 'WAITING_USER_INPUT';

            const currentPage = accountPages[groupKey] || 1;
            const totalPages = Math.ceil(institutionAccounts.length / accountsPerPage);
            const startIndex = (currentPage - 1) * accountsPerPage;
            const endIndex = startIndex + accountsPerPage;
            const paginatedInstitutionAccounts = institutionAccounts.slice(startIndex, endIndex);

            return (
              <div key={groupKey} className="border border-gray-800 rounded-2xl shadow-xl flex flex-col group relative overflow-hidden transition-all hover:border-gray-700" style={{ backgroundColor: '#30302E' }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#d97757] pointer-events-none transition-opacity group-hover:opacity-10"></div>

                <div className="backdrop-blur-sm p-5 rounded-t-2xl border-b border-gray-800 flex flex-col relative z-10 gap-4" style={{ backgroundColor: '#333432' }}>

                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Logo do Banco ou ícone fallback */}
                      {(() => {
                        // Pega a primeira conta para obter a logo do connector
                        const firstAcc = institutionAccounts[0];
                        const imageUrl = firstAcc?.connector?.imageUrl;
                        return imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={institutionName}
                            className="w-10 h-10 rounded-xl object-contain flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-[#d97757] shadow-inner flex-shrink-0">
                            <Building size={20} />
                          </div>
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Instituição</p>
                        <h4 className="text-base font-bold text-white leading-tight truncate">
                          {institutionName}
                        </h4>
                        {itemId && (itemStatus?.lastUpdatedAt || lastSynced[itemId]) && (
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            Última sync: {(() => {
                              const syncDate = new Date(itemStatus?.lastUpdatedAt || lastSynced[itemId]);
                              const now = new Date();
                              const isToday = syncDate.toDateString() === now.toDateString();
                              if (isToday) {
                                return `Hoje às ${syncDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} `;
                              }
                              return syncDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                            })()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Removed Progress Indicators as per user request "deixar tudo no toast" */}

                      {/* Status badges for errors only (Login error is helpful to keep, but hiding generic progress) */}
                      {itemId && (isLoginError || isWait) && (
                        <div className="mr-2">
                          {isLoginError ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                              <AlertCircle size={12} className="text-red-400" />
                              <span className="text-[10px] text-red-400 font-bold uppercase">Erro Login</span>
                            </div>
                          ) : isWait ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                              <AlertCircle size={12} className="text-yellow-400" />
                              <span className="text-[10px] text-yellow-400 font-bold uppercase">Ação Necessária</span>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {itemId && (
                        <TooltipIcon content={
                          isUpdating ? "Sincronização em andamento..." :
                            timer?.syncedToday ? `Já sincronizado hoje.Próxima sincronização em ${timer.auto.h}h ${timer.auto.m} m` :
                              !hasCredit ? `Sem créditos diários disponíveis.` :
                                isAdmin ? "Sincronizar agora" : "Sincronizar agora (1x por dia)"
                        }>
                          <button
                            onClick={() => handleManualSync(itemId)}
                            disabled={isDeleting !== null || isUpdating || (!isAdmin && (!hasCredit || timer?.syncedToday))}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 text-xs font-bold shadow-sm ${isUpdating
                              ? 'bg-[#d97757]/20 text-[#d97757] border border-[#d97757]/30 animate-pulse'
                              : (!isAdmin && (!hasCredit || timer?.syncedToday)) || isDeleting !== null
                                ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed border border-gray-800'
                                : 'bg-[#d97757]/10 text-[#d97757] hover:bg-[#d97757]/20 border border-[#d97757]/30 hover:border-[#d97757]/50'
                              } `}
                          >
                            <RotateCcw size={14} className={isUpdating ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">
                              {isUpdating
                                ? "Sincronizando..."
                                : timer?.syncedToday
                                  ? (
                                    <>
                                      <RefreshCw size={14} className="mr-1" />
                                      Atualizado
                                    </>
                                  )
                                  : 'Sincronizar'}
                            </span>
                          </button>
                        </TooltipIcon>
                      )}




                      <TooltipIcon content="Desconectar Instituição">
                        <button
                          onClick={() => setDeleteData({ accounts: institutionAccounts, institutionName })}
                          disabled={isDeleting !== null}
                          className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </TooltipIcon>
                    </div>
                  </div>

                </div>

                <div className="p-4 relative z-10 flex-1" style={{ backgroundColor: '#30302E' }}>
                  {institutionAccounts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-3 animate-fade-in">
                      <div className="p-3 bg-yellow-500/10 rounded-full">
                        <AlertCircle className="text-yellow-500" size={24} />
                      </div>
                      <div>
                        <p className="text-gray-300 font-bold text-sm">Contas não encontradas</p>
                        <p className="text-gray-500 text-xs max-w-[250px] mx-auto mt-1">
                          A conexão existe, mas as contas não foram salvas corretamente.
                        </p>
                      </div>
                      <button
                        onClick={() => itemId && handleManualSync(itemId, true)}
                        disabled={isUpdating}
                        className="mt-2 text-xs bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 px-4 py-2 rounded-lg border border-yellow-500/20 transition-colors font-bold flex items-center gap-2"
                      >
                        <RefreshCw size={14} className={isUpdating ? "animate-spin" : ""} />
                        {isUpdating ? 'Sincronizando...' : 'Reparar Conexão'}
                      </button>
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentPage}
                        initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                        transition={{ duration: 0.3, ease: "circInOut" }}
                        className="space-y-3"
                      >
                        {paginatedInstitutionAccounts.map((acc) => {
                          const isManual = acc.connectionMode === 'MANUAL';
                          const isCard = isCardFromInstitution(acc);
                          const bill = acc.currentBill;

                          // Format bill due date
                          const formatBillDate = (dateStr?: string) => {
                            if (!dateStr) return null;
                            try {
                              const date = new Date(dateStr + 'T12:00:00');
                              return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                            } catch {
                              return null;
                            }
                          };

                          // Get bill state label and color
                          const getBillStateInfo = (state?: string) => {
                            switch (state?.toUpperCase()) {
                              case 'OPEN':
                                return { label: 'Aberta', color: 'text-blue-400', bg: 'bg-blue-500/10' };
                              case 'CLOSED':
                                return { label: 'Fechada', color: 'text-amber-400', bg: 'bg-amber-500/10' };
                              case 'OVERDUE':
                                return { label: 'Vencida', color: 'text-red-400', bg: 'bg-red-500/10' };
                              default:
                                return null;
                            }
                          };

                          const billDate = formatBillDate(bill?.dueDate);
                          const billStateInfo = getBillStateInfo(bill?.state);

                          return (
                            <div key={acc.id} className={`border rounded-xl hover: border-gray-700 transition-colors ${isManual ? 'bg-amber-500/5 border-amber-500/20' : 'bg-gray-900/30 border-gray-800/60'} `}>
                              <div className="p-4">
                                <div className="flex justify-between items-center gap-3 mb-3">
                                  <div className="flex gap-3 items-center flex-1 min-w-0">
                                    {/* Logo do banco ou ícone de fallback */}
                                    {acc.connector?.imageUrl ? (
                                      <img
                                        src={acc.connector.imageUrl}
                                        alt=""
                                        className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
                                      />
                                    ) : (
                                      (() => {
                                        const { icon, bgClass } = getAccountIcon(acc);
                                        return (
                                          <div className={`p-1.5 rounded-lg flex-shrink-0 ${bgClass}`}>
                                            {icon}
                                          </div>
                                        );
                                      })()
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-gray-200 truncate">{acc.name}</p>
                                        {isManual && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[9px] font-bold uppercase rounded border border-amber-500/30">Manual</span>}
                                      </div>
                                      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium truncate">
                                        {acc.accountNumber ? `Conta: ${acc.accountNumber} ` : translateAccountType(acc.type, acc.subtype)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right flex-shrink-0 flex flex-col items-end">
                                    <div className="flex items-center gap-3">
                                      {isManual && (
                                        <TooltipIcon content="Editar conta">
                                          <button
                                            onClick={() => {
                                              setEditingAccount(acc);
                                              setShowManualModal(true);
                                            }}
                                            className="p-1.5 rounded-lg transition-colors text-gray-500 hover:text-white hover:bg-gray-800/30"
                                          >
                                            <Pencil size={14} />
                                          </button>
                                        </TooltipIcon>
                                      )}
                                      <TooltipIcon content={acc.hidden ? "Mostrar nas caixinhas" : "Ocultar das caixinhas"}>
                                        <button
                                          onClick={() => handleToggleHidden(acc)}
                                          className={`p-1.5 rounded-lg transition-colors ${acc.hidden ? 'text-gray-500 hover:text-gray-300 bg-gray-800/50' : 'text-gray-600 hover:text-gray-400 hover:bg-gray-800/30'}`}
                                        >
                                          {acc.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                      </TooltipIcon>
                                      <p className={`text-base font-mono font-bold whitespace-nowrap ${acc.hidden ? 'opacity-50' : ''} ${isCard ? "text-amber-400" : acc.balance < 0 ? "text-red-400" : "text-emerald-400"} `}>
                                        {formatCurrency(acc.balance, acc.currency)}
                                      </p>
                                    </div>
                                    {/* Show bill info for credit cards */}
                                    {isCard && bill && (billDate || billStateInfo) && (
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        {billStateInfo && (
                                          <span className={`text-[9px] font-medium ${billStateInfo.color} `}>
                                            {billStateInfo.label}
                                          </span>
                                        )}
                                        {billDate && (
                                          <span className="text-xs text-white/40 block mt-0.5">
                                            Venc. {(() => {
                                              if (!bill.dueDate) return 'N/A';
                                              // Extrair apenas a parte da data (YYYY-MM-DD) caso venha com timestamp
                                              const dateOnly = bill.dueDate.split('T')[0];
                                              const date = new Date(dateOnly + 'T12:00:00');
                                              return !isNaN(date.getTime())
                                                ? date.toLocaleDateString('pt-BR')
                                                : 'N/A';
                                            })()}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Credit Card Limit & Progress */}
                                {isCard && (
                                  <div className="mt-3 pt-3 border-t border-gray-800/50">
                                    {(() => {
                                      const creditLimit = acc.creditLimit || 0;
                                      const availableLimit = acc.availableCreditLimit;

                                      // Calcular o limite usado corretamente:
                                      // Prioridade 1: creditLimit - availableCreditLimit (mais preciso)
                                      // Prioridade 2: usedCreditLimit (se a API fornecer)
                                      // Prioridade 3: Fallback para balance se nada mais estiver disponível
                                      let usedAmount = 0;
                                      if (creditLimit > 0 && availableLimit !== undefined && availableLimit !== null) {
                                        usedAmount = Math.max(0, creditLimit - availableLimit);
                                      } else if (acc.usedCreditLimit !== undefined && acc.usedCreditLimit !== null) {
                                        usedAmount = acc.usedCreditLimit;
                                      } else {
                                        usedAmount = Math.abs(acc.balance || 0);
                                      }

                                      const usagePercentage = creditLimit > 0 ? (usedAmount / creditLimit) * 100 : 0;

                                      return (
                                        <div className="space-y-1.5">
                                          <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-[#3b82f6] rounded-full transition-all duration-500"
                                              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                                            />
                                          </div>
                                          <div className="flex justify-between items-center text-[10px] font-bold tracking-wide">
                                            <span className="text-emerald-500">
                                              Limite: {formatCurrency(creditLimit)}
                                            </span>
                                            <span className="text-gray-500">
                                              Usado: {formatCurrency(usedAmount)}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 py-3 rounded-b-2xl border-t border-gray-800/50" style={{ backgroundColor: '#333432' }}>
                    <button
                      onClick={() => setAccountPages(prev => ({ ...prev, [groupKey]: Math.max(1, currentPage - 1) }))}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-lg transition-all border ${currentPage === 1
                        ? 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed'
                        : 'bg-gray-900 hover:bg-gray-800 text-white border-gray-800 hover:border-gray-700'
                        } `}
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <span className="text-xs text-gray-400 font-medium">
                      <span className="text-white font-bold">{currentPage}</span> / <span className="text-white font-bold">{totalPages}</span>
                    </span>

                    <button
                      onClick={() => setAccountPages(prev => ({ ...prev, [groupKey]: Math.min(totalPages, currentPage + 1) }))}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-lg transition-all border ${currentPage === totalPages
                        ? 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed'
                        : 'bg-gray-900 hover:bg-gray-800 text-white border-gray-800 hover:border-gray-700'
                        } `}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <UniversalModal
        isOpen={!!deleteData}
        onClose={() => setDeleteData(null)}
        title="Desconectar Instituição"
        subtitle="Esta ação removerá todas as contas vinculadas a esta instituição."
        icon={<Trash2 size={24} />}
        themeColor="#ef4444" // Red for destructive action
        width="max-w-md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteData(null)}
              className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors font-medium text-sm"
              disabled={isDeleting !== null}
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteInstitution}
              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-500/20 transition-all flex items-center gap-2"
              disabled={isDeleting !== null}
            >
              {isDeleting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Removendo...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Sim, desconectar</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 text-red-200">
            <AlertCircle size={20} className="shrink-0 text-red-400" />
            <div className="text-sm">
              <p className="font-bold text-red-400 mb-1">Atenção: Ação Irreversível</p>
              <p className="opacity-80">
                Ao desconectar <strong>{deleteData?.institutionName}</strong>, as contas deixarão de ser sincronizadas.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Contas afetadas:</p>
            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-1 max-h-[150px] overflow-y-auto custom-scrollbar">
              {deleteData?.accounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400">
                    {isCardFromInstitution(acc) ? <CreditCard size={14} /> : <Wallet size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-300 truncate">{acc.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {acc.accountNumber ? `Conta: ${acc.accountNumber} ` : translateAccountType(acc.type, acc.subtype)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-mono font-medium ${acc.balance < 0 ? 'text-red-400' : 'text-emerald-400'} `}>
                      {formatCurrency(acc.balance, acc.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Option to delete transactions */}
          <div className="pt-2">
            <div
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${deleteIncludeTransactions ? 'bg-red-500/10 border-red-500/40' : 'bg-red-500/5 border-red-500/10 hover:bg-red-500/10 hover:border-red-500/20'} `}
              onClick={() => setDeleteIncludeTransactions(!deleteIncludeTransactions)}
            >
              <div className={`w-5 h-5 mt-0.5 rounded-lg flex items-center justify-center transition-all border flex-shrink-0 ${deleteIncludeTransactions ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-gray-800 border-gray-700 text-transparent group-hover:border-gray-600'} `}>
                <Check size={12} strokeWidth={4} />
              </div>
              <div className="text-sm">
                <span className="font-bold text-white group-hover:text-red-100 transition-colors">Apagar todas as transações</span>
                <p className="text-gray-400 text-xs mt-0.5 group-hover:text-gray-300">
                  Se marcado, todo o histórico de transações (receitas, despesas, cartões) vinculado a estas contas será excluído permanentemente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </UniversalModal>

      <BankConnectModal
        isOpen={showBankModal}
        onClose={() => {
          setShowBankModal(false);
          setForceSyncItemId(null);
        }}
        userId={userId || null}
        onSuccess={handleBankConnected}
        forceSyncItemId={forceSyncItemId}
        dailyCredits={dailyCredits}
        maxCreditsPerDay={MAX_CREDITS_PER_DAY}
        userPlan={userPlan}
        isAdmin={isAdmin}
      />

      <ManageManualAccountModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        userId={userId || undefined}
        existingAccount={editingAccount}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />

    </div >
  );
};
