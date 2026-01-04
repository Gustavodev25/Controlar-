import React, { useState, useMemo } from 'react';
import { Transaction, ConnectedAccount } from '../types';
import { Trash2, Search, Calendar, getCategoryIcon, X, Filter, Edit2, Check, ArrowUpCircle, ArrowDownCircle, AlertCircle, Plus, FileText, DollarSign, Tag, RefreshCw, TrendingUp, TrendingDown, Landmark, ChevronLeft, ChevronRight, Minus, HelpCircle } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect, CustomDatePicker, CustomAutocomplete } from './UIComponents';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './Dropdown';
import { ConfirmationBar } from './ConfirmationBar';
import { createPortal } from 'react-dom';
import { useToasts } from './Toast';
import { EmptyState } from './EmptyState';
import { UniversalModal } from './UniversalModal';
import { exportToCSV } from '../utils/export';
import { useCategoryTranslation } from '../hooks/useCategoryTranslation';
import { Button } from './Button';
import { TutorialModal } from './TutorialModal';
import { Walkthrough } from './Walkthrough';

interface ExcelTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (transaction: Transaction) => void;
  isManualMode?: boolean;
  onAdd?: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  accounts?: ConnectedAccount[];
  userId?: string;
  onBulkUpdate?: (ids: string[], updates: Partial<Transaction>) => void;
}

