import React, { useMemo, useState } from "react";
import { ConnectedAccount } from "../types";
import { Wallet, Building, CreditCard, RotateCcw, ChevronLeft, ChevronRight, PieChart, Trash2, Lock, Plus } from "./Icons";

import { EmptyState } from "./EmptyState";
import * as dbService from "../services/database";
import { useToasts } from "./Toast";
import { ConfirmationCard } from "./UIComponents";
import { BankConnectModal } from "./BankConnectModal";

interface ConnectedAccountsProps {
  accounts: ConnectedAccount[];
  isLoading?: boolean;
  onRefresh?: () => void;
  lastSynced?: Record<string, string>;
  storageKey?: string;
  userId?: string | null;
  memberId?: string;
  isProMode?: boolean;
}

const formatCurrency = (value?: number, currency: string = "BRL") => {
  if (value === undefined || value === null) return "--";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
};

export const ConnectedAccounts: React.FC<ConnectedAccountsProps> = ({
  accounts,
  isLoading = false,
  onRefresh,
  lastSynced = {},
  userId,
  isProMode = true
}) => {
  const [limitView, setLimitView] = useState<Set<string>>(new Set());
  const [accountPages, setAccountPages] = useState<Record<string, number>>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteData, setDeleteData] = useState<{ accounts: ConnectedAccount[], institutionName: string } | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const accountsPerPage = 3;
  const toast = useToasts();

  const handleBankConnected = (newAccounts: ConnectedAccount[]) => {
    toast.success(`${newAccounts.length} conta(s) conectada(s) com sucesso!`);
    if (onRefresh) onRefresh();
  };

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
          onClick={() => setShowBankModal(true)}
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
                    <button
                      onClick={() => setDeleteData({ accounts: institutionAccounts, institutionName: institution })}
                      disabled={isDeleting !== null}
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
                    const isManual = acc.connectionMode === 'MANUAL';

                    return (
                      <div key={acc.id} className={`border rounded-xl hover:border-gray-700 transition-colors ${isManual ? 'bg-amber-500/5 border-amber-500/20' : 'bg-gray-900/30 border-gray-800/60'}`}>
                        <div className="p-4">
                          <div className="flex justify-between items-center gap-3 mb-3">
                            <div className="flex gap-3 items-center flex-1 min-w-0">
                              <div className={`p-1.5 rounded-lg flex-shrink-0 ${isCredit ? "bg-amber-500/10 text-amber-500" : "bg-[#d97757]/10 text-[#d97757]"}`}>
                                {isCredit ? <CreditCard size={18} /> : <Wallet size={18} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-gray-200 truncate">{acc.name}</p>
                                  {isManual && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[9px] font-bold uppercase rounded border border-amber-500/30">Manual</span>}
                                </div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium truncate">
                                  {acc.type} {acc.subtype ? `- ${acc.subtype}` : ""}
                                </p>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0 flex flex-col items-end">
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

                          {lastSynced[acc.id] && !isManual && (
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

      {/* Delete Confirmation Card */}
      <ConfirmationCard
        isOpen={!!deleteData}
        onClose={() => setDeleteData(null)}
        onConfirm={handleDeleteInstitution}
        title="Desconectar Conta?"
        description="Esta ação removerá a conexão e as contas vinculadas. Seus lançamentos passados serão mantidos."
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isDestructive
      />

      {/* Bank Connect Modal */}
      <BankConnectModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        userId={userId || null}
        onSuccess={handleBankConnected}
      />

    </div>
  );
};
