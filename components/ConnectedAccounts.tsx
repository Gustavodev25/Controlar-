import React, { useEffect, useMemo, useState } from "react";
import { ConnectedAccount } from "../types";
import { Wallet, Building, CreditCard, RotateCcw, Sparkles, RefreshCw, ChevronDown, ChevronUp, Download, ChevronLeft, ChevronRight } from "./Icons";
import { triggerItemUpdate, syncPluggyData } from "../services/pluggyService";
import { useToasts } from "./Toast";
import { EmptyState } from "./EmptyState";

interface ConnectedAccountsProps {
  accounts: ConnectedAccount[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onImport?: (account: ConnectedAccount) => Promise<number>;
  lastSynced?: Record<string, string>;
  storageKey?: string; // persist expanded state
  userId?: string | null; // Add userId prop for sync
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
  onImport,
  lastSynced = {},
  storageKey,
  userId
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [syncingItems, setSyncingItems] = useState<Set<string>>(new Set());
  const [accountPages, setAccountPages] = useState<Record<string, number>>({});
  const accountsPerPage = 3;
  const toast = useToasts();

  const accountIds = useMemo(() => accounts.map((a) => a.id).join(","), [accounts]);

  // Lógica para Agrupar contas por Instituição (Banco) e ItemId
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

  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            setExpanded(new Set(arr));
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }
    const ids = new Set(accounts.map((a) => a.id));
    setExpanded(ids); 
  }, [accountIds, storageKey]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (storageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  };

  const handleSyncItem = async (institutionName: string, itemId: string) => {
    if (!userId) {
        toast.error("Faça login para sincronizar.");
        return;
    }
    if (syncingItems.has(itemId)) return;

    setSyncingItems(prev => new Set(prev).add(itemId));
    
    const syncProcess = async () => {
       const success = await triggerItemUpdate(itemId);
       if (!success) throw new Error("O banco não respondeu a tempo ou houve erro na conexão.");

       const count = await syncPluggyData(userId, itemId);
       
       if (onRefresh) {
         onRefresh();
       }
       
       return count;
    };

    try {
        await toast.promise(
            syncProcess(),
            {
                loading: `Conectando ao ${institutionName}...`,
                success: (count) => `${count} atualizações encontradas!`,
                error: (err) => `Erro: ${err instanceof Error ? err.message : "Falha na sincronização."}`
            }
        );
    } catch (err) {
        console.error(err);
    } finally {
        setSyncingItems(prev => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
        });
    }
  };

  const importingRef = React.useRef<Set<string>>(new Set());

  const handleImport = async (acc: ConnectedAccount) => {
    if (!onImport) return;
    if (importingRef.current.has(acc.id)) return;

    importingRef.current.add(acc.id);
    setImporting((prev) => new Set(prev).add(acc.id));
    try {
      await onImport(acc);
    } finally {
      importingRef.current.delete(acc.id);
      setImporting((prev) => {
        const next = new Set(prev);
        next.delete(acc.id);
        return next;
      });
    }
  };

  const isCardFromInstitution = (acc: ConnectedAccount) => {
    const type = (acc.type || "").toLowerCase();
    const subtype = (acc.subtype || "").toLowerCase();
    return type.includes("credit") || subtype.includes("credit") || subtype.includes("card");
  };

  return (
    <div className="w-full space-y-8 animate-fade-in font-sans pb-10">

      {/* HEADER PADRONIZADO - só mostra se houver contas */}
      {accounts.length > 0 && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Bancos Conectados</h2>
            <p className="text-gray-400 text-sm mt-1">Gerencie suas conexões Open Finance</p>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all border border-gray-800 hover:border-gray-700 shadow-lg"
            >
              <RotateCcw size={18} className={isLoading ? "animate-spin" : ""} />
              <span className="hidden sm:inline font-bold text-sm">Atualizar</span>
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        // Loading Skeleton Estilizado
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
      ) : accounts.length === 0 ? (
        <EmptyState
          title="Nenhuma conta conectada"
          description="Conecte suas contas bancárias para visualizar seus saldos e transações em um só lugar através do Open Finance."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(groupedAccounts).map(([institution, data]) => {
            const { accounts: institutionAccounts, itemId } = data;
            const isSyncing = syncingItems.has(itemId);

            // Paginação para as contas deste banco
            const currentPage = accountPages[institution] || 1;
            const totalPages = Math.ceil(institutionAccounts.length / accountsPerPage);
            const startIndex = (currentPage - 1) * accountsPerPage;
            const endIndex = startIndex + accountsPerPage;
            const paginatedInstitutionAccounts = institutionAccounts.slice(startIndex, endIndex);

            return (
            <div key={institution} className="bg-gray-950 border border-gray-800 rounded-2xl shadow-xl flex flex-col group relative overflow-hidden">
              {/* Glow Effect */}
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-5 bg-[#d97757] pointer-events-none transition-opacity group-hover:opacity-10"></div>
              
              {/* Cabeçalho do Card do Banco */}
              <div className="bg-gray-950/80 backdrop-blur-sm p-5 border-b border-gray-800 flex items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-[#d97757] shadow-inner">
                        <Building size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Instituição</p>
                        <h4 className="text-base font-bold text-white leading-tight">
                        {institution}
                        </h4>
                    </div>
                </div>
                
                {/* Botão de Sincronizar Instituição Específica */}
                <button 
                    onClick={() => handleSyncItem(institution, itemId)}
                    disabled={isSyncing}
                    title="Sincronizar agora com o banco"
                    className={`p-2.5 rounded-xl transition-all border ${isSyncing ? 'bg-gray-900 text-gray-500 border-gray-800 cursor-not-allowed' : 'bg-gray-900 hover:bg-[#d97757]/10 text-gray-400 hover:text-[#d97757] border-gray-800 hover:border-[#d97757]/30'}`}
                >
                    <RefreshCw size={18} className={isSyncing ? "animate-spin text-[#d97757]" : ""} />
                </button>
              </div>

              {/* Lista de Contas dentro do Banco */}
              <div className="p-4 space-y-3 bg-gray-950 relative z-10 flex-1">
                {paginatedInstitutionAccounts.map((acc) => {
                  const expandedCard = expanded.has(acc.id);
                  const isCredit = isCardFromInstitution(acc);

                  return (
                    <div key={acc.id} className="bg-gray-900/30 border border-gray-800/60 rounded-xl hover:border-gray-700 transition-colors">
                      {/* Resumo da Conta */}
                      <div className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex gap-3">
                                <div className={`mt-0.5 p-2 rounded-lg ${isCredit ? "bg-amber-500/10 text-amber-500" : "bg-[#d97757]/10 text-[#d97757]"}`}>
                                    {isCredit ? <CreditCard size={18} /> : <Wallet size={18} />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-200">{acc.name}</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">
                                        {acc.type} {acc.subtype ? `· ${acc.subtype}` : ""}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`text-base font-mono font-bold ${acc.balance < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                    {formatCurrency(acc.balance, acc.currency)}
                                </p>
                                {lastSynced[acc.id] && (
                                    <p className="text-[9px] text-gray-600 mt-0.5 font-medium">
                                        {new Date(lastSynced[acc.id]).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                          </div>

                          {/* Ações da Conta */}
                          <div className="flex items-center justify-between pt-2">
                            <button
                              onClick={() => toggle(acc.id)}
                              className="text-[11px] font-bold uppercase tracking-wider text-gray-500 hover:text-white flex items-center gap-1 transition-colors group/btn"
                            >
                              {expandedCard ? (
                                <>Esconder <ChevronUp size={12} className="group-hover/btn:-translate-y-0.5 transition-transform" /></>
                              ) : (
                                <>Ver Extrato <ChevronDown size={12} className="group-hover/btn:translate-y-0.5 transition-transform" /></>
                              )}
                            </button>
                            
                            {onImport && (
                                <button
                                onClick={() => handleImport(acc)}
                                disabled={importing.has(acc.id)}
                                className={`text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                    importing.has(acc.id)
                                    ? "text-gray-500 bg-gray-800 cursor-wait"
                                    : "text-[#d97757] bg-[#d97757]/10 hover:bg-[#d97757]/20 border border-[#d97757]/20 hover:border-[#d97757]/40"
                                }`}
                                >
                                {importing.has(acc.id) ? (
                                    <RefreshCw size={10} className="animate-spin" />
                                ) : (
                                    <Download size={10} />
                                )}
                                {importing.has(acc.id) ? "Importando..." : "Importar"}
                                </button>
                            )}
                          </div>
                      </div>

                      {/* Área Expandida (Extrato) */}
                      {expandedCard && (
                        <div className="bg-gray-950/50 border-t border-gray-800/50 p-3 animate-slide-down">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-1.5 pl-1">
                            <Sparkles size={10} className="text-[#d97757]" /> Últimas movimentações
                          </p>
                          {acc.previewTransactions && acc.previewTransactions.length > 0 ? (
                            <div className="space-y-1">
                              {acc.previewTransactions.map((tx) => {
                                const isExpense = tx.amount < 0;
                                return (
                                  <div key={tx.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors border border-gray-800/50">
                                    <div className="flex flex-col w-2/3">
                                        <span className="text-gray-300 truncate font-medium">{tx.description}</span>
                                        <span className="text-[9px] text-gray-600">{tx.date ? new Date(tx.date).toLocaleDateString('pt-BR') : 'Data n/a'}</span>
                                    </div>
                                    <span className={`font-mono font-bold ${isExpense ? "text-gray-300" : "text-emerald-400"}`}>
                                      {formatCurrency(tx.amount, tx.currency || acc.currency)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-4 bg-gray-900/30 rounded-lg border border-dashed border-gray-800">
                                <p className="text-[11px] text-gray-500 font-medium">Nenhuma movimentação recente.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Controles de Paginação dentro do card do banco */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-gray-800/50">
                    <button
                      onClick={() => setAccountPages(prev => ({ ...prev, [institution]: Math.max(1, currentPage - 1) }))}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-lg transition-all border ${
                        currentPage === 1
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
                      className={`p-2 rounded-lg transition-all border ${
                        currentPage === totalPages
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