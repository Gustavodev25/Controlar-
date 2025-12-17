import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectedAccount } from "../types";
import { Wallet, Building, CreditCard, RotateCcw, ChevronLeft, ChevronRight, Trash2, Lock, Plus, Pig, Clock, CheckCircle, AlertCircle, Loader2 } from "./Icons";
import NumberFlow from '@number-flow/react';
import { toast as sonnerToast } from "sonner";

import { EmptyState } from "./EmptyState";
import * as dbService from "../services/database";
import { useToasts } from "./Toast";
import { TooltipIcon } from "./UIComponents";
import { ConfirmationBar } from './ConfirmationBar';
import { BankConnectModal } from "./BankConnectModal";

interface ConnectedAccountsProps {
  accounts: ConnectedAccount[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onDebugSync?: () => void;
  lastSynced?: Record<string, string>;
  storageKey?: string;
  userId?: string | null;
  memberId?: string;
  isProMode?: boolean;
  isAdmin?: boolean;
}

const formatCurrency = (value?: number, currency: string = "BRL") => {
  if (value === undefined || value === null) return "--";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
};

// Tradução dos tipos de conta do Pluggy
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

  // Se tiver subtype, prioriza a tradução dele
  if (subtype && subtypeMap[subtype]) {
    return subtypeMap[subtype];
  }

  // Se tiver type, traduz
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
}

