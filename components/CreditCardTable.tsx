import React, { useState, useMemo } from 'react';
import { Transaction, ConnectedAccount } from '../types';
import {
  Trash2, Search, Calendar, getCategoryIcon, X, Edit2, Check,
  ArrowUpCircle, ArrowDownCircle, AlertCircle, Code, RefreshCw, Loader2,
  Download, FileSpreadsheet, Plus, FileText, DollarSign, Tag, CreditCard
} from './Icons';
import { ConfirmationCard, CustomAutocomplete, CustomDatePicker, CustomSelect } from './UIComponents';
import { createPortal } from 'react-dom';
import { useToasts } from './Toast';
import { EmptyState } from './EmptyState';

// ============================================================ 
// COMPONENTE PRINCIPAL
// ============================================================ 

interface CreditCardTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (transaction: Transaction) => void;
  creditCardAccounts?: ConnectedAccount[];
  userId?: string;
  onSync?: () => Promise<void>;
  isSyncing?: boolean;
  isManualMode?: boolean;
  onAdd?: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  billTotalsByMonthKey?: Record<string, number>;
}

export const CreditCardTable: React.FC<CreditCardTableProps> = ({
  transactions,
  onDelete,
  onUpdate,
  creditCardAccounts = [],
  userId,
  onSync,
  isSyncing = false,
  isManualMode,
  onAdd,
  billTotalsByMonthKey = {}
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState<keyof Transaction>('date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [isEditAnimating, setIsEditAnimating] = useState(false);

  const [jsonViewTransaction, setJsonViewTransaction] = useState<any | null>(null);

  // Cards Details Modal State
  const [isCardsModalOpen, setIsCardsModalOpen] = useState(false);

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddVisible, setIsAddVisible] = useState(false);
  const [isAddAnimating, setIsAddAnimating] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: '',
    type: 'expense',
    status: 'pending',
    accountType: 'CREDIT_CARD',
    totalInstallments: 1,
    installmentNumber: 1
  });

  const toast = useToasts();

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isAddModalOpen) {
      setIsAddVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAddAnimating(true);
        });
      });
    } else {
      setIsAddAnimating(false);
      timeoutId = setTimeout(() => {
        setIsAddVisible(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isAddModalOpen]);

  const enrichWithDueDate = (obj: any) => {
    if (!obj) return obj;
    const computedDue =
      obj.invoiceDueDate ||
      obj.dueDate ||
      obj.nextBillDueDate ||
      obj.currentBillDueDate ||
      obj.invoiceDate ||
      obj.date ||
      null;
    return { ...obj, computedDueDate: computedDue };
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleSort = (field: keyof Transaction) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const isCreditCardPayment = (tx: Transaction) => {
    const d = (tx.description || '').toLowerCase();
    const c = (tx.category || '').toLowerCase();

    // categoria do Pluggy + descrições comuns
    return (
      c.includes('credit card payment') ||
      c === 'pagamento de fatura' ||
      d.includes('pagamento de fatura') ||
      d.includes('pagamento fatura') ||
      d.includes('credit card payment') ||
      d === 'pgto'
    );
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch =
          !searchTerm ||
          (t.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.category || "").toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
      })
      .sort((a, b) => {
        const aValue: any = (a as any)[sortField];
        const bValue: any = (b as any)[sortField];
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [transactions, searchTerm, sortField, sortDirection]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      if (isCreditCardPayment(tx)) return acc;
      const amt = Math.abs(Number((tx as any).amount) || 0);
      if (tx.type === 'income') return acc - amt;
      return acc + amt;
    }, 0);
  }, [filteredTransactions]);

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isEditModalOpen) {
      setIsEditVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsEditAnimating(true);
        });
      });
    } else {
      setIsEditAnimating(false);
      timeoutId = setTimeout(() => {
        setIsEditVisible(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isEditModalOpen]);

  const handleEditClick = (transaction: Transaction) => {
    setEditTransaction({ ...transaction });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editTransaction) return;

    if (!editTransaction.description || editTransaction.amount <= 0) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    onUpdate(editTransaction);
    toast.success("Lançamento atualizado com sucesso!");
    setIsEditModalOpen(false);
    setTimeout(() => setEditTransaction(null), 300);
  };

  const handleCloseEdit = () => {
    setIsEditModalOpen(false);
    setTimeout(() => setEditTransaction(null), 300);
  };

  const CATEGORIES = ['Trabalho', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Moradia', 'Outros'];

  return (
    <div className="bg-[#30302E] rounded-3xl shadow-2xl border border-[#373734] overflow-hidden flex flex-col h-full animate-fade-in">
      {/* Toolbar */}
      <div className="p-4 lg:p-6 border-b border-[#373734] flex flex-col gap-4 bg-[#30302E]/95 backdrop-blur-xl relative z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d97757]/10 rounded-xl border border-[#d97757]/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M12 19h-6a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v4.5" />
                <path d="M3 10h18" />
                <path d="M16 19h6" />
                <path d="M19 16l3 3l-3 3" />
                <path d="M7.005 15h.005" />
                <path d="M11 15h2" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Fatura do Cartão</h3>
              <div className="flex flex-col">
                <p className="text-xs text-gray-400">{filteredTransactions.length} lançamentos</p>
                {creditCardAccounts.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {creditCardAccounts.map(acc => acc.name).join(' | ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isManualMode && onAdd && (
              <button
                onClick={() => {
                  setNewTransaction({
                    description: '',
                    amount: 0,
                    date: new Date().toISOString().split('T')[0],
                    category: '',
                    type: 'expense',
                    status: 'pending',
                    accountType: 'CREDIT_CARD',
                    accountId: creditCardAccounts[0]?.id || undefined, // Default to first card
                    totalInstallments: 1,
                    installmentNumber: 1
                  });
                  setIsAddModalOpen(true);
                }}
                className="hidden sm:flex items-center gap-2 px-4 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 border border-[#d97757]/50"
              >
                <Plus size={18} strokeWidth={3} />
                <span>Novo Lançamento</span>
              </button>
            )}

            <div className="relative w-full sm:w-64 group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
              <input
                type="text"
                placeholder="Buscar na fatura..."
                className="w-full pl-11 pr-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-sm text-white transition-all placeholder-gray-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {onSync && creditCardAccounts.length > 0 && (
              <button
                onClick={onSync}
                disabled={isSyncing}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${isSyncing
                  ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                  : 'bg-[#d97757]/10 text-[#d97757] border-[#d97757]/20 hover:bg-[#d97757]/20 hover:border-[#d97757]/40'
                  }`}
                title="Sincronizar transações do cartão"
              >
                {isSyncing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
            )}

            {/* Botões de Exportação */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsCardsModalOpen(true)}
                className="p-2.5 bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700 hover:border-gray-600 transition-all"
                title="Ver Dados dos Cartões"
              >
                <CreditCard size={16} />
              </button>
              <button
                onClick={() => {
                  // Exportar JSON de TODAS as transações
                  const exportData = {
                    exportDate: new Date().toISOString(),
                    totalTransactions: transactions.length,
                    transactions: transactions.map(t => {
                      const tx = t as any;
                      return {
                        id: tx.id,
                        providerId: tx.providerId,
                        providerItemId: tx.providerItemId,
                        accountId: tx.accountId,
                        accountType: tx.accountType,

                        date: tx.date,
                        description: tx.description,
                        amount: tx.amount,
                        category: tx.category,
                        type: tx.type,
                        status: tx.status,

                        invoiceDate: tx.invoiceDate,
                        invoiceDueDate: tx.invoiceDueDate,
                        invoiceMonthKey: tx.invoiceMonthKey,
                        invoiceSource: tx.invoiceSource,
                        computedDueDate: tx.invoiceDueDate || tx.date, // Fallback logic

                        importSource: tx.importSource,
                        pluggyBillId: tx.pluggyBillId,
                        pluggyRaw: tx.pluggyRaw,

                        isProjected: tx.isProjected
                      };
                    })
                  };
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `fatura-cartao-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('JSON exportado com sucesso!');
                }}
                className="p-2.5 bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700 hover:border-gray-600 transition-all"
                title="Exportar JSON (todas as transações)"
              >
                <Code size={16} />
              </button>
              <button
                onClick={() => {
                  // Exportar CSV/Excel de TODAS as transações
                  const headers = [
                    'id', 'providerId', 'providerItemId', 'accountId', 'accountType',
                    'date', 'description', 'amount', 'category', 'type', 'status',
                    'invoiceDate', 'invoiceDueDate', 'invoiceMonthKey', 'invoiceSource', 'computedDueDate',
                    'importSource', 'pluggyBillId', 'pluggyRaw', 'isProjected'
                  ];

                  const rows = transactions.map(t => {
                    const tx = t as any;
                    return [
                      tx.id || '',
                      tx.providerId || '',
                      tx.providerItemId || '',
                      tx.accountId || '',
                      tx.accountType || '',

                      tx.date || '',
                      `"${(tx.description || '').replace(new RegExp('"', 'g'), '""')}"`,
                      (tx.amount || 0).toString().replace('.', ','),
                      tx.category || '',
                      tx.type || '',
                      tx.status || '',

                      tx.invoiceDate || '',
                      tx.invoiceDueDate || '',
                      tx.invoiceMonthKey || '',
                      tx.invoiceSource || '',
                      (tx.invoiceDueDate || tx.date) || '',

                      tx.importSource || '',
                      tx.pluggyBillId || '',
                      tx.pluggyRaw ? `"${JSON.stringify(tx.pluggyRaw).replace(new RegExp('"', 'g'), '""')}"` : '',
                      tx.isProjected ? 'TRUE' : 'FALSE'
                    ];
                  });

                  // BOM para Excel reconhecer UTF-8
                  const BOM = '\uFEFF';
                  const csvContent = BOM + headers.join(';') + '\n' + rows.map(r => r.join(';')).join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `fatura-cartao-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Excel/CSV exportado com sucesso!');
                }}
                className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all"
                title="Exportar Excel/CSV (todas as transações)"
              >
                <FileSpreadsheet size={16} />
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-auto flex-1 custom-scrollbar z-0 bg-[#30302E]">
        <table className="hidden lg:table min-w-full border-collapse text-sm text-left h-full">
          <thead className="bg-[#373734] sticky top-0 z-10 text-xs font-bold text-gray-400 uppercase tracking-wider shadow-sm">
            <tr>
              <th className="px-6 py-4 border-b border-[#373734] cursor-pointer hover:text-white transition-colors w-40" onClick={() => handleSort('date')}>
                <div className="flex items-center gap-2">Data {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
              </th>
              <th className="px-6 py-4 border-b border-[#373734] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('description')}>
                Descrição {sortField === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-4 border-b border-[#373734] cursor-pointer hover:text-white transition-colors w-48" onClick={() => handleSort('category')}>
                Categoria {sortField === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-4 border-b border-[#373734] cursor-pointer hover:text-white transition-colors w-40 text-right" onClick={() => handleSort('amount')}>
                Valor {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-4 border-b border-[#373734] w-24 text-center">Fatura</th>
              <th className="px-6 py-4 border-b border-[#373734] w-32 text-center">Status</th>
              <th className="px-6 py-4 border-b border-[#373734] w-28 text-center">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#373734]/50">
            {filteredTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-[#373734]/30 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-xs">
                  {formatDate(t.date)}
                </td>
                <td className="px-6 py-4 text-gray-200 font-medium">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span>{t.description}</span>
                      {(t as any).isEstimated && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          title="Valor estimado baseado na parcela anterior. Aguardando confirmação da fatura real."
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" />
                            <path d="M12 8h.01" />
                          </svg>
                          Estimado
                        </span>
                      )}
                    </div>
                    {(t as any).totalInstallments > 1 && (
                      <span className="text-[10px] text-gray-500 font-mono">
                        Parcela {(t as any).installmentNumber || 1}/{(t as any).totalInstallments}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-900 rounded-lg text-gray-500 border border-gray-800">
                      {getCategoryIcon(t.category || "Outros", 14)}
                    </div>
                    <span className="text-xs">{t.category || "Outros"}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`font-bold font-mono ${t.type === 'income' ? 'text-emerald-400' : 'text-gray-200'}`}>
                    {t.type === 'income' ? '+' : '-'} {formatCurrency(Math.abs(t.amount))}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="px-2 py-1 rounded bg-gray-800 text-gray-400 text-[10px] font-mono border border-gray-700">
                    {(t as any).invoiceMonthKey || (t as any).invoiceDueDate?.slice(0, 7) || t.date?.slice(0, 7) || '?'} 
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide border ${t.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${t.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    {t.status === 'completed' ? 'Pago' : 'Pendente'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setJsonViewTransaction(enrichWithDueDate(t as any))}
                      className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                      title="Ver JSON (Debug)"
                    >
                      <Code size={16} />
                    </button>
                    <button
                      onClick={() => handleEditClick(t)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteId(t.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredTransactions.length === 0 && (
              <tr className="h-full">
                <td colSpan={6} className="p-4 h-full">
                  <EmptyState
                    title="Nenhum lançamento de cartão encontrado"
                    description="Seus gastos com cartão aparecerão aqui."
                    className="!border-0 !bg-transparent !shadow-none"
                    minHeight="h-full"
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile */}
        <div className="lg:hidden p-4 space-y-4 h-full flex flex-col">
          {filteredTransactions.map((t) => (
            <div key={t.id} className="bg-[#30302E] border border-[#373734] rounded-2xl p-4 relative overflow-hidden shadow-lg group">
              <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${t.type === 'income' ? 'bg-emerald-500' : 'bg-[#d97757]'}`}></div>
              <div className="flex justify-between items-start mb-3 pl-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-gray-100 text-base truncate">{t.description}</h4>
                    {(t as any).isEstimated && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] uppercase font-bold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20 flex-shrink-0"
                        title="Valor estimado aguardando fatura real"
                      >
                        Estimado
                      </span>
                    )}
                    {(t as any).totalInstallments > 1 && (
                      <span className="text-[9px] text-gray-500 font-mono bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 flex-shrink-0">
                        {(t as any).installmentNumber || 1}/{(t as any).totalInstallments}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5 bg-gray-900 px-2 py-1 rounded-md border border-gray-800">
                      {getCategoryIcon(t.category || "Outros", 12)}
                      {t.category || "Outros"}
                    </span>
                    <span className="font-mono flex items-center gap-1.5">
                      <Calendar size={12} /> {formatDate(t.date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleEditClick(t)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-500 hover:text-white border border-gray-800 hover:border-gray-700 transition-all"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteId(t.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-gray-800 hover:border-red-500/30 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center pl-3 pt-3 border-t border-gray-800/50">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-800 text-gray-400'}`}>
                    {t.type === 'income' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                  </div>
                  <span className={`text-xl font-bold font-mono ${t.type === 'income' ? 'text-emerald-400' : 'text-white'}`}>
                    {formatCurrency(Math.abs(t.amount))}
                  </span>
                </div>

                <span className={`text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full font-bold border ${t.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}>
                  {t.status === 'completed' ? 'Pago' : 'Pendente'}
                </span>
              </div>
            </div>
          ))}

          {filteredTransactions.length === 0 && (
            <EmptyState
              title="Nenhum lançamento de cartão encontrado"
              description="Seus gastos com cartão aparecerão aqui."
              className="!border-0 !bg-transparent !shadow-none flex-1"
              minHeight="h-full"
            />
          )}
        </div>
      </div>

      {/* Footer Summary */}
      <div className="bg-[#373734] border-t border-[#373734] px-6 py-3 text-xs text-gray-400 flex flex-col sm:flex-row justify-between gap-3 font-medium uppercase tracking-wide">
        <div className="flex items-center gap-4">
          <span>Lançamentos: <span className="text-white">{filteredTransactions.length}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span>Total:</span>
          <span className="font-mono font-bold text-sm text-[#d97757]">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      <ConfirmationCard
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && onDelete(deleteId)}
        title="Remover Transação"
        description="Você tem certeza que deseja excluir este lançamento?"
        isDestructive={true}
        confirmText="Excluir"
        cancelText="Cancelar"
      />

      {/* Modal de Detalhes dos Cartões */}
      {isCardsModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-950 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-800 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <CreditCard size={20} className="text-[#d97757]" />
                Dados dos Cartões Conectados
              </h3>
              <button onClick={() => setIsCardsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-auto custom-scrollbar bg-[#1e1e1e] space-y-4">
              {creditCardAccounts.length === 0 ? (
                <EmptyState
                  title="Nenhum cartão conectado"
                  description="Conecte suas contas para ver os detalhes aqui."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {creditCardAccounts.map(acc => (
                    <div key={acc.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{acc.institution || 'Banco'}</p>
                          <h4 className="text-lg font-bold text-white flex items-center gap-2">
                            {acc.name}
                            {acc.brand && <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded border border-gray-700 text-gray-400 uppercase">{acc.brand}</span>}
                          </h4>
                        </div>
                        <div className="text-right">
                           <p className="text-xs text-gray-500 font-medium">Limite Total</p>
                           <p className="text-white font-mono font-bold">{acc.creditLimit ? formatCurrency(acc.creditLimit) : '---'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-800">
                         <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Limite Disponível</p>
                            <p className="text-emerald-400 font-mono font-bold text-sm">
                              {acc.availableCreditLimit ? formatCurrency(acc.availableCreditLimit) : '---'}
                            </p>
                         </div>
                         <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Fechamento</p>
                            <p className="text-white font-medium text-sm flex items-center gap-1">
                               <Calendar size={12} className="text-gray-600" />
                               Dia {acc.closingDay || acc.balanceCloseDate?.split('T')[0].split('-')[2] || '--'}
                            </p>
                         </div>
                         <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Vencimento</p>
                            <p className="text-white font-medium text-sm flex items-center gap-1">
                               <Calendar size={12} className="text-gray-600" />
                               Dia {acc.dueDay || acc.balanceDueDate?.split('T')[0].split('-')[2] || '--'}
                            </p>
                         </div>
                         <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Última Sinc.</p>
                            <p className="text-gray-400 text-xs">
                               {acc.lastUpdated ? new Date(acc.lastUpdated).toLocaleDateString() : 'Nunca'}
                            </p>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-800 bg-gray-900/30 flex justify-end">
                <button 
                  onClick={() => setIsCardsModalOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold text-xs transition-colors"
                >
                  Fechar
                </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {jsonViewTransaction && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-950 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-800 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Code size={20} className="text-[#d97757]" />
                Dados Brutos (Debug)
              </h3>
              <button onClick={() => setJsonViewTransaction(null)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-0 overflow-auto custom-scrollbar bg-[#1e1e1e]">
              <pre className="p-6 text-xs font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(jsonViewTransaction, null, 2)}
              </pre>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isEditVisible && editTransaction && createPortal(
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${isEditAnimating ? 'bg-black/80 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}>
          <div className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-visible border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isEditAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}>
            <div className="p-6 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm rounded-t-3xl relative z-10 flex justify-between items-center">
              <h3 className="font-bold text-white text-xl flex items-center gap-3">
                <div className="p-2 bg-[#d97757]/10 rounded-xl text-[#d97757]">
                  <Edit2 size={20} />
                </div>
                Editar Lançamento
              </h3>
              <button onClick={handleCloseEdit} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Descrição</label>
                <input
                  type="text"
                  value={editTransaction.description}
                  onChange={(e) => setEditTransaction({ ...editTransaction, description: e.target.value })}
                  className="w-full p-4 bg-gray-900/50 border border-gray-800 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-white font-medium transition-all placeholder-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Valor</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold group-focus-within:text-[#d97757] transition-colors">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editTransaction.amount.toString().replace('.', ',')}
                      onChange={(e) => {
                        const val = e.target.value.replace(',', '.');
                        const parsed = parseFloat(val);
                        setEditTransaction({ ...editTransaction, amount: isNaN(parsed) ? 0 : parsed });
                      }}
                      className="w-full p-4 pl-12 bg-gray-900/50 border border-gray-800 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-white text-lg font-bold font-mono transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Data</label>
                  <input
                    type="date"
                    value={editTransaction.date}
                    onChange={(e) => setEditTransaction({ ...editTransaction, date: e.target.value })}
                    className="w-full p-4 bg-gray-900/50 border border-gray-800 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-white font-medium transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Categoria</label>
                <div className="relative">
                  <select
                    value={editTransaction.category}
                    onChange={(e) => setEditTransaction({ ...editTransaction, category: e.target.value })}
                    className="w-full p-4 bg-gray-900/50 border border-gray-800 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-white font-medium transition-all appearance-none cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500">
                    <ArrowDownCircle size={16} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Tipo de Movimentação</label>
                <div className="grid grid-cols-2 gap-3 bg-gray-900 p-1.5 rounded-2xl border border-gray-800">
                  <button
                    type="button"
                    onClick={() => setEditTransaction({ ...editTransaction, type: 'expense' })}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${editTransaction.type === 'expense' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                  >
                    <ArrowDownCircle size={16} /> Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTransaction({ ...editTransaction, type: 'income' })}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${editTransaction.type === 'income' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                  >
                    <ArrowUpCircle size={16} /> Receita
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Status do Pagamento</label>
                <div className="grid grid-cols-2 gap-3 bg-gray-900 p-1.5 rounded-2xl border border-gray-800">
                  <button
                    type="button"
                    onClick={() => setEditTransaction({ ...editTransaction, status: 'pending' })}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${editTransaction.status === 'pending' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                  >
                    <AlertCircle size={16} /> Pendente
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTransaction({ ...editTransaction, status: 'completed' })}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${editTransaction.status === 'completed' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                  >
                    <Check size={16} /> Pago / Recebido
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-950/50 flex gap-3 relative z-10">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="flex-1 py-4 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl font-bold transition-all border border-gray-800 hover:border-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-[2] py-4 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 border border-[#d97757]/50 flex items-center justify-center gap-2"
              >
                <Check size={20} strokeWidth={3} />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Transaction Modal - Reminders Style */}
      {isAddVisible && createPortal(
        <div className={`
            fixed inset-0 z-[100] flex items-center justify-center p-4
            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
            ${isAddAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
        `}> 
          <div className={`
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800
                flex flex-col max-h-[90vh] relative
                transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAddAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}> 
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757] rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20" />

            {/* Header */}
            <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Plus size={18} className="text-[#d97757]" />
                Novo Lançamento (Cartão)
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 relative z-10">

              {/* Account Selector (if multiple cards) */}
              {creditCardAccounts.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide ml-1">Cartão</label>
                  <CustomSelect
                    value={newTransaction.accountId}
                    onChange={(val) => {
                      const acc = creditCardAccounts.find(a => a.id === val);
                      setNewTransaction({
                        ...newTransaction,
                        accountId: val as string,
                        cardId: val as string,
                        cardName: acc?.name
                      });
                    }}
                    options={creditCardAccounts.map(acc => ({
                      value: acc.id,
                      label: `${acc.name} (${acc.institution || 'Banco'})`
                    }))}
                    placeholder="Selecione o cartão"
                    className="w-full"
                  />
                </div>
              )}

              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Descrição</label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                  <input
                    type="text"
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                    className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                    placeholder="Ex: Compra Online"
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Valor */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Valor (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    <input
                      type="number"
                      step="0.01"
                      value={newTransaction.amount?.toString()}
                      onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                {/* Data */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Data da Compra</label>
                  <CustomDatePicker
                    value={newTransaction.date || ''}
                    onChange={(val) => setNewTransaction({ ...newTransaction, date: val })}
                  />
                </div>
              </div>

              {/* Categoria */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Categoria</label>
                <CustomAutocomplete
                  value={newTransaction.category || ''}
                  onChange={(val) => setNewTransaction({ ...newTransaction, category: val })}
                  options={CATEGORIES}
                  icon={<Tag size={16} />}
                  placeholder="Selecione ou digite..."
                />
              </div>

              {/* Parcelas */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Parcelas (Opcional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={newTransaction.totalInstallments || 1}
                      onChange={(e) => setNewTransaction({ ...newTransaction, totalInstallments: parseInt(e.target.value) || 1 })}
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white py-3 px-4 text-center text-sm font-medium focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-500 font-bold">x</div>
                  </div>

                  <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl flex flex-col justify-center px-4 py-1.5">
                    <span className="block text-[10px] text-gray-500 uppercase tracking-wide">Valor da Parcela</span>
                    <span className="block font-mono font-bold text-gray-200 text-sm">
                      R$ {((newTransaction.amount || 0) / (newTransaction.totalInstallments || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!newTransaction.description || !newTransaction.amount || newTransaction.amount <= 0 || !newTransaction.date) {
                    toast.error("Preencha a descrição, valor e data.");
                    return;
                  }
                  if (onAdd) {
                    // Enrich with card details if found
                    const acc = creditCardAccounts.find(a => a.id === newTransaction.accountId);
                    const finalTx = {
                      ...newTransaction,
                      cardId: newTransaction.accountId,
                      cardName: acc?.name || 'Cartão Manual',
                      accountType: 'CREDIT_CARD',
                      // Ensure installment logic is sound (default 1/1)
                      installmentNumber: 1,
                      totalInstallments: newTransaction.totalInstallments || 1
                    };

                    await onAdd(finalTx as any);
                    toast.success("Lançamento de cartão adicionado!");
                    setIsAddModalOpen(false);
                  }
                }}
                className="w-full py-3.5 bg-[#d97757] hover:bg-[#e08868] text-white rounded-xl font-bold shadow-lg shadow-[#d97757]/20 transition-all flex items-center justify-center gap-2 mt-4"
              >
                <Check size={18} strokeWidth={2.5} />
                Adicionar Despesa
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
