import React, { useMemo, useState } from "react";
import { ConnectedAccount, Transaction } from "../types";
import { Wallet, Building, CreditCard, RotateCcw, ChevronLeft, ChevronRight, PieChart, Trash2, Loader2, Plus } from "./Icons";

import { EmptyState } from "./EmptyState";
import axios from "axios";
import * as dbService from "../services/database";
import { useToasts } from "./Toast";
import { BankConnectModal } from "./BankConnectModal";

interface SyncProgress {
  step: string;
  current: number;
  total: number;
}

interface ConnectedAccountsProps {
  accounts: ConnectedAccount[];
  isLoading?: boolean;
  onRefresh?: () => void;
  lastSynced?: Record<string, string>;
  storageKey?: string;
  userId?: string | null;
  memberId?: string;
}

const formatCurrency = (value?: number, currency: string = "BRL") => {
  if (value === undefined || value === null) return "--";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
};

// Sync Progress Tooltip Component
const SyncProgressTooltip: React.FC<{ progress: SyncProgress }> = ({ progress }) => (
  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 shadow-xl min-w-[200px]">
      <p className="text-white text-sm font-medium text-center whitespace-nowrap">
        {progress.step}
      </p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#d97757] rounded-full transition-all duration-300"
            style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 font-mono">
          {progress.current}/{progress.total}
        </span>
      </div>
    </div>
    {/* Arrow pointing down */}
    <div className="absolute left-1/2 -translate-x-1/2 -bottom-2">
      <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-gray-700" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[1px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[7px] border-t-gray-900" />
    </div>
  </div>
);

