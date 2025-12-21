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
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [isEditAnimating, setIsEditAnimating] = useState(false);

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
    status: 'completed'
  });

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

  // Edit Modal Control
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
    <div className="bg-[#30302E] rounded-3xl shadow-2xl border border-[#373734] overflow-hidden flex flex-col h-full animate-fade-in">

      {/* Toolbar */}
      <div className="p-4 lg:p-6 border-b border-[#373734] flex flex-col gap-4 bg-[#30302E]/95 backdrop-blur-xl relative z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d97757]/10 rounded-xl border border-[#d97757]/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-refresh-dot">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
                <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Histórico de Movimentações</h3>
              <p className="text-xs text-gray-400">{filteredTransactions.length} registros encontrados</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isManualMode && onAdd && (
              <>
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
                  className="hidden sm:flex items-center gap-2 px-4 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 border border-[#d97757]/50"
                >
                  <Plus size={18} strokeWidth={3} />
                  <span>Novo Lançamento</span>
                </button>

                {/* Mobile Add Button (Icon Only) */}
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
                  className="sm:hidden flex items-center justify-center w-10 h-10 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 border border-[#d97757]/50"
                  title="Novo Lançamento"
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
              </>
            )}

            <div className="relative w-full sm:w-64 group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
              <input
                type="text"
                placeholder="Buscar movimentações..."
                className="w-full pl-11 pr-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-sm text-white transition-all placeholder-gray-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-center pt-2">
          {/* Account Filter Dropdown - Row 1 (Full Width on Mobile) */}
          <div className="relative z-50 col-span-2 sm:col-span-1 sm:w-auto">
            <Dropdown>
              <DropdownTrigger className="w-full h-11 px-4 bg-gray-900 border border-gray-800 rounded-xl flex items-center gap-2 text-sm text-gray-300 hover:text-white hover:border-gray-700 transition-all font-medium justify-between min-w-[180px]">
                <div className="flex items-center gap-2 truncate">
                  <Filter size={16} className="text-[#d97757] flex-shrink-0" />
                  <span className="truncate">{getSelectedAccountLabel()}</span>
                </div>
                <ArrowDownCircle size={14} className="text-gray-500 flex-shrink-0" />
              </DropdownTrigger>
              <DropdownContent className="w-[calc(100vw-48px)] sm:w-56" align="left">
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

          {/* Start Date - Row 2 Col 1 */}
          <div className="col-span-1 sm:w-36">
            <CustomDatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Início"
            />
          </div>

          {/* End Date - Row 2 Col 2 */}
          <div className="col-span-1 sm:w-36">
            <CustomDatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="Fim"
            />
          </div>

          {/* Year Selector - Row 3 Col 1 */}
          <div className="col-span-1 sm:w-32">
            <CustomSelect
              value={selectedYear}
              onChange={(val) => setSelectedYear(Number(val))}
              options={yearOptions}
              placeholder="Ano"
              className="h-11 bg-gray-900 border-gray-800 rounded-xl text-sm w-full"
            />
          </div>

          {/* Reset Button - Row 3 Col 2 */}
          {(startDate || endDate || (selectedYear !== 0 && selectedYear !== new Date().getFullYear()) || selectedAccountId !== 'all') && (
            <div className="col-span-1 sm:w-auto">
              <button
                onClick={() => { setStartDate(''); setEndDate(''); setSelectedYear(new Date().getFullYear()); setSelectedAccountId('all'); }}
                className="w-full sm:w-auto h-11 px-4 flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 transition-all text-xs font-bold uppercase tracking-wider"
              >
                <X size={14} /> <span className="sm:hidden">Limpar</span><span className="hidden sm:inline">Limpar</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="overflow-auto flex-1 custom-scrollbar z-0 bg-[#30302E]">
        {/* Desktop Table View */}
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
              <th className="px-6 py-4 border-b border-[#373734] w-32 text-center">Status</th>
              <th className="px-6 py-4 border-b border-[#373734] w-28 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#373734]/50">
            {paginatedTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-[#373734]/30 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-xs">
                  {formatDate(t.date)}
                </td>
                <td className="px-6 py-4 text-gray-200 font-medium">
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
                <td className="px-6 py-4 text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-900 rounded-lg text-gray-500 border border-gray-800">
                      {getCategoryIcon(translateCategory(t.category || "Outros"), 14)}
                    </div>
                    <span className="text-xs">{translateCategory(t.category || "Outros")}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`font-bold font-mono ${t.type === 'income' ? 'text-emerald-400' : 'text-gray-200'}`}>
                    {t.type === 'income' ? '+' : '-'} {formatCurrency(Math.abs(t.amount))}
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

        {/* Mobile Card View - REDESIGNED */}
        <div className="lg:hidden p-4 space-y-4 flex flex-col pb-24">
          {paginatedTransactions.map((t) => (
            <div key={t.id} className="bg-[#30302E] border border-[#373734] rounded-2xl p-4 relative overflow-hidden shadow-lg group shrink-0">
              {/* Left Colored Bar */}
              <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${t.type === 'income' ? 'bg-emerald-500' : 'bg-[#d97757]'}`}></div>

              <div className="flex justify-between items-start mb-3 pl-3">
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-bold text-gray-100 text-sm sm:text-base mb-1 break-words leading-tight">{t.description}</h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5 bg-gray-900 px-2 py-1 rounded-md border border-gray-800">
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
              title="Nenhum lançamento encontrado"
              description="Tente ajustar os filtros de data ou busca."
              className="!border-0 !bg-transparent !shadow-none flex-1"
              minHeight="h-full"
            />
          )}
        </div>
      </div>

      {/* Footer Summary with Pagination */}
      <div className="bg-[#373734] border-t border-[#373734] px-6 py-3 text-xs text-gray-400 flex flex-col gap-3">
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
      {isEditVisible && editTransaction && createPortal(
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${isEditAnimating ? 'bg-black/80 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}
        >
          <div
            className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-visible border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isEditAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}
          >
            {/* Background Effects */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20 opacity-20"></div>
            </div>

            {/* Header */}
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

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 relative z-10">

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Descrição</label>
                <input
                  type="text"
                  value={editTransaction.description}
                  onChange={(e) => setEditTransaction({ ...editTransaction, description: e.target.value })}
                  className="w-full p-4 bg-gray-900/50 border border-gray-800 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-white font-medium transition-all placeholder-gray-600"
                  placeholder="Ex: Salário"
                />
              </div>

              {/* Amount */}
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
                      placeholder="0,00"
                    />
                  </div>
                </div>

                {/* Date */}
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

              {/* Category */}
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

              {/* Type Toggle */}
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

              {/* Status Toggle */}
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

            {/* Footer */}
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
            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 ${newTransaction.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'}`} />

            {/* Header */}
            <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Plus size={18} className="text-[#d97757]" />
                Novo Lançamento
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 relative z-10">

              {/* Tipo Segmentado */}
              <div className="flex p-1 bg-gray-900/50 rounded-xl">
                <button
                  type="button"
                  onClick={() => setNewTransaction({ ...newTransaction, type: 'expense' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${newTransaction.type === 'expense' ? 'bg-red-500/90 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <TrendingDown size={14} /> Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setNewTransaction({ ...newTransaction, type: 'income' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${newTransaction.type === 'income' ? 'bg-emerald-500/90 text-white' : 'text-gray-500 hover:text-gray-300'}`}
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

                <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-800">
                  <button
                    type="button"
                    onClick={() => setNewTransaction({ ...newTransaction, status: 'pending' })}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${newTransaction.status === 'pending' ? 'bg-amber-500/20 text-amber-500' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Pendente
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTransaction({ ...newTransaction, status: 'completed' })}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${newTransaction.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Pago
                  </button>
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
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};