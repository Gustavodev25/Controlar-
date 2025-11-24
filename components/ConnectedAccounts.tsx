import React, { useEffect, useMemo, useState } from "react";
import { ConnectedAccount } from "../types";
import { Wallet, Building, CreditCard, RotateCcw, Sparkles } from "./Icons";

interface ConnectedAccountsProps {
  accounts: ConnectedAccount[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onImport?: (account: ConnectedAccount) => Promise<number>;
  lastSynced?: Record<string, string>;
  storageKey?: string; // persist expanded state
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
  storageKey
}) => {
  if (!isLoading && accounts.length === 0) return null;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState<Set<string>>(new Set());

  const accountIds = useMemo(() => accounts.map((a) => a.id).join(","), [accounts]);
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
    setExpanded(ids); // default expand all on load
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

  const findParentAccountName = (acc: ConnectedAccount) => {
    // Usa itemId ou instituicao para achar conta "pai" (nao credito)
    const sameItem = accounts.find(a => a.itemId === acc.itemId && a.id !== acc.id && !isCardFromInstitution(a));
    if (sameItem) return sameItem.name || sameItem.institution;
    const inst = (acc.institution || "").toLowerCase();
    const sameInst = accounts.find(a => a.id !== acc.id && !isCardFromInstitution(a) && (a.institution || "").toLowerCase() === inst);
    return sameInst ? (sameInst.name || sameInst.institution) : undefined;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-lg space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[#d97757]/15 text-[#d97757]">
            <Building size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Open Finance</p>
            <h3 className="text-lg font-bold text-white leading-tight">Contas Conectadas</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-colors flex items-center gap-2"
            >
              <RotateCcw size={14} /> Atualizar
            </button>
          )}
          <span className="text-[11px] px-2 py-1 rounded-full bg-gray-800 text-gray-400 font-semibold border border-gray-800/50">
            {accounts.length} conta{accounts.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-2/3"></div>
              <div className="h-6 bg-gray-800 rounded w-1/2"></div>
              <div className="h-3 bg-gray-800 rounded w-3/4"></div>
              <div className="h-12 bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acc) => {
            const expandedCard = expanded.has(acc.id);
            return (
              <div key={acc.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                      {acc.institution || "Banco conectado"}
                    </p>
                    <h4 className="text-base font-bold text-white mt-1 flex items-center gap-2">
                      <CreditCard size={16} className="text-[#d97757]" /> {acc.name}
                    </h4>
                    <p className="text-[12px] text-gray-500">
                      {acc.type || "Conta"} {acc.subtype ? `· ${acc.subtype}` : ""}
                    </p>
                    {isCardFromInstitution(acc) && (
                      <p className="text-[11px] text-amber-400 mt-1">
                        Cartao do banco {findParentAccountName(acc) || acc.institution || acc.name}.
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-500">Saldo atual</p>
                    <p className="text-xl font-bold text-green-400">{formatCurrency(acc.balance, acc.currency)}</p>
                    {lastSynced[acc.id] && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        Sincronizado {new Date(lastSynced[acc.id]).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[12px] text-gray-500">
                  <div className="flex items-center gap-1">
                    <Wallet size={14} className="text-gray-400" /> {acc.currency || "BRL"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles size={14} className="text-gray-400" />{" "}
                    {acc.lastUpdated ? new Date(acc.lastUpdated).toLocaleDateString("pt-BR") : "Sem atualizacao"}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggle(acc.id)}
                    className="text-xs font-semibold text-gray-300 hover:text-white transition-colors"
                  >
                    {expandedCard ? "Recolher" : "Expandir"}
                  </button>
                  {onImport && (
                    <button
                      onClick={() => handleImport(acc)}
                      disabled={importing.has(acc.id)}
                      className={`text-xs font-semibold rounded-lg px-3 py-2 border transition-colors ${importing.has(acc.id)
                          ? "border-gray-800 text-gray-500 cursor-wait"
                          : "border-gray-800 text-[#d97757] hover:border-[#d97757] hover:text-white"
                        }`}
                    >
                      {importing.has(acc.id) ? "Salvando..." : "Salvar nos lancamentos"}
                    </button>
                  )}
                </div>

                {expandedCard && (
                  <div className="bg-gray-900/70 rounded-lg p-3 border border-gray-800">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Movimentacoes recentes</p>
                    {acc.previewTransactions && acc.previewTransactions.length > 0 ? (
                      <div className="space-y-2">
                        {acc.previewTransactions.map((tx) => {
                          const isExpense = tx.amount < 0;
                          const hasInstallments = !!(tx.installments && (tx.installments.number || tx.installments.total));
                          return (
                            <div key={tx.id} className="border border-gray-800 rounded-lg p-2 bg-gray-900/60">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm text-white truncate">{tx.description}</div>
                                <div className={`text-sm font-semibold ${isExpense ? "text-red-400" : "text-green-400"}`}>
                                  {formatCurrency(tx.amount, tx.currency || acc.currency)}
                                </div>
                              </div>
                              <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-1">
                                <span>{new Date(tx.date).toLocaleDateString("pt-BR")}</span>
                                {tx.category && <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{tx.category}</span>}
                                {hasInstallments && (
                                  <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                                    Parcela {tx.installments?.number || "?"}/{tx.installments?.total || "?"}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Sem movimentacao recente.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