export const ConnectedAccounts: React.FC<ConnectedAccountsProps> = ({
  accounts,
  isLoading = false,
  onRefresh,
  lastSynced = {},
  userId
}) => {
  const [limitView, setLimitView] = useState<Set<string>>(new Set());
  const [accountPages, setAccountPages] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ step: '', current: 0, total: 0 });
  const [showSyncTooltip, setShowSyncTooltip] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const accountsPerPage = 3;
  const toast = useToasts();


  // Agrupa contas por instituicao e itemId
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, { accounts: ConnectedAccount[], itemId: string }> = {};
    accounts.forEach((acc) => {
      const key = acc.institution || "Outros";
      if (!groups[key]) {
        groups[key] = { accounts: [], itemId: acc.itemId };
      }
      groups[key].accounts.push(acc);
      if (!groups[key].itemId && acc.itemId) groups[key].itemId = acc.itemId;
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

  const handleDeleteInstitution = async (institutionAccounts: ConnectedAccount[], institutionName: string) => {
    if (!userId) return;

    const confirmed = confirm(`Deseja remover "${institutionName}" e todas as suas ${institutionAccounts.length} conta(s) conectadas?`);
    if (!confirmed) return;

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
    }
  };

  const handleConnectSuccess = async (data: any) => {
    if (!userId) return;
    
    setIsSyncing(true);
    setSyncProgress({ step: 'Iniciando sincronização...', current: 0, total: 100 });
    
    try {
        const response = await axios.post('/api/klavi/sync', {
            itemId: data.itemId,
            userId
        });
        
        const { accounts, transactions, creditCardTransactions } = response.data;
        
        if (accounts && accounts.length > 0) {
            setSyncProgress({ step: 'Salvando contas...', current: 0, total: accounts.length });
            let saved = 0;
            for (const acc of accounts) {
                await dbService.addConnectedAccount(userId, acc);
                saved++;
                setSyncProgress(prev => ({ ...prev, current: saved }));
            }
        }
        
        const allTxs = [...(transactions || []), ...(creditCardTransactions || [])];
        
        if (allTxs.length > 0) {
             setSyncProgress({ step: 'Salvando transações...', current: 0, total: allTxs.length });
             let saved = 0;
             for (const tx of allTxs) {
                 // Check if exists to avoid duplicates (dbService handles it usually, but we can be safe)
                 await dbService.addTransaction(userId, tx, tx.id); // Pass tx.id as customId
                 saved++;
                 setSyncProgress(prev => ({ ...prev, current: saved }));
             }
        }
        
        toast.success("Contas e transações sincronizadas com sucesso!");
        if (onRefresh) onRefresh();
        
    } catch (error) {
        console.error("Erro na sincronização:", error);
        toast.error("Erro ao sincronizar os dados do banco.");
    } finally {
        setIsSyncing(false);
        setSyncProgress({ step: '', current: 0, total: 0 });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Contas Conectadas</h2>
            <p className="text-gray-400 text-sm mt-1">Gerencie seus bancos e cartões</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connect Button */}
          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="bg-[#d97757] hover:bg-[#c56a4d] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#d97757]/20"
          >
            <Plus size={18} />
            <span className="hidden sm:inline font-bold text-sm">Conectar Conta</span>
          </button>

          {/* Sync Progress Indicator */}
          {isSyncing && (
            <div
              className="relative flex items-center gap-2 px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl cursor-pointer"
              onMouseEnter={() => setShowSyncTooltip(true)}
              onMouseLeave={() => setShowSyncTooltip(false)}
            >
              <Loader2 size={18} className="text-[#d97757] animate-spin" />
              <span className="text-sm text-gray-400 font-medium hidden sm:inline">Sincronizando...</span>

              {/* Tooltip */}
              {showSyncTooltip && syncProgress.step && (
                <SyncProgressTooltip progress={syncProgress} />
              )}
            </div>
          )}

          {onRefresh && accounts.length > 0 && !isSyncing && (
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all border border-gray-800 hover:border-gray-700 shadow-lg"
            >
              <RotateCcw size={18} className={isSyncing ? "animate-spin" : ""} />
              <span className="hidden sm:inline font-bold text-sm">Atualizar</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {userId && (
        <BankConnectModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          onSuccess={handleConnectSuccess}
          userId={userId}
        />
      )}


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
          {Object.entries(groupedAccounts).map(([institution, data]) => {
            const { accounts: institutionAccounts } = data;

            const currentPage = accountPages[institution] || 1;
            const totalPages = Math.ceil(institutionAccounts.length / accountsPerPage);
            const startIndex = (currentPage - 1) * accountsPerPage;
            const endIndex = startIndex + accountsPerPage;
            const paginatedInstitutionAccounts = institutionAccounts.slice(startIndex, endIndex);

            return (
              <div key={institution} className="bg-gray-950 border border-gray-800 rounded-2xl shadow-xl flex flex-col group relative overflow-hidden transition-all hover:border-gray-700">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#d97757] pointer-events-none transition-opacity group-hover:opacity-10"></div>

                <div className="bg-gray-950/80 backdrop-blur-sm p-5 border-b border-gray-800 flex items-center justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-[#d97757] shadow-inner flex-shrink-0">
                      <Building size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Instituição</p>
                      <h4 className="text-base font-bold text-white leading-tight truncate">
                        {institution}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Sync Loader in card */}
                    {isSyncing && (
                      <div
                        className="relative flex items-center gap-1.5 px-2 py-1 bg-gray-900 border border-gray-800 rounded-lg cursor-pointer"
                        onMouseEnter={() => setShowSyncTooltip(true)}
                        onMouseLeave={() => setShowSyncTooltip(false)}
                      >
                        <Loader2 size={14} className="text-[#d97757] animate-spin" />
                        <span className="text-[10px] text-gray-400 font-medium uppercase">Sync</span>

                        {/* Tooltip */}
                        {showSyncTooltip && syncProgress.step && (
                          <SyncProgressTooltip progress={syncProgress} />
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => handleDeleteInstitution(institutionAccounts, institution)}
                      disabled={isDeleting !== null || isSyncing}
                      className="text-xs text-red-400 hover:text-red-300 font-semibold uppercase border border-red-500/30 hover:border-red-500/50 rounded-lg px-2 py-1 flex items-center gap-1.5 transition-all hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Remover
                    </button>
                  </div>
                </div>




                <div className="p-4 space-y-3 bg-gray-950 relative z-10 flex-1">
                  {paginatedInstitutionAccounts.map((acc) => {
                    const isCredit = isCardFromInstitution(acc);
                    const showLimit = limitView.has(acc.id);

                    const limit = acc.creditLimit || 0;
                    const available = acc.availableCreditLimit || 0;
                    const used = limit - available;
                    const limitPercentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

                    return (
                      <div key={acc.id} className="bg-gray-900/30 border border-gray-800/60 rounded-xl hover:border-gray-700 transition-colors">
                        <div className="p-4">
                          <div className="flex justify-between items-center gap-3 mb-3">
                            <div className="flex gap-3 items-center flex-1 min-w-0">
                              <div className={`p-1.5 rounded-lg flex-shrink-0 ${isCredit ? "bg-amber-500/10 text-amber-500" : "bg-[#d97757]/10 text-[#d97757]"}`}>
                                {isCredit ? <CreditCard size={18} /> : <Wallet size={18} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-200 truncate">{acc.name}</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium truncate">
                                  {acc.type} {acc.subtype ? `- ${acc.subtype}` : ""}
                                </p>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className={`text-base font-mono font-bold whitespace-nowrap ${acc.balance < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                {formatCurrency(acc.balance, acc.currency)}
                              </p>
                            </div>
                          </div>

                          {isCredit && (
                            <div
                              onClick={() => toggleLimitView(acc.id)}
                              className="mt-3 pt-3 border-t border-gray-800/50 cursor-pointer group/limit select-none w-full"
                              title="Clique para alternar entre fatura e limite"
                            >
                              {showLimit ? (
                                <div key="limit" className="w-full animate-dropdown-open">
                                  <div className="w-full bg-gray-800 rounded-full h-1.5 mb-1 overflow-hidden border border-gray-700/50">
                                    <div
                                      className={`h-full rounded-full transition-all duration-700 ease-out ${limitPercentage > 90 ? 'bg-red-500' : limitPercentage > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${limitPercentage}%` }}
                                    ></div>
                                  </div>
                                  <div className="flex justify-between text-[8px] font-medium text-gray-400 uppercase tracking-wide">
                                    <span>{Math.round(limitPercentage)}% Uso</span>
                                    <span>Disp: {formatCurrency(available).replace('R$', '')}</span>
                                  </div>
                                </div>
                              ) : (
                                <div key="invoice" className="flex items-center justify-between animate-dropdown-open">
                                  <div className="flex items-center gap-1.5 text-gray-500">
                                    <PieChart size={12} className="group-hover/limit:text-[#d97757] transition-colors" />
                                    <span className="text-[9px] font-medium group-hover/limit:text-white transition-colors">Fatura Atual</span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {acc.balanceCloseDate && (
                                      <span className="text-[9px] text-gray-600 hidden sm:inline">
                                        Fecha {new Date(acc.balanceCloseDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                      </span>
                                    )}
                                    {acc.balanceDueDate ? (
                                      <div className="flex items-center gap-1.5 bg-gray-800/40 group-hover/limit:bg-gray-800 px-2 py-1 rounded-lg border border-gray-800/50 transition-colors">
                                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wide">
                                          Vence {new Date(acc.balanceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[9px] text-gray-500 italic">Sem vencimento</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {lastSynced[acc.id] && (
                            <div className={`mt-2 pt-2 ${!isCredit ? 'border-t border-gray-800/50' : ''} flex justify-end`}>
                              <p className="text-[9px] text-gray-600 font-medium flex items-center gap-1">
                                <RotateCcw size={8} />
                                {new Date(lastSynced[acc.id]).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-gray-800/50">
                      <button
                        onClick={() => setAccountPages(prev => ({ ...prev, [institution]: Math.max(1, currentPage - 1) }))}
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
                        onClick={() => setAccountPages(prev => ({ ...prev, [institution]: Math.min(totalPages, currentPage + 1) }))}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
