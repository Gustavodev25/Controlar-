import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectedAccount } from "../types";
import { Wallet, Building, CreditCard, RotateCcw, ChevronLeft, ChevronRight, PieChart, Trash2, Lock, Plus, Pig } from "./Icons";
import NumberFlow from '@number-flow/react';

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
  const [accountPages, setAccountPages] = useState<Record<string, number>>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteData, setDeleteData] = useState<{ accounts: ConnectedAccount[], institutionName: string } | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [forceSyncItemId, setForceSyncItemId] = useState<string | null>(null);
  const [timers, setTimers] = useState<Record<string, { h: number; m: number; s: number } | null>>({});
  const accountsPerPage = 3;
  const toast = useToasts();

  const handleBankConnected = (newAccounts: ConnectedAccount[]) => {
    if (forceSyncItemId) {
      toast.success("Sincronização concluída.");
    } else {
      toast.success(`${newAccounts.length} conta(s) conectada(s) com sucesso!`);
    }
    if (onRefresh) onRefresh();
  };

  // Helper to calculate time remaining until next sync (00:00)
  const getTimeRemaining = (lastSyncedStr: string) => {
    if (!lastSyncedStr) return null;
    const lastSync = new Date(lastSyncedStr);

    if (isNaN(lastSync.getTime())) return null;

    // Próxima sincronização é às 17:03
    const now = new Date();
    const nextSync = new Date(now);
    nextSync.setHours(17, 3, 0, 0); // Define para 17:03

    // Se já passou das 17:03 hoje, a próxima é amanhã às 17:03
    if (now > nextSync) {
        nextSync.setDate(nextSync.getDate() + 1);
    }

    const diff = nextSync.getTime() - now.getTime();

    if (diff <= 0) return null; // Should basically never happen with logic above

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { h: hours, m: minutes, s: seconds };
  };

  // Update timers every second
  useEffect(() => {
    const updateTimers = () => {
      const newTimers: Record<string, { h: number; m: number; s: number } | null> = {};
      Object.entries(lastSynced).forEach(([id, dateStr]) => {
        if (dateStr) {
          newTimers[id] = getTimeRemaining(dateStr);
        }
      });
      setTimers(newTimers);
    };

    updateTimers(); // Initial run
    const interval = setInterval(updateTimers, 1000); // Update every second
    return () => clearInterval(interval);
  }, [lastSynced]);

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



  // Open Finance disabled - no connection functionality

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
            const { accounts: institutionAccounts, institution: institutionName } = data;

            // Logic for sync header
            const representativeAccount = institutionAccounts.find(acc => lastSynced[acc.id] && acc.connectionMode !== 'MANUAL');
            const representativeId = representativeAccount?.id;
            const timer = representativeId ? timers[representativeId] : null;
            const syncItemId = institutionAccounts.find(acc => acc.connectionMode !== 'MANUAL' && acc.itemId)?.itemId;

            const currentPage = accountPages[groupKey] || 1;
            const totalPages = Math.ceil(institutionAccounts.length / accountsPerPage);
            const startIndex = (currentPage - 1) * accountsPerPage;
            const endIndex = startIndex + accountsPerPage;
            const paginatedInstitutionAccounts = institutionAccounts.slice(startIndex, endIndex);

            return (
              <div key={groupKey} className="border border-gray-800 rounded-2xl shadow-xl flex flex-col group relative overflow-hidden transition-all hover:border-gray-700" style={{ backgroundColor: '#30302E' }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#d97757] pointer-events-none transition-opacity group-hover:opacity-10"></div>

                <div className="backdrop-blur-sm p-5 rounded-t-2xl border-b border-gray-800 flex items-center justify-between gap-3 relative z-10" style={{ backgroundColor: '#333432' }}>
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

                  {representativeId && lastSynced[representativeId] && (
                    <div className="flex flex-col items-end mr-2">
                      <div className="text-[9px] text-gray-500 font-medium flex items-center gap-1">
                        <span>Próxima:</span>
                        {timer ? (
                          <span className="text-[#d97757] font-bold flex items-center gap-0.5">
                            <NumberFlow value={timer.h} format={{ minimumIntegerDigits: 2 }} />h{" "}
                            <NumberFlow value={timer.m} format={{ minimumIntegerDigits: 2 }} />m{" "}
                            <NumberFlow value={timer.s} format={{ minimumIntegerDigits: 2 }} />s
                          </span>
                        ) : (
                          <span className="text-[#d97757] font-bold">Agora</span>
                        )}
                      </div>
                      <p className="text-[9px] text-gray-600 font-medium flex items-center gap-1">
                        <span>Última:</span>
                        {new Date(lastSynced[representativeId]).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {isAdmin && syncItemId && (
                      <TooltipIcon content="Sincronizar agora (admin)">
                        <button
                          onClick={() => {
                            setForceSyncItemId(syncItemId);
                            setShowBankModal(true);
                          }}
                          disabled={isDeleting !== null}
                          className="text-[#d97757] hover:text-[#e08b70] p-2 hover:bg-[#d97757]/10 rounded-lg transition-all disabled:opacity-50"
                        >
                          <RotateCcw size={18} />
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
