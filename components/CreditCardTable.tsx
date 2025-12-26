import React, { useState, useMemo } from 'react';
import { Transaction, ConnectedAccount } from '../types';
import {
  Trash2, Search, Calendar, getCategoryIcon, X, Edit2, Check,
  ArrowUpCircle, ArrowDownCircle, AlertCircle, Plus, FileText, DollarSign, Tag, Filter, CreditCard, Copy, TrendingDown, TrendingUp
} from './Icons';
import { CustomAutocomplete, CustomDatePicker, CustomSelect } from './UIComponents';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './Dropdown';
import { ConfirmationBar } from './ConfirmationBar';
import { useToasts } from './Toast';
import { UniversalModal } from './UniversalModal';

import { EmptyState } from './EmptyState';
import { translatePluggyCategory } from '../services/openFinanceService';

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

  // Date Range Filters
  const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  // Bank/Card Filter
  const [selectedCardId, setSelectedCardId] = useState<string>('all');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Auto-remove duplicates
  const [hasCheckedDuplicates, setHasCheckedDuplicates] = useState(false);

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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

  // Extract unique years from transactions for the dropdown
  const yearOptions = useMemo(() => {
    const years = new Set<number>(transactions.map(t => {
      if (!t.date) return new Date().getFullYear();
      return parseInt(t.date.split('-')[0]);
    }));
    years.add(new Date().getFullYear());
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    return [{ value: 0, label: 'Todos' }, ...sortedYears.map(y => ({ value: y, label: y.toString() }))];
  }, [transactions]);

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
        if (!t.date) return false;

        const transactionYear = parseInt(t.date.split('-')[0]);
        const matchesYear = selectedYear === 0 || transactionYear === selectedYear;

        const matchesSearch =
          !searchTerm ||
          (t.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.category || "").toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStartDate = startDate ? t.date >= startDate : true;
        const matchesEndDate = endDate ? t.date <= endDate : true;

        // Bank/Card Filter
        let matchesCard = true;
        if (selectedCardId !== 'all') {
          // Check both cardId and accountId as they might be used interchangeably
          // Using String() to ensure safe comparison against potential number/string mismatches
          const targetId = String(selectedCardId);
          const txCardId = t.cardId ? String(t.cardId) : '';
          const txAccountId = t.accountId ? String(t.accountId) : '';

          matchesCard = txCardId === targetId || txAccountId === targetId;
        }

        return matchesYear && matchesSearch && matchesStartDate && matchesEndDate && matchesCard;
      })
      .sort((a, b) => {
        const aValue: any = (a as any)[sortField];
        const bValue: any = (b as any)[sortField];
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [transactions, searchTerm, sortField, sortDirection, selectedYear, startDate, endDate, selectedCardId]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      if (isCreditCardPayment(tx)) return acc;
      const amt = Math.abs(Number((tx as any).amount) || 0);
      if (tx.type === 'income') return acc - amt;
      return acc + amt;
    }, 0);
  }, [filteredTransactions]);

  // Auto-remove duplicates when transactions load
  React.useEffect(() => {
    if (hasCheckedDuplicates || transactions.length === 0) return;

    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      const key = `${t.date}-${Math.abs(t.amount)}-${(t.description || '').trim().toLowerCase()}-${t.type}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    const duplicates = Object.values(groups).filter(g => g.length > 1);

    if (duplicates.length > 0) {
      const idsToDelete: string[] = [];
      duplicates.forEach(group => {
        for (let i = 1; i < group.length; i++) {
          idsToDelete.push(group[i].id);
        }
      });

      // Delete duplicates silently
      Promise.all(idsToDelete.map(id => onDelete(id)))
        .then(() => {
          toast.success(`${idsToDelete.length} duplicatas removidas automaticamente!`);
        })
        .catch(() => { });
    }

    setHasCheckedDuplicates(true);
  }, [transactions, hasCheckedDuplicates, onDelete, toast]);

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
    setEditTransaction(null);
  };

  const handleCloseEdit = () => {
    setIsEditModalOpen(false);
    setEditTransaction(null);
  };

  const CATEGORIES = ['Trabalho', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Moradia', 'Outros'];

  // Get selected card name for display
  const getSelectedCardLabel = () => {
    if (selectedCardId === 'all') return 'Todos os Cartões';
    const card = creditCardAccounts.find(c => c.id === selectedCardId);
    return card ? (card.name || card.institution || 'Cartão') : 'Cartão Selecionado';
  };

  return (
    <div className="flex flex-col h-full animate-fade-in w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Fatura do Cartão</h2>
          <p className="text-sm text-gray-400 mt-1">{filteredTransactions.length} lançamentos</p>
        </div>

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
                accountId: creditCardAccounts[0]?.id || undefined,
                totalInstallments: 1,
                installmentNumber: 1
              });
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#d97757] hover:bg-[#c56a4d] text-white text-sm rounded-lg font-semibold transition-all shadow-md shadow-[#d97757]/20"
          >
            <Plus size={18} strokeWidth={3} />
            <span className="hidden sm:inline">Novo Lançamento</span>
          </button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        {/* Search - Left */}
        <div className="relative w-72 group">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
          <input
            type="text"
            placeholder="Buscar na fatura..."
            className="w-full h-11 pl-11 pr-4 bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] hover:border-gray-500 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-sm text-white transition-all placeholder-gray-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Card Filter Dropdown - Right */}
        <div className="relative z-50">
          <Dropdown>
            <DropdownTrigger className="h-11 px-4 bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] hover:border-gray-500 rounded-xl flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-all font-medium justify-between min-w-[180px]">
              <div className="flex items-center gap-2 truncate">
                <Filter size={16} className="text-[#d97757] flex-shrink-0" />
                <span className="truncate">{getSelectedCardLabel()}</span>
              </div>
              <ArrowDownCircle size={14} className="text-gray-500 flex-shrink-0" />
            </DropdownTrigger>
            <DropdownContent className="w-56" align="right">
              <DropdownItem
                onClick={() => setSelectedCardId('all')}
                icon={Filter}
                className={selectedCardId === 'all' ? 'bg-white/5 text-white' : ''}
              >
                Todos os Cartões
              </DropdownItem>
              {creditCardAccounts.map(card => (
                <DropdownItem
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  icon={CreditCard}
                  className={selectedCardId === card.id ? 'bg-white/5 text-white' : ''}
                >
                  {card.name || card.institution || 'Cartão Sem Nome'}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
        </div>

        {/* Start Date */}
        <div className="w-36">
          <CustomDatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="Início"
          />
        </div>

        {/* End Date */}
        <div className="w-36">
          <CustomDatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="Fim"
          />
        </div>

        {/* Year Selector */}
        <div className="w-28">
          <CustomSelect
            value={selectedYear}
            onChange={(val) => setSelectedYear(Number(val))}
            options={yearOptions}
            placeholder="Ano"
            className="h-11 bg-[#232322] border-[#373734] rounded-xl text-sm w-full"
          />
        </div>

        {/* Reset Button */}
        {(startDate || endDate || (selectedYear !== 0 && selectedYear !== new Date().getFullYear()) || selectedCardId !== 'all') && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setSelectedYear(new Date().getFullYear()); setSelectedCardId('all'); }}
            className="h-11 px-4 flex items-center justify-center gap-2 rounded-xl bg-[#232322] text-gray-400 hover:text-white hover:bg-[#2a2a28] border border-[#373734] transition-all text-xs font-bold uppercase tracking-wider"
          >
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      {/* Table Card */}
      <div className="bg-[#232322] border border-[#373734] rounded-xl flex flex-col flex-1 overflow-hidden">
        {/* Grid */}
        <div className="overflow-auto flex-1 custom-scrollbar z-0">
          <table className="hidden lg:table min-w-full border-collapse text-sm text-left h-full">
            <thead className="bg-[#333432] sticky top-0 z-10 text-xs font-bold text-gray-400 uppercase tracking-wider shadow-sm">
              <tr>
                <th className="px-6 py-4 border-b border-r border-[#373734] w-40 first:rounded-tl-xl">
                  <Dropdown>
                    <DropdownTrigger className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer w-full text-left">
                      Data {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </DropdownTrigger>
                    <DropdownContent align="left" width="w-48">
                      <DropdownItem
                        onClick={() => { setSortField('date'); setSortDirection('asc'); }}
                        icon={ArrowUpCircle}
                        className={sortField === 'date' && sortDirection === 'asc' ? 'bg-white/10 text-white' : ''}
                      >
                        Crescente
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => { setSortField('date'); setSortDirection('desc'); }}
                        icon={ArrowDownCircle}
                        className={sortField === 'date' && sortDirection === 'desc' ? 'bg-white/10 text-white' : ''}
                      >
                        Decrescente
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                </th>
                <th className="px-6 py-4 border-b border-r border-[#373734]">
                  <Dropdown>
                    <DropdownTrigger className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer w-full text-left">
                      Descrição {sortField === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </DropdownTrigger>
                    <DropdownContent align="left" width="w-48">
                      <DropdownItem
                        onClick={() => { setSortField('description'); setSortDirection('asc'); }}
                        icon={ArrowUpCircle}
                        className={sortField === 'description' && sortDirection === 'asc' ? 'bg-white/10 text-white' : ''}
                      >
                        A-Z
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => { setSortField('description'); setSortDirection('desc'); }}
                        icon={ArrowDownCircle}
                        className={sortField === 'description' && sortDirection === 'desc' ? 'bg-white/10 text-white' : ''}
                      >
                        Z-A
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                </th>
                <th className="px-6 py-4 border-b border-r border-[#373734] w-48">
                  <Dropdown>
                    <DropdownTrigger className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer w-full text-left">
                      Categoria {sortField === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </DropdownTrigger>
                    <DropdownContent align="left" width="w-48">
                      <DropdownItem
                        onClick={() => { setSortField('category'); setSortDirection('asc'); }}
                        icon={ArrowUpCircle}
                        className={sortField === 'category' && sortDirection === 'asc' ? 'bg-white/10 text-white' : ''}
                      >
                        A-Z
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => { setSortField('category'); setSortDirection('desc'); }}
                        icon={ArrowDownCircle}
                        className={sortField === 'category' && sortDirection === 'desc' ? 'bg-white/10 text-white' : ''}
                      >
                        Z-A
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                </th>
                <th className="px-6 py-4 border-b border-r border-[#373734] w-40">
                  <Dropdown>
                    <DropdownTrigger className="flex items-center justify-end gap-2 hover:text-white transition-colors cursor-pointer w-full text-right">
                      Valor {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </DropdownTrigger>
                    <DropdownContent align="right" width="w-48">
                      <DropdownItem
                        onClick={() => { setSortField('amount'); setSortDirection('asc'); }}
                        icon={ArrowUpCircle}
                        className={sortField === 'amount' && sortDirection === 'asc' ? 'bg-white/10 text-white' : ''}
                      >
                        Menor Valor
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => { setSortField('amount'); setSortDirection('desc'); }}
                        icon={ArrowDownCircle}
                        className={sortField === 'amount' && sortDirection === 'desc' ? 'bg-white/10 text-white' : ''}
                      >
                        Maior Valor
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                </th>

                <th className="px-6 py-4 border-b border-r border-[#373734] w-32 text-center">Status</th>
                <th className="px-6 py-4 border-b border-[#373734] w-28 text-center last:rounded-tr-xl">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#373734]">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-[#373734]/30 transition-colors group border-b border-[#373734]">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-xs border-r border-[#373734]">
                    {formatDate(t.date)}
                  </td>
                  <td className="px-6 py-4 text-gray-200 font-medium border-r border-[#373734]">
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
                  <td className="px-6 py-4 text-gray-400 border-r border-[#373734]">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-[#1a1a19] rounded-lg text-gray-500 border border-[#373734]">
                        {getCategoryIcon(translatePluggyCategory(t.category), 14)}
                      </div>
                      <span className="text-xs">{translatePluggyCategory(t.category)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right border-r border-[#373734]">
                    <span className={`font-bold font-mono ${t.type === 'income' ? 'text-emerald-400' : 'text-gray-200'}`}>
                      {t.type === 'income' ? '+' : '-'} {formatCurrency(Math.abs(t.amount))}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-center border-r border-[#373734]">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${t.status === 'completed'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-amber-500/15 text-amber-400'
                      }`}>
                      {t.status === 'completed' ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditClick(t)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-[#373734] rounded-xl transition-colors"
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
          <div className="lg:hidden p-4 space-y-4 flex flex-col pb-24">
            {filteredTransactions.map((t) => (
              <div key={t.id} className="bg-transparent border-b border-[#373734] p-4 relative group shrink-0 last:border-0">
                <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${t.type === 'income' ? 'bg-emerald-500' : 'bg-[#d97757]'}`}></div>
                <div className="flex justify-between items-start mb-3 pl-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-100 text-sm sm:text-base break-words leading-tight">{t.description}</h4>
                      {(t as any).isEstimated && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] uppercase font-bold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20 flex-shrink-0"
                          title="Valor estimado aguardando fatura real"
                        >
                          Estimado
                        </span>
                      )}
                      {(t as any).totalInstallments > 1 && (
                        <span className="text-[9px] text-gray-500 font-mono bg-[#1a1a19] px-1.5 py-0.5 rounded border border-[#373734] flex-shrink-0">
                          {(t as any).installmentNumber || 1}/{(t as any).totalInstallments}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5 bg-[#1a1a19] px-2 py-1 rounded-md border border-[#373734]">
                        {getCategoryIcon(translatePluggyCategory(t.category), 12)}
                        {translatePluggyCategory(t.category)}
                      </span>
                      <span className="font-mono flex items-center gap-1.5">
                        <Calendar size={12} /> {formatDate(t.date)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 ml-1">
                    <button
                      onClick={() => handleEditClick(t)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1a19] hover:bg-[#2a2a28] text-gray-500 hover:text-white border border-[#373734] hover:border-gray-600 transition-all"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(t.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1a19] hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-[#373734] hover:border-red-500/30 transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center pl-3 pt-3 border-t border-[#373734]/50">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[#373734] text-gray-400'}`}>
                      {t.type === 'income' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
                    </div>
                    <span className={`text-xl font-bold font-mono ${t.type === 'income' ? 'text-emerald-400' : 'text-white'}`}>
                      {formatCurrency(Math.abs(t.amount))}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${t.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-amber-500/15 text-amber-400'
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
        <div className="bg-[#333432] border-t border-[#373734] px-6 py-3 text-xs text-gray-400 flex flex-col sm:flex-row justify-between gap-3 font-medium uppercase tracking-wide">
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
      </div>

      {/* Delete Confirmation */}
      <ConfirmationBar
        isOpen={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            onDelete(deleteId);
            setDeleteId(null);
          }
        }}
        label="Remover Transação?"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isDestructive={true}
      />

      {/* Edit Transaction Modal */}
      {editTransaction && (
        <UniversalModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEdit}
          title="Editar Lançamento"
          icon={<Edit2 size={18} />}
          themeColor={editTransaction.type === 'income' ? '#10b981' : '#d97757'}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="flex-1 py-3.5 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl font-semibold transition-all border border-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-[2] py-3.5 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Check size={18} strokeWidth={2.5} />
                Salvar
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Tipo Segmentado com Smooth */}
            <div className="relative flex p-1 bg-gray-900/50 rounded-xl">
              <div
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out"
                style={{
                  left: editTransaction.type === 'expense' ? '4px' : 'calc(50% + 0px)',
                  backgroundColor: editTransaction.type === 'expense' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)'
                }}
              />
              <button
                type="button"
                onClick={() => setEditTransaction({ ...editTransaction, type: 'expense' })}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${editTransaction.type === 'expense' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <TrendingDown size={14} /> Despesa
              </button>
              <button
                type="button"
                onClick={() => setEditTransaction({ ...editTransaction, type: 'income' })}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${editTransaction.type === 'income' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <TrendingUp size={14} /> Receita
              </button>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Descrição</label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                <input
                  type="text"
                  value={editTransaction.description}
                  onChange={(e) => setEditTransaction({ ...editTransaction, description: e.target.value })}
                  className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                  placeholder="Ex: Compra Online"
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
                    value={editTransaction.amount?.toString()}
                    onChange={(e) => setEditTransaction({ ...editTransaction, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Data */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Data</label>
                <CustomDatePicker
                  value={editTransaction.date || ''}
                  onChange={(val) => setEditTransaction({ ...editTransaction, date: val })}
                />
              </div>
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Categoria</label>
              <CustomAutocomplete
                value={editTransaction.category || ''}
                onChange={(val) => setEditTransaction({ ...editTransaction, category: val })}
                options={CATEGORIES}
                icon={<Tag size={16} />}
                placeholder="Selecione ou digite..."
              />
            </div>

            {/* Status Toggle com Smooth */}
            <div className="flex items-center justify-between py-3 border-t border-gray-800/40">
              <div className="flex items-center gap-2.5">
                {editTransaction.status === 'completed'
                  ? <Check size={16} className="text-emerald-500" />
                  : <AlertCircle size={16} className="text-amber-500" />
                }
                <div>
                  <span className="block text-sm font-medium text-gray-300">Status</span>
                  <span className="block text-[10px] text-gray-500">
                    {editTransaction.status === 'completed' ? 'Pago / Recebido' : 'Pendente'}
                  </span>
                </div>
              </div>

              <div className="relative flex bg-gray-900 rounded-lg p-0.5 border border-gray-800">
                <div
                  className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-300 ease-out"
                  style={{
                    left: editTransaction.status === 'pending' ? '2px' : 'calc(50% + 0px)',
                    backgroundColor: editTransaction.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setEditTransaction({ ...editTransaction, status: 'pending' })}
                  className={`relative z-10 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${editTransaction.status === 'pending' ? 'text-amber-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Pendente
                </button>
                <button
                  type="button"
                  onClick={() => setEditTransaction({ ...editTransaction, status: 'completed' })}
                  className={`relative z-10 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${editTransaction.status === 'completed' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Pago
                </button>
              </div>
            </div>
          </div>
        </UniversalModal>
      )}

      {/* Add Transaction Modal */}
      <UniversalModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Novo Lançamento (Cartão)"
        icon={<CreditCard size={18} />}
        themeColor={newTransaction.type === 'income' ? '#10b981' : '#d97757'}
        footer={
          <button
            type="button"
            onClick={async () => {
              if (!newTransaction.description || !newTransaction.amount || newTransaction.amount <= 0 || !newTransaction.date) {
                toast.error("Preencha a descrição, valor e data.");
                return;
              }
              if (onAdd) {
                const acc = creditCardAccounts.find(a => a.id === newTransaction.accountId);
                const finalTx = {
                  ...newTransaction,
                  cardId: newTransaction.accountId,
                  cardName: acc?.name || 'Cartão Manual',
                  accountType: 'CREDIT_CARD',
                  installmentNumber: 1,
                  totalInstallments: newTransaction.totalInstallments || 1
                };

                await onAdd(finalTx as any);
                toast.success("Lançamento de cartão adicionado!");
                setIsAddModalOpen(false);
              }
            }}
            className={`w-full py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${newTransaction.type === 'income'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
              : 'bg-[#d97757] hover:bg-[#e08868] text-white'
              }`}
          >
            <Check size={18} strokeWidth={2.5} />
            Confirmar
          </button>
        }
      >
        <div className="space-y-5">
          {/* Tipo Segmentado com Smooth */}
          <div className="relative flex p-1 bg-gray-900/50 rounded-xl">
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out"
              style={{
                left: newTransaction.type === 'expense' ? '4px' : 'calc(50% + 0px)',
                backgroundColor: newTransaction.type === 'expense' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)'
              }}
            />
            <button
              type="button"
              onClick={() => setNewTransaction({ ...newTransaction, type: 'expense' })}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${newTransaction.type === 'expense' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <TrendingDown size={14} /> Despesa
            </button>
            <button
              type="button"
              onClick={() => setNewTransaction({ ...newTransaction, type: 'income' })}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${newTransaction.type === 'income' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <TrendingUp size={14} /> Receita
            </button>
          </div>

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

          {/* Status Toggle com Smooth */}
          <div className="flex items-center justify-between py-3 border-t border-gray-800/40">
            <div className="flex items-center gap-2.5">
              {newTransaction.status === 'completed'
                ? <Check size={16} className="text-emerald-500" />
                : <AlertCircle size={16} className="text-amber-500" />
              }
              <div>
                <span className="block text-sm font-medium text-gray-300">Status</span>
                <span className="block text-[10px] text-gray-500">
                  {newTransaction.status === 'completed' ? 'Pago / Recebido' : 'Pendente'}
                </span>
              </div>
            </div>

            <div className="relative flex bg-gray-900 rounded-lg p-0.5 border border-gray-800">
              <div
                className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-300 ease-out"
                style={{
                  left: newTransaction.status === 'pending' ? '2px' : 'calc(50% + 0px)',
                  backgroundColor: newTransaction.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                }}
              />
              <button
                type="button"
                onClick={() => setNewTransaction({ ...newTransaction, status: 'pending' })}
                className={`relative z-10 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${newTransaction.status === 'pending' ? 'text-amber-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Pendente
              </button>
              <button
                type="button"
                onClick={() => setNewTransaction({ ...newTransaction, status: 'completed' })}
                className={`relative z-10 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${newTransaction.status === 'completed' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Pago
              </button>
            </div>
          </div>
        </div>
      </UniversalModal>
    </div>
  );
};
