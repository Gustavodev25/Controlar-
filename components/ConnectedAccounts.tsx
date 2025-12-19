import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectedAccount } from "../types";
import { Wallet, Building, CreditCard, RotateCcw, ChevronLeft, ChevronRight, Trash2, Lock, Plus, Pig, Clock, CheckCircle, Check, AlertCircle, Loader2, LinkIcon, AnimatedClock, Info } from "./Icons";
import NumberFlow from '@number-flow/react';
import { toast as sonnerToast } from "sonner";

import { EmptyState } from "./EmptyState";
import * as dbService from "../services/database";
import { useToasts } from "./Toast";
import { TooltipIcon } from "./UIComponents";
import { UniversalModal } from "./UniversalModal";
import { BankConnectModal } from "./BankConnectModal";
import Lottie from "lottie-react";
import linkAnimation from "../assets/link.json";

interface ConnectedAccountsProps {
  accounts: ConnectedAccount[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onDebugSync?: () => void;
  lastSynced?: Record<string, string>;
  userId?: string | null;
  selectedMemberId?: string;
  isProMode?: boolean;
  isAdmin?: boolean;
  userPlan?: string;
  onUpgrade?: () => void;
  dailyCredits?: { date: string, count: number };
}

const formatCurrency = (value?: number, currency: string = "BRL") => {
  if (value === undefined || value === null) return "--";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
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
    return `${translatedType} - ${translatedSubtype}`;
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
  isProMode = true,
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
  const [forceSyncItemId, setForceSyncItemId] = useState<string | null>(null);
  const [timers, setTimers] = useState<Record<string, { auto: { h: number; m: number; s: number }; cooldownMs: number; syncedToday: boolean; isFresh: boolean } | null>>({});

  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemSyncStatus>>({});
  const [isSyncingItem, setIsSyncingItem] = useState<Record<string, boolean>>({});
  const [globalSyncStatus, setGlobalSyncStatus] = useState<GlobalSyncStatus | null>(null);
  const [syncJobs, setSyncJobs] = useState<Record<string, dbService.SyncJob>>({});

  const accountsPerPage = 3;
  const toast = useToasts();

  // --- DAILY CREDIT LOGIC ---
  const MAX_CREDITS_PER_DAY = (userPlan === 'starter') ? 0 : 3;
  // Use today's date to validate credits
  const todayDateStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

  // Debug logic
  useEffect(() => {
    console.log('[ConnectedAccounts] Received dailyCredits:', dailyCredits, 'Today:', todayDateStr);
  }, [dailyCredits, todayDateStr]);

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

  // Debug Helper
  const handleDebugIncrement = async () => {
    if (userId) {
      console.log('[Debug] Manually triggering credit increment...');
      const newCount = await dbService.incrementDailyConnectionCredits(userId);
      toast.success(`Debug: Créditos incrementados para ${newCount}`);
    }
  };

  const calculateTimers = (lastSyncedStr: string) => {
    if (!lastSyncedStr) return {
      auto: { h: 0, m: 0, s: 0 },
      cooldownMs: 0,
      syncedToday: false,
      isFresh: false
    };

    const lastSync = new Date(lastSyncedStr);
    const now = new Date();

    if (isNaN(lastSync.getTime())) return null;

    const elapsed = now.getTime() - lastSync.getTime();

    // Global Reset is always next midnight
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const nextAutoSyncMs = nextMidnight.getTime() - now.getTime();

    // Check if last sync was today (same date)
    const lastSyncDate = lastSync.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const todayDate = now.toLocaleDateString('en-CA');
    const syncedToday = lastSyncDate === todayDate;

    // If synced today, cooldown until midnight. Otherwise, no cooldown.
    const manualCooldownMs = syncedToday ? nextAutoSyncMs : 0;

    const h = Math.floor(nextAutoSyncMs / (1000 * 60 * 60));
    const m = Math.floor((nextAutoSyncMs % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((nextAutoSyncMs % (1000 * 60)) / 1000);

    return {
      auto: { h, m, s },
      cooldownMs: manualCooldownMs,
      syncedToday,
      isFresh: elapsed < 5 * 60 * 1000 // 5 mins fresh
    };
  };

  // Maintain timer state for display
  useEffect(() => {
    const updateTimers = () => {
      const newTimers: Record<string, { auto: { h: number; m: number; s: number }, cooldownMs: number, syncedToday: boolean, isFresh: boolean } | null> = {};
      const mergedLastSynced = { ...lastSynced };
      Object.values(itemStatuses).forEach(status => {
        if (status.lastUpdatedAt) {
          mergedLastSynced[status.id] = status.lastUpdatedAt;
        }
      });
      Object.entries(mergedLastSynced).forEach(([id, dateStr]) => {
        if (dateStr) {
          newTimers[id] = calculateTimers(dateStr);
        }
      });
      setTimers(newTimers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [lastSynced, itemStatuses]);

  let connectButtonTooltip = "";
  if (userPlan === 'starter') {
    connectButtonTooltip = "Plano Starter não permite conexões automáticas. Faça um upgrade!";
  } else if (!isCreditsLoaded) {
    connectButtonTooltip = "Carregando informações de crédito...";
  } else if (!hasCredit) {
    connectButtonTooltip = `Limite de ${MAX_CREDITS_PER_DAY} conexões diárias atingido. Aguarde até meia-noite.`;
  }

  const handleBankConnected = async (newAccounts: ConnectedAccount[], syncJobId?: string) => {
    // Connection started - show initial feedback
    // Progress will be shown via sync jobs listener
    if (forceSyncItemId) {
      sonnerToast.info("Sincronização iniciada! Acompanhe o progresso abaixo.", { duration: 3000 });
    } else {
      sonnerToast.info("Conexão iniciada! Seus dados aparecerão em breve.", { duration: 3000 });
    }

    console.log('[ConnectedAccounts] Bank connected, syncJobId:', syncJobId);

    // Refresh to show the new connection (if any)
    if (onRefresh) onRefresh();
  };

  const fetchItemStatuses = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/pluggy/items-status?userId=${userId}`);
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
  useEffect(() => {
    if (!userId) return;

    const unsubscribeJobs = dbService.listenToSyncJobs(userId, (jobs) => {
      // Map jobs by itemId for easy lookup
      const jobMap: Record<string, dbService.SyncJob> = {};
      jobs.forEach((job) => {
        // Only keep the most recent job per itemId
        if (!jobMap[job.itemId] ||
            (job.createdAt && jobMap[job.itemId].createdAt &&
             job.createdAt > jobMap[job.itemId].createdAt)) {
          jobMap[job.itemId] = job;
        }
      });
      setSyncJobs(jobMap);

      // Show toast notifications for job status changes
      jobs.forEach((job) => {
        if (job.status === 'completed') {
          sonnerToast.success('Sincronização concluída!', {
            id: `sync-job-${job.id}`,
            duration: 3000
          });
          if (onRefresh) onRefresh();
        } else if (job.status === 'failed') {
          const message = job.creditRefunded
            ? 'Sincronização falhou. Crédito reembolsado.'
            : 'Sincronização falhou.';
          sonnerToast.error(message, {
            id: `sync-job-${job.id}`,
            duration: 5000
          });
        }
      });
    });

    return () => {
      unsubscribeJobs();
    };
  }, [userId, onRefresh]);

  // Global Timer Display Logic
  const globalTimerDisplay = useMemo(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const diff = nextMidnight.getTime() - now.getTime();

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return { h, m, s };
  }, [timers /* trigger re-calc on tick */]);


  const groupedAccounts = useMemo(() => {
    const groups: Record<string, { accounts: ConnectedAccount[], itemId: string, institution: string }> = {};
    accounts.forEach((acc) => {
      const key = acc.itemId || acc.institution || "Outros";
      const itemStatus = acc.itemId ? itemStatuses[acc.itemId] : null;
      const connectorName = itemStatus?.connectorName;
      const institutionName = acc.institution || connectorName || "Banco";

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
    return groups;
  }, [accounts, itemStatuses]);

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

  const handleManualSync = async (itemId: string, force = false) => {
    if (!userId || isSyncingItem[itemId]) return;

    if (!force) {
      // Check if already synced today
      const itemTimer = timers[itemId];
      if (itemTimer?.syncedToday) {
        toast.error(`Este banco já foi sincronizado hoje. Próxima sincronização em ${itemTimer.auto.h}h ${itemTimer.auto.m}m.`);
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
      const response = await fetch(`/api/pluggy/trigger-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, userId })
      });
      const data = await response.json();

      if (data.success) {
        toast.info("Sincronização iniciada com sucesso!");
        fetchItemStatuses();
      } else {
        toast.error(data.error || "Erro ao iniciar sincronização.");
      }
    } catch (error) {
      console.error("Sync error", error);
      toast.error("Erro ao sincronizar.");
    } finally {
      setIsSyncingItem(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!userId) return;
    const toastId = toast.loading('Removendo duplicatas...');
    try {
      const response = await fetch('/api/pluggy/cleanup-duplicates', {
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

  if (!isProMode) {
    return (
      <div className="w-full space-y-8 animate-fade-in font-sans pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Open Finance Bloqueado</h2>
            <p className="text-gray-400 text-sm mt-1">Sincronização bancária desativada</p>
          </div>
        </div>

        <EmptyState
          title="Modo Manual Ativado"
          description="Para conectar seus bancos e sincronizar transações automaticamente, ative o Modo Automático na Visão Geral."
          icon={<Lock size={48} className="text-[#d97757]" />}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-fade-in font-sans pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Contas Conectadas</h2>
            <div className="flex items-center gap-1.5 mt-1 text-gray-400">
              {userPlan !== 'starter' && (
                <div className="w-5 h-5 flex items-center justify-center -ml-1">
                  <Lottie animationData={linkAnimation} loop={true} />
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

          <TooltipIcon content={connectButtonTooltip || (isAdmin ? "Conectar nova instituição" : "Conectar nova instituição (Consome 1 crédito)")}>
            <button
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
                }`}
            >
              {userPlan === 'starter' ? <Lock size={18} /> : <Plus size={18} />}
              <span className="hidden sm:inline">
                {userPlan === 'starter'
                  ? 'Desbloquear Conexão'
                  : !isCreditsLoaded
                    ? 'Carregando...'
                    : 'Conectar Banco'}
              </span>
            </button>
          </TooltipIcon>

          {onRefresh && accounts.length > 0 && (
            <button
              onClick={onRefresh}
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all border border-gray-800 hover:border-gray-700 shadow-lg"
            >
              <RotateCcw size={18} />
              <span className="hidden sm:inline font-bold text-sm">Atualizar</span>
            </button>
          )}
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

      {accounts.length === 0 ? (
        <EmptyState
          title="Nenhuma conta conectada"
          description="Conecte seus bancos para ver tudo em um só lugar."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(groupedAccounts).map(([groupKey, data]) => {
            const { accounts: institutionAccounts, institution: institutionName, itemId } = data;

            const timer = itemId ? timers[itemId] : null;
            const itemStatus = itemId ? itemStatuses[itemId] : null;
            const syncJob = itemId ? syncJobs[itemId] : null;

            // Determine sync state from multiple sources
            const isJobProcessing = syncJob?.status === 'processing' || syncJob?.status === 'pending';
            const isJobRetrying = syncJob?.status === 'retrying';
            const isJobFailed = syncJob?.status === 'failed';
            const wasRefunded = syncJob?.creditRefunded;

            const isUpdating = itemStatus?.status === 'UPDATING' || isSyncingItem[itemId || ''] === true || isJobProcessing;
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
                      <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-[#d97757] shadow-inner flex-shrink-0">
                        <Building size={20} />
                      </div>
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
                                return `Hoje às ${syncDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                              }
                              return syncDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                            })()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Sync Job Progress Indicator */}
                      {syncJob && (isJobProcessing || isJobRetrying) && (
                        <div className="mr-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#d97757]/10 border border-[#d97757]/30">
                            <Loader2 size={12} className="text-[#d97757] animate-spin" />
                            <span className="text-[10px] text-[#d97757] font-bold uppercase">
                              {isJobRetrying
                                ? `Tentando... (${syncJob.attempts || 1}/3)`
                                : syncJob.progress?.step || 'Sincronizando...'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Sync Job Failed Indicator */}
                      {syncJob && isJobFailed && (
                        <div className="mr-2 flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                            <AlertCircle size={12} className="text-red-400" />
                            <span className="text-[10px] text-red-400 font-bold uppercase">Falhou</span>
                          </div>
                          {wasRefunded && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                              <CheckCircle size={10} className="text-emerald-400" />
                              <span className="text-[10px] text-emerald-400 font-medium">Reembolsado</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Status badges for errors only */}
                      {itemId && (isLoginError || isWait) && !isJobFailed && (
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
                            timer?.syncedToday ? `Já sincronizado hoje. Próxima sincronização em ${timer.auto.h}h ${timer.auto.m}m` :
                              !hasCredit ? `Sem créditos diários disponíveis.` :
                                isAdmin ? "Sincronizar agora" : "Sincronizar agora (1x por dia)"
                        }>
                          <button
                            onClick={() => handleManualSync(itemId)}
                            disabled={!hasCredit || isDeleting !== null || isUpdating || timer?.syncedToday}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 text-xs font-bold shadow-sm ${isUpdating
                              ? 'bg-[#d97757]/20 text-[#d97757] border border-[#d97757]/30 animate-pulse'
                              : (!hasCredit || isDeleting !== null || timer?.syncedToday)
                                ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed border border-gray-800'
                                : 'bg-[#d97757]/10 text-[#d97757] hover:bg-[#d97757]/20 border border-[#d97757]/30 hover:border-[#d97757]/50'
                              }`}
                          >
                            <RotateCcw size={14} className={isUpdating ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">
                              {isUpdating
                                ? (globalSyncStatus?.state === 'in_progress' && globalSyncStatus?.message
                                  ? globalSyncStatus.message
                                  : "Puxando dados...")
                                : timer?.syncedToday
                                  ? `${timer.auto.h}h ${timer.auto.m}m`
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
                          <div key={acc.id} className={`border rounded-xl hover:border-gray-700 transition-colors ${isManual ? 'bg-amber-500/5 border-amber-500/20' : 'bg-gray-900/30 border-gray-800/60'}`}>
                            <div className="p-4">
                              <div className="flex justify-between items-center gap-3 mb-3">
                                <div className="flex gap-3 items-center flex-1 min-w-0">
                                  {(() => {
                                    const { icon, bgClass } = getAccountIcon(acc);
                                    return (
                                      <div className={`p-1.5 rounded-lg flex-shrink-0 ${bgClass}`}>
                                        {icon}
                                      </div>
                                    );
                                  })()}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-bold text-gray-200 truncate">{acc.name}</p>
                                      {isManual && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[9px] font-bold uppercase rounded border border-amber-500/30">Manual</span>}
                                    </div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium truncate">
                                      {acc.accountNumber ? `Conta: ${acc.accountNumber}` : translateAccountType(acc.type, acc.subtype)}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right flex-shrink-0 flex flex-col items-end">
                                  <p className={`text-base font-mono font-bold whitespace-nowrap ${isCard ? "text-amber-400" : acc.balance < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                    {formatCurrency(acc.balance, acc.currency)}
                                  </p>
                                  {/* Show bill info for credit cards */}
                                  {isCard && bill && (billDate || billStateInfo) && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {billStateInfo && (
                                        <span className={`text-[9px] font-medium ${billStateInfo.color}`}>
                                          {billStateInfo.label}
                                        </span>
                                      )}
                                      {billDate && (
                                        <span className="text-xs text-white/40 block mt-0.5">
                                          Venc. {
                                            bill.dueDate && !isNaN(new Date(bill.dueDate).getTime())
                                              ? new Date(bill.dueDate).toLocaleDateString()
                                              : 'N/A'
                                          }
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 py-3 rounded-b-2xl border-t border-gray-800/50" style={{ backgroundColor: '#333432' }}>
                    <button
                      onClick={() => setAccountPages(prev => ({ ...prev, [groupKey]: Math.max(1, currentPage - 1) }))}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-lg transition-all border ${currentPage === 1
                        ? 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed'
                        : 'bg-gray-900 hover:bg-gray-800 text-white border-gray-800 hover:border-gray-700'
                        }`}
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
                        }`}
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
                      {acc.accountNumber ? `Conta: ${acc.accountNumber}` : translateAccountType(acc.type, acc.subtype)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-mono font-medium ${acc.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
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
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${deleteIncludeTransactions ? 'bg-red-500/10 border-red-500/40' : 'bg-red-500/5 border-red-500/10 hover:bg-red-500/10 hover:border-red-500/20'}`}
              onClick={() => setDeleteIncludeTransactions(!deleteIncludeTransactions)}
            >
              <div className={`w-5 h-5 mt-0.5 rounded-lg flex items-center justify-center transition-all border flex-shrink-0 ${deleteIncludeTransactions ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-gray-800 border-gray-700 text-transparent group-hover:border-gray-600'}`}>
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

    </div >
  );
};