export const ExcelTable: React.FC<ExcelTableProps> = ({ transactions, onDelete, onUpdate, isManualMode, onAdd, accounts = [], userId, onBulkUpdate }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState<keyof Transaction>('date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  // Date Range Filters
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Account Filter
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  // Category Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Confirmation Card State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit Modal State
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Walkthrough State
  const [isWalkthroughActive, setIsWalkthroughActive] = useState(false);

  const startWalkthrough = () => {
    setIsWalkthroughActive(true);
    if (selectedIds.length === 0 && filteredTransactions.length > 0) {
      setSelectedIds([filteredTransactions[0].id]);
    }
  };

  const walkthroughSteps: any[] = [
    {
      target: 'row-checkbox-0',
      title: 'Seleção em Lote',
      content: 'Clique na caixa de seleção para marcar um ou mais itens. Isso ativa o menu de ações em massa.',
      placement: 'right'
    },
    {
      target: 'bulk-action-bar',
      title: 'Edição Múltipla',
      content: 'Com itens selecionados, use esta barra para alterar a categoria de todos eles de uma só vez.',
      placement: 'bottom'
    },
    {
      target: 'row-edit-btn-0',
      title: 'Edição Individual',
      content: 'Clique no ícone de lápis para editar todos os detalhes de uma transação específica.',
      placement: 'left'
    },
    {
      target: 'export-btn',
      title: 'Exportar Dados',
      content: 'Exporte seus dados filtrados para analise externa.',
      placement: 'bottom'
    }
  ];

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

  // Extract unique categories from transactions
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.forEach(t => {
      if (t.category) {
        categories.add(t.category);
      }
    });
    return Array.from(categories).sort();
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

      // Category Filter
      let matchesCategory = true;
      if (selectedCategory !== 'all') {
        matchesCategory = t.category === selectedCategory;
      }

      return matchesYear && matchesSearch && matchesStartDate && matchesEndDate && matchesAccount && matchesCategory;
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
  }, [searchTerm, selectedYear, startDate, endDate, selectedAccountId, selectedCategory]);

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

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(filteredTransactions, `movimentacoes_${dateStr}.csv`);
  };

  // Hook para tradução de categorias do usuário
  const { translateCategory, categoryMappings } = useCategoryTranslation(userId);

  // Usar categorias do mapeamento Pluggy ao invés de hardcoded
  const CATEGORIES = useMemo(() => {
    return categoryMappings.map(cat => cat.displayName);
  }, [categoryMappings]);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');

  const handleSelectAll = () => {
    if (selectedIds.length === filteredTransactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTransactions.map(t => t.id));
    }
  };

  const handleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkSubmit = () => {
    if (onBulkUpdate && bulkCategory) {
      onBulkUpdate(selectedIds, { category: bulkCategory });
      setSelectedIds([]);
      setBulkCategory('');
      setIsBulkEditOpen(false);
    }
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

          <button
            id="export-btn"
            data-tour="export-btn"
            onClick={handleExport}
            className="flex items-center gap-2 px-2 py-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            <FileText size={18} />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          <button
            onClick={startWalkthrough}
            className="flex items-center gap-2 px-2 py-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
            title="Ajuda e Dicas de Uso"
          >
            <HelpCircle size={18} />
            <span className="hidden sm:inline">Ajuda</span>
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        {/* Search - Left */}
        <div className="relative w-full sm:w-72 group order-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
          <input
            type="text"
            placeholder="Buscar movimentações..."
            className="w-full h-11 pl-11 pr-4 bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] hover:border-gray-500 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-sm text-white transition-all placeholder-gray-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Spacer - hidden on mobile */}
        <div className="hidden sm:block flex-1 order-2" />

        {/* Account Filter Dropdown */}
        <div className="relative z-50 w-full sm:w-auto order-3 sm:order-2">
          <Dropdown>
            <DropdownTrigger className="h-11 px-4 bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] hover:border-gray-500 rounded-xl flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-all font-medium justify-between w-full sm:min-w-[180px]">
              <div className="flex items-center gap-2 truncate">
                <Filter size={16} className="text-[#d97757] flex-shrink-0" />
                <span className="truncate">{getSelectedAccountLabel()}</span>
              </div>
              <ArrowDownCircle size={14} className="text-gray-500 flex-shrink-0" />
            </DropdownTrigger>
            <DropdownContent className="w-56" align="left">
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

        {/* Category Filter Dropdown */}
        <div className="relative z-50 w-full sm:w-auto order-4 sm:order-3">
          <Dropdown>
            <DropdownTrigger className="h-11 px-4 bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] hover:border-gray-500 rounded-xl flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-all font-medium justify-between w-full sm:min-w-[180px]">
              <div className="flex items-center gap-2 truncate">
                <Tag size={16} className="text-[#d97757] flex-shrink-0" />
                <span className="truncate">{selectedCategory === 'all' ? 'Todas as Categorias' : translateCategory(selectedCategory)}</span>
              </div>
              <ArrowDownCircle size={14} className="text-gray-500 flex-shrink-0" />
            </DropdownTrigger>
            <DropdownContent className="w-64 max-h-80 overflow-y-auto custom-scrollbar" align="left">
              <DropdownItem
                onClick={() => setSelectedCategory('all')}
                icon={Tag}
                className={selectedCategory === 'all' ? 'bg-white/5 text-white' : ''}
              >
                Todas as Categorias
              </DropdownItem>
              {availableCategories.map(cat => (
                <DropdownItem
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  icon={Tag}
                  className={selectedCategory === cat ? 'bg-white/5 text-white' : ''}
                >
                  {translateCategory(cat)}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
        </div>

        {/* Start Date */}
        <div className="w-[calc(50%-6px)] sm:w-36 order-4 sm:order-3">
          <CustomDatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="Início"
            dropdownMode="fixed"
          />
        </div>

        {/* End Date */}
        <div className="w-[calc(50%-6px)] sm:w-36 order-5 sm:order-4">
          <CustomDatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="Fim"
            dropdownMode="fixed"
          />
        </div>

        {/* Year Selector */}
        <div className="w-[calc(50%-6px)] sm:w-28 order-6 sm:order-5">
          <CustomSelect
            value={selectedYear}
            onChange={(val) => setSelectedYear(Number(val))}
            options={yearOptions}
            placeholder="Ano"
            className="h-11 bg-[#232322] border-[#373734] rounded-xl text-sm w-full"
            portal
          />
        </div>

        {/* Reset Button */}
        {(startDate || endDate || (selectedYear !== 0 && selectedYear !== new Date().getFullYear()) || selectedAccountId !== 'all' || selectedCategory !== 'all') && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setSelectedYear(new Date().getFullYear()); setSelectedAccountId('all'); setSelectedCategory('all'); }}
            className="h-11 px-4 w-[calc(50%-6px)] sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#232322] text-gray-400 hover:text-white hover:bg-[#2a2a28] border border-[#373734] transition-all text-xs font-bold uppercase tracking-wider order-7 sm:order-6"
          >
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      {/* Table Card */}
      <div className="bg-[#232322] border border-[#373734] rounded-xl flex flex-col flex-1 overflow-hidden relative">
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              data-tour="bulk-action-bar"
              className="absolute top-0 left-0 right-0 z-20 bg-[#232322] border-b border-[#373734] p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 pl-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[#d97757]/20 text-[#d97757] font-bold text-xs">
                  {selectedIds.length}
                </span>
                <span className="text-white font-medium text-sm">
                  selecionados
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Dropdown>
                  <DropdownTrigger className="flex items-center gap-2 px-3 py-1.5 bg-[#3a3a38] border border-[#454542] hover:border-[#d97757]/50 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors">
                    <Tag size={13} />
                    {bulkCategory ? translateCategory(bulkCategory) : "Alterar Categoria"}
                  </DropdownTrigger>
                  <DropdownContent className="w-56 max-h-60 overflow-y-auto custom-scrollbar" align="right">
                    <DropdownItem
                      onClick={() => setBulkCategory('')}
                      icon={Tag}
                      className="bg-transparent text-gray-400"
                    >
                      Limpar Seleção
                    </DropdownItem>
                    {categoryMappings.length > 0 ? categoryMappings.map((cat) => (
                      <DropdownItem
                        key={cat.originalKey}
                        onClick={() => setBulkCategory(cat.originalKey)}
                        icon={Tag}
                        className={bulkCategory === cat.originalKey ? 'bg-white/5 text-white' : ''}
                      >
                        {cat.displayName || cat.originalKey}
                      </DropdownItem>
                    )) : CATEGORIES.map((cat: any) => (
                      <DropdownItem
                        key={cat}
                        onClick={() => setBulkCategory(cat)}
                        icon={Tag}
                        className={bulkCategory === cat ? 'bg-white/5 text-white' : ''}
                      >
                        {translateCategory(cat)}
                      </DropdownItem>
                    ))}
                  </DropdownContent>
                </Dropdown>

                <button
                  onClick={handleBulkSubmit}
                  disabled={!bulkCategory}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#d97757] hover:bg-[#c56646] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={13} />
                  Aplicar
                </button>

                <div className="h-4 w-px bg-gray-700 mx-1" />
                <button
                  onClick={() => setSelectedIds([])}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Limpar seleção"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Tip for Bulk Actions */}
              <div className="hidden xl:flex items-center gap-2 text-[10px] text-gray-500 bg-[#1a1a19] px-3 py-1.5 rounded-lg border border-[#373734] ml-auto mr-4">
                <AlertCircle size={12} className="text-[#d97757]" />
                <span>Dica: Use a seleção múltipla para organizar categorias rapidamente.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-auto flex-1 custom-scrollbar z-0">
          <table className="min-w-full border-collapse text-sm text-left h-full">
            <thead className="bg-[#333432] sticky top-0 z-10 text-xs font-bold text-gray-400 uppercase tracking-wider shadow-sm">
              <tr>
                <th className="px-4 py-4 border-b border-r border-[#373734] w-12 text-center first:rounded-tl-xl align-middle">
                  <div className="flex items-center justify-center h-full">
                    <button
                      onClick={handleSelectAll}
                      className="group flex items-center justify-center w-full h-full"
                    >
                      <div className={`
                        w-5 h-5 rounded-md border transition-all flex items-center justify-center
                        ${selectedIds.length > 0
                          ? 'bg-[#d97757] border-[#d97757] text-white shadow-lg shadow-[#d97757]/20'
                          : 'bg-[#3a3a38] border-[#454542] group-hover:border-[#d97757]/50 text-transparent'
                        }
                      `}>
                        {filteredTransactions.length > 0 && selectedIds.length === filteredTransactions.length ? (
                          <Check size={12} strokeWidth={3} />
                        ) : selectedIds.length > 0 ? (
                          <Minus size={12} strokeWidth={3} />
                        ) : (
                          <Check size={12} strokeWidth={3} />
                        )}
                      </div>
                    </button>
                  </div>
                </th>
                <th className="px-6 py-4 border-b border-r border-[#373734] w-40">
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
                {isManualMode && (
                  <th className="px-6 py-4 border-b border-[#373734] w-28 text-center last:rounded-tr-xl">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#373734]">
              {paginatedTransactions.map((t, index) => (
                <tr key={t.id} className="hover:bg-[#373734]/10 transition-colors group border-b border-[#373734]">
                  <td className="px-4 py-4 border-b border-r border-[#373734] text-center align-middle">
                    <div className="flex items-center justify-center h-full">
                      <button
                        onClick={(e) => handleSelectOne(t.id, e)}
                        className="group flex items-center justify-center w-full h-full"
                      >
                        <div
                          data-tour={index === 0 ? "row-checkbox-0" : undefined}
                          className={`
                          w-5 h-5 rounded-md border transition-all flex items-center justify-center
                          ${selectedIds.includes(t.id)
                              ? 'bg-[#d97757] border-[#d97757] text-white shadow-lg shadow-[#d97757]/20'
                              : 'bg-[#3a3a38] border-[#454542] group-hover:border-[#d97757]/50 text-transparent'
                            }
                        `}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                      </button>
                    </div>
                  </td>
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
                  {isManualMode && (
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
                  )}
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr className="h-full">
                  <td colSpan={7} className="p-4 h-full">
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

        {/* Mobile Card View */}
        <div className="lg:hidden flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
          <div className="p-4 space-y-4 flex flex-col pb-24">
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
                  {isManualMode && (
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
                  )}
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

      {/* Bulk Action Bar */}


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
      {
        editTransaction && (
          <UniversalModal
            isOpen={isEditModalOpen}
            onClose={handleCloseEdit}
            title="Editar Lançamento"
            icon={<Edit2 size={18} />}
            themeColor={editTransaction.type === 'income' ? '#10b981' : '#d97757'}
            footer={
              <div className="flex gap-3">
                <Button
                  variant="dark"
                  size="lg"
                  className="flex-1 text-gray-400 hover:text-white"
                  onClick={handleCloseEdit}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-[2]"
                  onClick={handleSaveEdit}
                >
                  Salvar
                </Button>
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

              {/* Categoria - Apenas Modo Manual */}
              {isManualMode && (
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
              )}

              {/* Status Toggle com Smooth - Apenas Modo Manual */}
              {isManualMode && (
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

                  <div className="relative flex bg-gray-900 rounded-lg p-0.5 border border-gray-800 w-48">
                    <div
                      className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-300 ease-out
                        ${editTransaction.status === 'pending' ? 'left-0.5 bg-amber-500/20' : 'left-1/2 bg-emerald-500/20'}
                      `}
                    />
                    <button
                      type="button"
                      onClick={() => setEditTransaction({ ...editTransaction, status: 'pending' })}
                      className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${editTransaction.status === 'pending' ? 'text-amber-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      PENDENTE
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTransaction({ ...editTransaction, status: 'completed' })}
                      className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${editTransaction.status === 'completed' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      PAGO
                    </button>
                  </div>
                </div>
              )}


            </div>
          </UniversalModal>
        )
      }

      {/* Add Transaction Modal */}
      <UniversalModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Novo Lançamento"
        icon={<Plus size={18} />}
        themeColor={newTransaction.type === 'income' ? '#10b981' : '#d97757'}
        footer={
          <Button
            variant={newTransaction.type === 'income' ? 'success' : 'primary'}
            size="lg"
            fullWidth
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
            className={newTransaction.type === 'income' ? '!bg-emerald-500 hover:!bg-emerald-400' : ''}
          >
            <Check size={18} strokeWidth={2.5} />
            Confirmar
          </Button>
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

            <div className="relative flex bg-gray-900 rounded-lg p-0.5 border border-gray-800 w-48">
              <div
                className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-300 ease-out
                  ${newTransaction.status === 'pending' ? 'left-0.5 bg-amber-500/20' : 'left-1/2 bg-emerald-500/20'}
                `}
              />
              <button
                type="button"
                onClick={() => setNewTransaction({ ...newTransaction, status: 'pending' })}
                className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${newTransaction.status === 'pending' ? 'text-amber-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                PENDENTE
              </button>
              <button
                type="button"
                onClick={() => setNewTransaction({ ...newTransaction, status: 'completed' })}
                className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${newTransaction.status === 'completed' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                PAGO
              </button>
            </div>
          </div>
        </div>
      </UniversalModal>
      <Walkthrough
        steps={walkthroughSteps}
        isActive={isWalkthroughActive}
        onComplete={() => setIsWalkthroughActive(false)}
        onSkip={() => setIsWalkthroughActive(false)}
      />
    </div >
  );
};