export const ConnectedAccounts: React.FC<ConnectedAccountsProps> = ({
  accounts,
  isLoading = false,
  onRefresh,
  onDebugSync,
  lastSynced = {},
  userId,
  isProMode = true,
  isAdmin = false
}) => {
  const [limitView, setLimitView] = useState<Set<string>>(new Set());
  const activeToastId = useRef<string | number | null>(null);
  const [accountPages, setAccountPages] = useState<Record<string, number>>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteData, setDeleteData] = useState<{ accounts: ConnectedAccount[], institutionName: string } | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [forceSyncItemId, setForceSyncItemId] = useState<string | null>(null);

  // Timer State with structure for Auto (24h) and Manual (15m)
  const [timers, setTimers] = useState<Record<string, { auto: { h: number; m: number; s: number }; cooldownMs: number; isFresh: boolean } | null>>({});

  // Sync Status State
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemSyncStatus>>({});
  const [isSyncingItem, setIsSyncingItem] = useState<Record<string, boolean>>({});

  const accountsPerPage = 3;
  const toast = useToasts();

  // Constants
  const AUTO_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  const MANUAL_SYNC_COOLDOWN = 15 * 60 * 1000; // 15 minutes

  const handleBankConnected = (newAccounts: ConnectedAccount[]) => {
    if (forceSyncItemId) {
      toast.success("Sincronização concluída.");
    } else {
      toast.success(`${newAccounts.length} conta(s) conectada(s) com sucesso!`);
    }
    if (onRefresh) onRefresh();
  };

  // Fetch sync status periodically
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
            lastUpdatedAt: item.lastUpdatedAt
          };
        });
        setItemStatuses(statusMap);

        // Update active sync toast if exists
        if (data.syncStatus && activeToastId.current) {
          const { state, message } = data.syncStatus;

          if (state === 'in_progress' || state === 'pending') {
            sonnerToast.loading(message || "Sincronizando...", { id: activeToastId.current });
          } else if (state === 'success') {
            sonnerToast.success(message || "Sincronização concluída!", { id: activeToastId.current });
            activeToastId.current = null; // Stop tracking
            if (onRefresh) onRefresh();
          } else if (state === 'error') {
            sonnerToast.error(message || "Erro na sincronização.", { id: activeToastId.current });
            activeToastId.current = null;
          }
        }

        // Also update global refresh if needed
        if (data.syncStatus?.state === 'success' && onRefresh) {
          // Optional: Trigger refresh if we detect a completed sync that we weren't tracking locally
        }
      }
    } catch (error) {
      console.error("Error fetching statuses", error);
    }
  }, [userId, onRefresh]);

  useEffect(() => {
    fetchItemStatuses();
    const interval = setInterval(fetchItemStatuses, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchItemStatuses]);

  // Helper to calculate time remaining
  const calculateTimers = (lastSyncedStr: string) => {
    if (!lastSyncedStr) return null;
    const lastSync = new Date(lastSyncedStr);

    if (isNaN(lastSync.getTime())) return null;

    const now = new Date();
    const elapsed = now.getTime() - lastSync.getTime();

    // Auto Sync Timer (Count down to 24h)
    const nextAutoSyncMs = Math.max(0, AUTO_SYNC_INTERVAL - elapsed);

    // Manual Sync Cooldown (Count down to 15m)
    const manualCooldownMs = Math.max(0, MANUAL_SYNC_COOLDOWN - elapsed);

    // Format Auto Sync
    const h = Math.floor(nextAutoSyncMs / (1000 * 60 * 60));
    const m = Math.floor((nextAutoSyncMs % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((nextAutoSyncMs % (1000 * 60)) / 1000);

    return {
      auto: { h, m, s },
      cooldownMs: manualCooldownMs,
      isFresh: elapsed < 5 * 60 * 1000 // Considered "fresh" if updated < 5 mins ago
    };
  };

  // Update timers every second
  useEffect(() => {
    const updateTimers = () => {
      const newTimers: Record<string, { auto: { h: number; m: number; s: number }, cooldownMs: number, isFresh: boolean } | null> = {};

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

  // Agrupa contas por itemId (mesma conexão bancária) para garantir que contas do mesmo banco fiquem juntas
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, { accounts: ConnectedAccount[], itemId: string, institution: string }> = {};
    accounts.forEach((acc) => {
      // Usa itemId como chave principal para agrupar contas da mesma conexão
      const key = acc.itemId || acc.institution || "Outros";
      if (!groups[key]) {
        groups[key] = {
          accounts: [],
          itemId: acc.itemId,
          institution: acc.institution || "Banco"
        };
      }
      groups[key].accounts.push(acc);
      // Atualiza o nome da instituição se encontrar um melhor
      if (acc.institution && acc.institution !== "Banco" && groups[key].institution === "Banco") {
        groups[key].institution = acc.institution;
      }
    });
    return groups;
  }, [accounts]);

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

  // Helper para obter ícone e cor baseado no tipo de conta
  const getAccountIcon = (acc: ConnectedAccount) => {
    if (isCardFromInstitution(acc)) {
      return { icon: <CreditCard size={18} />, bgClass: 'bg-amber-500/10 text-amber-500' };
    }
    if (isSavingsAccount(acc)) {
      return { icon: <Pig size={18} />, bgClass: 'bg-emerald-500/10 text-emerald-400' };
    }
    // Conta corrente ou outro tipo
    return { icon: <Wallet size={18} />, bgClass: 'bg-[#d97757]/10 text-[#d97757]' };
  };

  const handleManualSync = async (itemId: string) => {
    if (!userId || isSyncingItem[itemId]) return;

    // Start tracking with toast
    activeToastId.current = sonnerToast.loading("Iniciando processo de reconexão...");

    setIsSyncingItem(prev => ({ ...prev, [itemId]: true }));
    try {
      const response = await fetch(`/api/pluggy/trigger-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, userId })
      });
      const data = await response.json();
      if (data.success) {
        // Update toast to pending status immediately
        sonnerToast.loading("Solicitando atualização ao banco...", { id: activeToastId.current });
        fetchItemStatuses(); // Refresh immediately
      } else {
        sonnerToast.error(data.error || "Erro ao iniciar sincronização.", { id: activeToastId.current });
        activeToastId.current = null;
      }
    } catch (error) {
      console.error("Sync error", error);
      sonnerToast.error("Erro ao sincronizar.", { id: activeToastId.current });
      activeToastId.current = null;
    } finally {
      setIsSyncingItem(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const handleDeleteInstitution = async () => {
    if (!userId || !deleteData) return;

    const { accounts: institutionAccounts, institutionName } = deleteData;

    setIsDeleting(institutionName);
    try {
      // Delete all accounts from this institution
      for (const acc of institutionAccounts) {
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

  // --- MANUAL MODE BLOCK ---
  if (!isProMode) {
    return (
      <div className="w-full space-y-8 animate-fade-in font-sans pb-10">
        {/* Header */}
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Contas Conectadas</h2>
            <p className="text-gray-400 text-sm mt-1">Gerencie seus bancos e cartões</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setForceSyncItemId(null);
              setShowBankModal(true);
            }}
            className="bg-[#d97757] hover:bg-[#c66646] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg font-bold text-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Conectar Banco</span>
          </button>
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

      {/* List Header */}
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

            // Logic for sync header
            const timer = itemId ? timers[itemId] : null;
            const itemStatus = itemId ? itemStatuses[itemId] : null;
            const isUpdating = itemStatus?.status === 'UPDATING' || isSyncingItem[itemId || ''] === true;
            const isLoginError = itemStatus?.status === 'LOGIN_ERROR';
            const isWait = itemStatus?.status === 'WAITING_USER_INPUT';
            const isFresh = timer?.isFresh || false;

            const canManuallySync = itemId && (timer?.cooldownMs === 0 || isLoginError);

            const currentPage = accountPages[groupKey] || 1;
            const totalPages = Math.ceil(institutionAccounts.length / accountsPerPage);
            const startIndex = (currentPage - 1) * accountsPerPage;
            const endIndex = startIndex + accountsPerPage;
            const paginatedInstitutionAccounts = institutionAccounts.slice(startIndex, endIndex);

            return (
              <div key={groupKey} className="border border-gray-800 rounded-2xl shadow-xl flex flex-col group relative overflow-hidden transition-all hover:border-gray-700" style={{ backgroundColor: '#30302E' }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#d97757] pointer-events-none transition-opacity group-hover:opacity-10"></div>

                <div className="backdrop-blur-sm p-5 rounded-t-2xl border-b border-gray-800 flex flex-col relative z-10 gap-4" style={{ backgroundColor: '#333432' }}>

                  {/* Top Bar: Icon + Name + Actions */}
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
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {itemId && (
                        <TooltipIcon content="Sincronizar agora">
                          <button
                            onClick={() => handleManualSync(itemId)}
                            disabled={isDeleting !== null || isUpdating}
                            className={`p-2 rounded-lg transition-all disabled:opacity-50 ${isUpdating ? 'animate-spin text-[#d97757]' : 'text-[#d97757] hover:text-[#e08b70] hover:bg-[#d97757]/10'}`}
                          >
                            {isUpdating ? <Loader2 size={18} /> : <RotateCcw size={18} />}
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

                  {/* Status Bar */}
                  {itemId && (
                    <div className="flex items-center justify-between text-xs bg-gray-900/50 p-2 rounded-lg border border-gray-800/50">
                      <div className="flex items-center gap-1.5">
                        {isUpdating ? (
                          <>
                            <Loader2 size={12} className="text-[#d97757] animate-spin" />
                            <span className="text-[#d97757] font-medium">Sincronizando...</span>
                          </>
                        ) : isLoginError ? (
                          <>
                            <AlertCircle size={12} className="text-red-400" />
                            <span className="text-red-400 font-medium">Erro de login</span>
                          </>
                        ) : isWait ? (
                          <>
                            <AlertCircle size={12} className="text-yellow-400" />
                            <span className="text-yellow-400 font-medium">Aguardando ação</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={12} className="text-green-500/70" />
                            <span className="text-green-500/70 font-medium">Conectado</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-gray-500">
                        {/* Status Right Side Cleared */}
                      </div>
                    </div>
                  )}

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
                        const isCredit = isCardFromInstitution(acc);
                        const showLimit = limitView.has(acc.id);

                        const limit = acc.creditLimit || 0;
                        const available = acc.availableCreditLimit || 0;
                        const used = limit - available;
                        const limitPercentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                        const isManual = acc.connectionMode === 'MANUAL';

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
                                  <p className={`text-base font-mono font-bold whitespace-nowrap ${acc.balance < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                    {formatCurrency(acc.balance, acc.currency)}
                                  </p>
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

      {/* Delete Confirmation */}
      <ConfirmationBar
        isOpen={!!deleteData}
        onCancel={() => setDeleteData(null)}
        onConfirm={() => {
          handleDeleteInstitution();
        }}
        label="Desconectar Conta?"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isDestructive={true}
      />

      {/* Bank Connect Modal */}
      <BankConnectModal
        isOpen={showBankModal}
        onClose={() => {
          setShowBankModal(false);
          setForceSyncItemId(null);
        }}
        userId={userId || null}
        onSuccess={handleBankConnected}
        forceSyncItemId={forceSyncItemId}
      />

    </div>
  );
};
