import React, { useMemo, useState } from "react";
import { ConnectedAccount } from "../types";
import { Wallet, Building, CreditCard, RotateCcw, RefreshCw, Download, ChevronLeft, ChevronRight, Trash2, PieChart, FileText } from "./Icons";
import { triggerItemUpdate, syncPluggyData, deleteItem } from "../services/pluggyService";
import { useToasts } from "./Toast";
import { EmptyState } from "./EmptyState";
import { ConfirmationCard } from "./UIComponents";

interface ConnectedAccountsProps {
  accounts: ConnectedAccount[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onImport?: (account: ConnectedAccount) => Promise<number>;
  lastSynced?: Record<string, string>;
  storageKey?: string; // legacy prop, can be ignored or removed
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

export const ConnectedAccounts: React.FC<ConnectedAccountsProps> = ({
  accounts,
  isLoading = false,
  onRefresh,
  onImport,
  lastSynced = {},
  userId,
  memberId
}) => {
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [syncingItems, setSyncingItems] = useState<Set<string>>(new Set());
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [limitView, setLimitView] = useState<Set<string>>(new Set());
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [accountPages, setAccountPages] = useState<Record<string, number>>({});
  const accountsPerPage = 3;
  const toast = useToasts();

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

  const toggleLimitView = (id: string) => {
      setLimitView(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const handleDeleteBank = (institutionName: string, itemId: string) => {
    setItemToDelete({ id: itemId, name: institutionName });
  };

  const confirmDeleteBank = async () => {
    if (!itemToDelete) return;
    const { id: itemId, name: institutionName } = itemToDelete;
    
    if (deletingItems.has(itemId)) return;

    setDeletingItems(prev => new Set(prev).add(itemId));
    setItemToDelete(null);

    try {
      await toast.promise(
        deleteItem(itemId),
        {
          loading: `Desconectando ${institutionName}...`,
          success: "Banco desconectado com sucesso!",
          error: "Erro ao desconectar banco."
        }
      );
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
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

       await new Promise(resolve => setTimeout(resolve, 3000));

       const count = await syncPluggyData(userId, itemId, memberId);
       
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

  const handleDevForceSave = async () => {
    if (!userId) return;
    // Get unique ItemIDs
    const itemIds = Array.from(new Set(accounts.map(a => a.itemId).filter(Boolean)));
    
    if (itemIds.length === 0) {
        toast.error("Nenhuma conta conectada para sincronizar.");
        return;
    }

    toast.message({ text: "Dev: Forçando salvamento (sem atualização bancária)..." });
    
    let totalProcessed = 0;
    
    for (const itemId of itemIds) {
        try {
            // Calls syncPluggyData directly (skips triggerItemUpdate)
            const count = await syncPluggyData(userId, itemId!, memberId);
            totalProcessed += count;
            if (count > 0) {
                toast.success(`Item ${itemId?.slice(0,4)}: ${count} novos salvos.`);
            }
        } catch (e) {
            console.error("Dev Sync Error:", e);
            toast.error(`Erro ao salvar item ${itemId?.slice(0,4)}`);
        }
    }
    
    if (totalProcessed === 0) {
        toast.success("Sincronização concluída. Nenhum dado novo encontrado no cache local.");
    } else {
        toast.success(`Processo finalizado. Total: ${totalProcessed} salvos.`);
    }
    
    if (onRefresh) onRefresh();
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
            <div className="flex items-center gap-2">
                <button
                  onClick={handleDevForceSave}
                  className="bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-500/30 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg"
                  title="Forçar salvar dados já baixados (Dev)"
                >
                  <FileText size={18} />
                  <span className="hidden sm:inline font-bold text-sm">Dev: Enviar Novamente</span>
                </button>

                <button
                  onClick={onRefresh}
                  className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all border border-gray-800 hover:border-gray-700 shadow-lg"
                >
                  <RotateCcw size={18} className={isLoading ? "animate-spin" : ""} />
                  <span className="hidden sm:inline font-bold text-sm">Atualizar</span>
                </button>
            </div>
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
                
                {/* Ações da Instituição */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => handleSyncItem(institution, itemId)}
                        disabled={isSyncing || deletingItems.has(itemId)}
                        title="Sincronizar agora com o banco"
                        className={`p-2.5 rounded-xl transition-all border ${isSyncing ? 'bg-gray-900 text-gray-500 border-gray-800 cursor-not-allowed' : 'bg-gray-900 hover:bg-[#d97757]/10 text-gray-400 hover:text-[#d97757] border-gray-800 hover:border-[#d97757]/30'}`}
                    >
                        <RefreshCw size={18} className={isSyncing ? "animate-spin text-[#d97757]" : ""} />
                    </button>

                    <button 
                        onClick={() => handleDeleteBank(institution, itemId)}
                        disabled={isSyncing || deletingItems.has(itemId)}
                        title="Excluir conexão bancária"
                        className={`p-2.5 rounded-xl transition-all border ${deletingItems.has(itemId) ? 'bg-gray-900 text-gray-500 border-gray-800 cursor-not-allowed' : 'bg-gray-900 hover:bg-red-500/10 text-gray-400 hover:text-red-500 border-gray-800 hover:border-red-500/30'}`}
                    >
                        {deletingItems.has(itemId) ? (
                           <RefreshCw size={18} className="animate-spin text-red-500" />
                        ) : (
                           <Trash2 size={18} />
                        )}
                    </button>
                </div>
              </div>

              {/* Lista de Contas dentro do Banco */}
              <div className="p-4 space-y-3 bg-gray-950 relative z-10 flex-1">
                {paginatedInstitutionAccounts.map((acc) => {
                  const isCredit = isCardFromInstitution(acc);
                  const showLimit = limitView.has(acc.id);

                  // Calculate Credit details
                  const limit = acc.creditLimit || 0;
                  const available = acc.availableCreditLimit || 0;
                  const used = limit - available; 
                  const limitPercentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

                  return (
                    <div key={acc.id} className="bg-gray-900/30 border border-gray-800/60 rounded-xl hover:border-gray-700 transition-colors">
                      {/* Resumo da Conta */}
                      <div className="p-4">
                          <div className="flex justify-between items-center gap-3 mb-3">
                            <div className="flex gap-3 items-center flex-1 min-w-0">
                                <div className={`p-1.5 rounded-lg flex-shrink-0 ${isCredit ? "bg-amber-500/10 text-amber-500" : "bg-[#d97757]/10 text-[#d97757]"}`}>
                                    {isCredit ? <CreditCard size={18} /> : <Wallet size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-200 truncate">{acc.name}</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium truncate">
                                        {acc.type} {acc.subtype ? `· ${acc.subtype}` : ""}
                                    </p>
                                </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                                <p className={`text-base font-mono font-bold whitespace-nowrap ${acc.balance < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                    {formatCurrency(acc.balance, acc.currency)}
                                </p>
                            </div>
                          </div>

                          {/* Ações da Conta - REMOVED per user request */}


                          {/* Bottom Details */}
                          {isCredit && (
                                <div 
                                  onClick={() => toggleLimitView(acc.id)}
                                  className="mt-3 pt-3 border-t border-gray-800/50 cursor-pointer group/limit select-none w-full"
                                  title="Clique para alternar entre Fatura e Limite"
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
                                                        Fecha {new Date(acc.balanceCloseDate).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                                                    </span>
                                                )}
                                                {acc.balanceDueDate ? (
                                                    <div className="flex items-center gap-1.5 bg-gray-800/40 group-hover/limit:bg-gray-800 px-2 py-1 rounded-lg border border-gray-800/50 transition-colors">
                                                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wide">
                                                            Vence {new Date(acc.balanceDueDate).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
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

                          {/* Last Sync Info - Visible for ALL accounts */}
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

      <ConfirmationCard
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDeleteBank}
        title="Desconectar Banco?"
        description={`Tem certeza que deseja desconectar o ${itemToDelete?.name}? Todas as contas vinculadas serão removidas.`}
        isDestructive={true}
        confirmText="Sim, desconectar"
        cancelText="Cancelar"
      />
    </div>
  );
};