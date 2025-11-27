import React, { useEffect, useMemo, useState } from "react";
import { ConnectedAccount } from "../types";
import { Wallet, Building, CreditCard, RotateCcw, Sparkles, RefreshCw } from "./Icons";
import { triggerItemUpdate, syncPluggyData } from "../services/pluggyService";
import { useToasts } from "./Toast";

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
  if (!isLoading && accounts.length === 0) return null;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [syncingItems, setSyncingItems] = useState<Set<string>>(new Set());
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
      // Ensure we have the itemId (all accounts in a group usually share the same itemId if from same institution connection)
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
    
    try {
        // 1. Trigger update at Pluggy
        toast.message({ text: `Solicitando atualização ao ${institutionName}...`, preserve: false });
        await triggerItemUpdate(itemId);
        
        // 2. Wait a bit and fetch new data
        await toast.promise(
            syncPluggyData(userId, itemId),
            {
                loading: `Baixando novas transações do ${institutionName}...`,
                success: (count) => {
                    onRefresh?.(); // Atualiza a UI geral se possível
                    return `${count} novas transações encontradas!`;
                },
                error: "Erro ao sincronizar dados."
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
    <div className="w-full space-y-6 animate-fade-in">
      
      {/* HEADER REFEITO */}
      <div className="flex items-end justify-between px-1 pb-2">
        <div className="flex items-center gap-3">
          <div className="text-[#d97757] mb-1">
            <Building size={28} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">Open Finance</p>
            <h3 className="text-2xl font-bold text-white leading-none">Bancos conectados</h3>
          </div>
        </div>

        <div className="flex items-center gap-5 pb-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-sm font-medium text-[#d97757] hover:text-[#d97757]/80 transition-colors flex items-center gap-2"
            >
              <RotateCcw size={16} /> Atualizar Tela
            </button>
          )}
          <span className="text-sm text-gray-500 font-medium">
            {accounts.length} conta{accounts.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {isLoading ? (
        // Loading Skeleton
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-950 border border-gray-800 rounded-2xl p-5 space-y-4 animate-pulse">
              <div className="h-5 bg-gray-800 rounded w-1/3"></div>
              <div className="h-px bg-gray-800 w-full"></div>
              <div className="space-y-3">
                 <div className="h-10 bg-gray-800 rounded w-full"></div>
                 <div className="h-10 bg-gray-800 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Grid de Bancos
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(groupedAccounts).map(([institution, data]) => {
            const { accounts: institutionAccounts, itemId } = data;
            const isSyncing = syncingItems.has(itemId);

            return (
            <div key={institution} className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-lg flex flex-col">
              
              {/* Cabeçalho do Card do Banco */}
              <div className="bg-gray-900/50 p-4 border-b border-gray-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                        <Building size={14} />
                    </div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wide">
                    {institution}
                    </h4>
                </div>
                
                {/* Botão de Sincronizar Instituição Específica */}
                <button 
                    onClick={() => handleSyncItem(institution, itemId)}
                    disabled={isSyncing}
                    title="Sincronizar agora com o banco"
                    className={`p-2 rounded-full transition-all ${isSyncing ? 'bg-gray-800 text-gray-500' : 'hover:bg-gray-800 text-[#d97757] hover:text-[#ff8f6b]'}`}
                >
                    <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                </button>
              </div>

              {/* Lista de Contas dentro do Banco */}
              <div className="p-2 space-y-2">
                {institutionAccounts.map((acc) => {
                  const expandedCard = expanded.has(acc.id);
                  const isCredit = isCardFromInstitution(acc);

                  return (
                    <div key={acc.id} className="bg-gray-900/40 border border-gray-800/50 rounded-xl p-3 hover:border-gray-700 transition-colors">
                      {/* Resumo da Conta */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-3">
                            <div className={`mt-1 ${isCredit ? "text-amber-500" : "text-[#d97757]"}`}>
                                {isCredit ? <CreditCard size={18} /> : <Wallet size={18} />}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-200">{acc.name}</p>
                                <p className="text-[11px] text-gray-500">
                                    {acc.type} {acc.subtype ? `· ${acc.subtype}` : ""}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                             <p className={`text-base font-bold ${acc.balance < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                {formatCurrency(acc.balance, acc.currency)}
                             </p>
                             {lastSynced[acc.id] && (
                                <p className="text-[9px] text-gray-600 mt-0.5">
                                    Sync: {new Date(lastSynced[acc.id]).toLocaleDateString("pt-BR")}
                                </p>
                             )}
                        </div>
                      </div>

                      {/* Ações da Conta */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-800/50">
                        <button
                          onClick={() => toggle(acc.id)}
                          className="text-[11px] font-semibold text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                        >
                          {expandedCard ? "Ocultar Extrato" : "Ver Extrato"}
                        </button>
                        
                        {onImport && (
                            <button
                            onClick={() => handleImport(acc)}
                            disabled={importing.has(acc.id)}
                            className={`text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors ${
                                importing.has(acc.id)
                                ? "text-gray-600 bg-gray-800 cursor-wait"
                                : "text-[#d97757] bg-[#d97757]/10 hover:bg-[#d97757]/20"
                            }`}
                            >
                            {importing.has(acc.id) ? "Salvando..." : "Importar"}
                            </button>
                        )}
                      </div>

                      {/* Área Expandida (Extrato) */}
                      {expandedCard && (
                        <div className="mt-3 pt-3 border-t border-gray-800/50 animate-fade-in">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                            <Sparkles size={10} /> Movimentações Recentes
                          </p>
                          {acc.previewTransactions && acc.previewTransactions.length > 0 ? (
                            <div className="space-y-1.5">
                              {acc.previewTransactions.map((tx) => {
                                const isExpense = tx.amount < 0;
                                return (
                                  <div key={tx.id} className="flex justify-between items-center text-xs p-1.5 rounded bg-gray-900/80">
                                    <span className="text-gray-300 truncate w-2/3">{tx.description}</span>
                                    <span className={`font-medium ${isExpense ? "text-red-400" : "text-emerald-400"}`}>
                                      {formatCurrency(tx.amount, tx.currency || acc.currency)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-600 italic">Nenhuma movimentação recente disponível.</p>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  );
};