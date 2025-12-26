import React, { useState, useMemo } from 'react';
import { Transaction, ConnectedAccount } from '../types';
import { Trash2, Search, Calendar, getCategoryIcon, X, Filter, Edit2, Check, ArrowUpCircle, ArrowDownCircle, AlertCircle, Plus, FileText, DollarSign, Tag, RefreshCw, TrendingUp, TrendingDown, Landmark, ChevronLeft, ChevronRight } from './Icons';
import { CustomSelect, CustomDatePicker, CustomAutocomplete } from './UIComponents';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './Dropdown';
import { ConfirmationBar } from './ConfirmationBar';
import { createPortal } from 'react-dom';
import { useToasts } from './Toast';
import { EmptyState } from './EmptyState';
import { translatePluggyCategory } from '../services/openFinanceService';
import { UniversalModal } from './UniversalModal';

interface ExcelTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (transaction: Transaction) => void;
  isManualMode?: boolean;
  onAdd?: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  accounts?: ConnectedAccount[];
}

export const ExcelTable: React.FC<ExcelTableProps> = ({ transactions, onDelete, onUpdate, isManualMode, onAdd, accounts = [] }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState<keyof Transaction>('date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  // Date Range Filters
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Account Filter
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  // Confirmation Card State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit Modal State
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: '',
    type: 'expense',
    status: 'completed'
  });

  const toast = useToasts();

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

  const handleSort = (field: keyof Transaction) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredTransactions = transactions
    .filter(t => {
      if (!t.date) return false;
      const transactionYear = parseInt(t.date.split('-')[0]);
      const matchesYear = selectedYear === 0 || transactionYear === selectedYear;

      const matchesSearch =
        (t.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.category || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStartDate = startDate ? t.date >= startDate : true;
      const matchesEndDate = endDate ? t.date <= endDate : true;

      // Account Filter
      let matchesAccount = true;
      if (selectedAccountId !== 'all') {
        matchesAccount = t.accountId === selectedAccountId;
      }

      return matchesYear && matchesSearch && matchesStartDate && matchesEndDate && matchesAccount;
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // Paginação: calcular transações paginadas
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  // Reset página quando filtros mudam
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedYear, startDate, endDate, selectedAccountId]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

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

  const translateCategory = (category: string) => {
    return translatePluggyCategory(category);
  };

  // Get selected account name for display
  const getSelectedAccountLabel = () => {
    if (selectedAccountId === 'all') return 'Todas as Contas';
    const acc = accounts.find(a => a.id === selectedAccountId);
    return acc ? (acc.name || acc.institution || 'Conta') : 'Conta Selecionada';
  };

  return (
    <div className="flex flex-col h-full animate-fade-in w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Histórico de Movimentações</h2>
          <p className="text-sm text-gray-400 mt-1">{filteredTransactions.length} registros encontrados</p>
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
                status: 'completed'
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
            placeholder="Buscar movimentações..."
            className="w-full h-11 pl-11 pr-4 bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] hover:border-gray-500 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-sm text-white transition-all placeholder-gray-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Account Filter Dropdown - Right */}
        <div className="relative z-50">
          <Dropdown>
            <DropdownTrigger className="h-11 px-4 bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] hover:border-gray-500 rounded-xl flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-all font-medium justify-between min-w-[180px]">
              <div className="flex items-center gap-2 truncate">
                <Filter size={16} className="text-[#d97757] flex-shrink-0" />
                <span className="truncate">{getSelectedAccountLabel()}</span>
              </div>
              <ArrowDownCircle size={14} className="text-gray-500 flex-shrink-0" />
            </DropdownTrigger>
            <DropdownContent className="w-56" align="right">
              <DropdownItem
                onClick={() => setSelectedAccountId('all')}
                icon={Filter}
                className={selectedAccountId === 'all' ? 'bg-white/5 text-white' : ''}
              >
                Todas as Contas
              </DropdownItem>
              {accounts.map(acc => (
                <DropdownItem
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  icon={Landmark}
                  className={selectedAccountId === acc.id ? 'bg-white/5 text-white' : ''}
                >
                  {acc.name || acc.institution || 'Conta Sem Nome'}
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
        {(startDate || endDate || (selectedYear !== 0 && selectedYear !== new Date().getFullYear()) || selectedAccountId !== 'all') && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setSelectedYear(new Date().getFullYear()); setSelectedAccountId('all'); }}
            className="h-11 px-4 flex items-center justify-center gap-2 rounded-xl bg-[#232322] text-gray-400 hover:text-white hover:bg-[#2a2a28] border border-[#373734] transition-all text-xs font-bold uppercase tracking-wider"
          >
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      {/* Table Card */}
      <div className="bg-[#232322] border border-[#373734] rounded-xl flex flex-col flex-1 overflow-hidden">
        {/* Spreadsheet Grid */}
        <div className="overflow-auto flex-1 custom-scrollbar z-0">
          {/* Desktop Table View */}
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
              {paginatedTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-[#373734]/10 transition-colors group border-b border-[#373734]">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-xs border-r border-[#373734]">
                    {formatDate(t.date)}
                  </td>
                  <td className="px-6 py-4 text-gray-200 font-medium border-r border-[#373734]">
                    <div className="flex items-center gap-2">
                      <span className={t.description.toLowerCase().includes('salário') ? 'text-emerald-400' : ''}>{t.description}</span>
                      {t.importSource === 'pluggy' && t.needsApproval && (
                        <span className="px-2 py-0.5 text-[9px] uppercase font-bold rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Revisar
                        </span>
                      )}
                      {t.ignored && (
                        <span className="px-2 py-0.5 text-[9px] uppercase font-bold rounded-md bg-gray-800 text-gray-500 border border-gray-700">
                          Ignorado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400 border-r border-[#373734]">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-[#1a1a19] rounded-lg text-gray-500 border border-[#373734]">
                        {getCategoryIcon(translateCategory(t.category || "Outros"), 14)}
                      </div>
                      <span className="text-xs">{translateCategory(t.category || "Outros")}</span>
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
                      title="Nenhum lançamento encontrado"
                      description="Tente ajustar os filtros de data ou busca."
                      className="!border-0 !bg-transparent !shadow-none"
                      minHeight="h-full"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View - REDESIGNED */}
        <div className="lg:hidden p-4 space-y-4 flex flex-col pb-24">
          {paginatedTransactions.map((t) => (
            <div key={t.id} className="bg-transparent border-b border-[#373734] p-4 relative group shrink-0 last:border-0">
              {/* Left Colored Bar */}
              <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${t.type === 'income' ? 'bg-emerald-500' : 'bg-[#d97757]'}`}></div>

              <div className="flex justify-between items-start mb-3 pl-3">
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-bold text-gray-100 text-sm sm:text-base mb-1 break-words leading-tight">{t.description}</h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5 bg-[#1a1a19] px-2 py-1 rounded-md border border-[#373734]">
                      {getCategoryIcon(translateCategory(t.category || "Outros"), 12)}
                      {translateCategory(t.category || "Outros")}
                    </span>
                    <span className="font-mono flex items-center gap-1.5">
                      <Calendar size={12} /> {formatDate(t.date)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 ml-1">
                  <button
                    onClick={() => handleEditClick(t)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-500 hover:text-white border border-gray-800 hover:border-gray-700 transition-all"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteId(t.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-gray-800 hover:border-red-500/30 transition-all"
                    title="Excluir"
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
              title="Nenhum lançamento encontrado"
              description="Tente ajustar os filtros de data ou busca."
              className="!border-0 !bg-transparent !shadow-none flex-1"
              minHeight="h-full"
            />
          )}
        </div>

        {/* Footer Summary with Pagination */}
        <div className="bg-[#333432] border-t border-[#373734] px-6 py-3 text-xs text-gray-400 flex flex-col gap-3">
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg transition-all ${currentPage === 1 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === pageNum
                        ? 'bg-[#d97757] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg transition-all ${currentPage === totalPages ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                <ChevronRight size={18} />
              </button>

              <span className="ml-2 text-gray-500">
                Página {currentPage} de {totalPages}
              </span>
            </div>
          )}

          {/* Stats Row */}
          <div className="flex flex-col sm:flex-row justify-between gap-2 font-medium uppercase tracking-wide">
            <div>Mostrando: <span className="text-white">{paginatedTransactions.length}</span> de <span className="text-white">{filteredTransactions.length}</span> registros</div>
            <div className="flex items-center gap-2">
              <span>Saldo Filtrado:</span>
              <span className={`font-mono font-bold text-sm ${filteredTransactions.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0) >= 0
                ? 'text-emerald-400'
                : 'text-red-400'
                }`}>
                {formatCurrency(filteredTransactions.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0))}
              </span>
            </div>
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
                  placeholder="Ex: Salário"
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
        title="Novo Lançamento"
        icon={<Plus size={18} />}
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
                await onAdd(newTransaction as any);
                toast.success("Lançamento adicionado!");
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
                placeholder={newTransaction.type === 'income' ? "Ex: Salário" : "Ex: Almoço"}
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
              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Data</label>
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

          {/* Status Toggle */}
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
}