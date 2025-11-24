
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { Trash2, Search, Calendar, getCategoryIcon, X, Filter, Edit2, Check } from './Icons';
import { CustomSelect, CustomDatePicker, ConfirmationCard } from './UIComponents';
import { createPortal } from 'react-dom';
import { useToasts } from './Toast';

interface ExcelTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (transaction: Transaction) => void;
}

export const ExcelTable: React.FC<ExcelTableProps> = ({ transactions, onDelete, onUpdate }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState<keyof Transaction>('date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  // Date Range Filters
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  // Confirmation Card State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit Modal State
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [isEditAnimating, setIsEditAnimating] = useState(false);

  const toast = useToasts();

  // Extract unique years from transactions for the dropdown
  const yearOptions = useMemo(() => {
    const years = new Set<number>(transactions.map(t => new Date(t.date).getFullYear()));
    years.add(new Date().getFullYear());
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    return sortedYears.map(y => ({ value: y, label: y.toString() }));
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
      const transactionYear = new Date(t.date).getFullYear();
      const matchesYear = transactionYear === selectedYear;

      // FIX: Guard against undefined description/category
      const matchesSearch =
        (t.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.category || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStartDate = startDate ? t.date >= startDate : true;
      const matchesEndDate = endDate ? t.date <= endDate : true;

      return matchesYear && matchesSearch && matchesStartDate && matchesEndDate;
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

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

  return (
    <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 overflow-hidden flex flex-col h-full animate-fade-in">
      {/* Toolbar */}
      <div className="p-3 lg:p-4 border-b border-gray-800 flex flex-col gap-3 bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-200 text-sm lg:text-base">
              Transações
            </h3>
            <span className="text-xs px-2 py-1 bg-gray-800 rounded-full text-gray-400 border border-gray-700">{filteredTransactions.length}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">

          {/* Year Selector - Custom */}
          <div className="w-24 lg:w-32 relative z-30">
            <CustomSelect
              value={selectedYear}
              onChange={(val) => setSelectedYear(Number(val))}
              options={yearOptions}
              placeholder="Ano"
              className="h-10 lg:h-11"
            />
          </div>

          {/* Start Date - Custom Date Picker Standalone */}
          <div className="w-28 lg:w-36 relative z-20">
            <CustomDatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Início"
            />
          </div>

          {/* End Date - Custom Date Picker Standalone */}
          <div className="w-28 lg:w-36 relative z-10">
            <CustomDatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="Fim"
            />
          </div>

          {/* Reset Dates Button */}
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="h-10 lg:h-11 w-10 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700 transition-colors shrink-0"
              title="Limpar datas"
            >
              <X size={14} />
            </button>
          )}

          <div className="relative flex-1 min-w-full sm:min-w-0 lg:w-64 z-0 h-10 lg:h-11">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Filtrar..."
              className="input-primary pl-9 py-2.5 text-sm h-full w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Spreadsheet Grid - Desktop Table / Mobile Cards */}
      <div className="overflow-auto flex-1 custom-scrollbar z-0">
        {/* Desktop Table View */}
        <table className="hidden lg:table min-w-full border-collapse text-sm text-left">
          <thead className="bg-gray-800 sticky top-0 z-10 text-xs font-semibold text-gray-400 uppercase tracking-wider shadow-sm">
            <tr>
              <th className="px-4 py-3 border-b border-r border-gray-700 cursor-pointer hover:bg-gray-700 w-32" onClick={() => handleSort('date')}>
                Data {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 border-b border-r border-gray-700 cursor-pointer hover:bg-gray-700" onClick={() => handleSort('description')}>
                Descrição {sortField === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 border-b border-r border-gray-700 cursor-pointer hover:bg-gray-700 w-48" onClick={() => handleSort('category')}>
                Categoria {sortField === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 border-b border-r border-gray-700 cursor-pointer hover:bg-gray-700 w-32 text-right" onClick={() => handleSort('amount')}>
                Valor {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 border-b border-r border-gray-700 w-24 text-center">
                Status
              </th>
              <th className="px-4 py-3 border-b border-gray-700 w-24 text-center">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-900">
            {filteredTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-gray-800/50 transition-colors group">
                <td className="px-4 py-2 border-r border-gray-800 whitespace-nowrap text-gray-400 font-mono text-xs">
                  {formatDate(t.date)}
                </td>
                <td className="px-4 py-2 border-r border-gray-800 text-gray-200 font-medium">
                  <div className="flex items-center gap-2">
                    <span>{t.description}</span>
                    {t.importSource === 'pluggy' && t.needsApproval && (
                      <span className="px-2 py-0.5 text-[10px] uppercase rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50">
                        revisar
                      </span>
                    )}
                    {t.ignored && (
                      <span className="px-2 py-0.5 text-[10px] uppercase rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                        ignorado
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 border-r border-gray-800 text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">
                      {getCategoryIcon(t.category || "Outros", 14)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-gray-800 text-xs border border-gray-700">
                      {t.category || "Outros"}
                    </span>
                  </div>
                </td>
                <td className={`px-4 py-2 border-r border-gray-800 text-right font-mono font-medium ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                  {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                </td>
                <td className="px-4 py-2 border-r border-gray-800 text-center">
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-bold ${t.status === 'completed' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                    {t.status === 'completed' ? 'Pago' : 'Pendente'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onUpdate({ ...t, status: 'completed', needsApproval: false, ignored: false })}
                      className="text-green-400 hover:text-green-300 px-2 py-1 text-[11px] border border-green-600/40 rounded"
                      title="Incluir na receita"
                    >
                      Manter
                    </button>
                    <button
                      onClick={() => onUpdate({ ...t, needsApproval: false, ignored: true })}
                      className="text-gray-400 hover:text-gray-200 px-2 py-1 text-[11px] border border-gray-700 rounded"
                      title="Desconsiderar este lançamento"
                    >
                      Ignorar
                    </button>
                    <button
                      onClick={() => handleEditClick(t)}
                      className="text-gray-500 hover:text-blue-400 p-1 rounded hover:bg-blue-900/20 transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(t.id)}
                      className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-900/20 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Nenhuma transação encontrada no período selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile Card View */}
        <div className="lg:hidden p-3 space-y-3">
          {filteredTransactions.map((t) => (
            <div key={t.id} className="bg-gray-950 rounded-xl border border-gray-800 p-4 relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${t.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`}></div>

              <div className="flex justify-between items-start mb-3 pl-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-200 text-sm mb-1 truncate">{t.description}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      {getCategoryIcon(t.category || "Outros", 12)}
                      {t.category}
                    </span>
                    <span>•</span>
                    <span className="font-mono">{formatDate(t.date)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleEditClick(t)}
                    className="text-gray-600 hover:text-blue-400 p-1.5 rounded hover:bg-blue-900/20 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteId(t.id)}
                    className="text-gray-600 hover:text-red-400 p-1.5 rounded hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center pl-2">
                <span className={`text-lg font-bold font-mono ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                  {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                </span>
                <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full font-bold ${t.status === 'completed' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                  {t.status === 'completed' ? 'Pago' : 'Pendente'}
                </span>
              </div>
            </div>
          ))}

          {filteredTransactions.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              Nenhuma transação encontrada no período selecionado.
            </div>
          )}
        </div>
      </div>

      {/* Excel-like footer summary */}
      <div className="bg-gray-900 border-t border-gray-800 px-3 lg:px-4 py-2 text-xs text-gray-500 flex flex-col sm:flex-row justify-between gap-2">
        <div>Total: {filteredTransactions.length}</div>
        <div className="font-mono">Soma: {formatCurrency(filteredTransactions.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0))}</div>
      </div>

      {/* Delete Confirmation Card (Bottom Centered) */}
      <ConfirmationCard
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && onDelete(deleteId)}
        title="Remover Transação?"
        description="Você está prestes a apagar este registro. Esta ação pode ser desfeita."
        isDestructive={true}
        confirmText="Sim, remover"
        cancelText="Cancelar"
      />

      {/* Edit Transaction Modal */}
      {isEditVisible && editTransaction && createPortal(
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out ${isEditAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}
        >
          <div
            className={`bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-visible border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isEditAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}
          >
            {/* Background Effects */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
            </div>

            {/* Header */}
            <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Edit2 size={20} className="text-[#d97757]" />
                Editar Lançamento
              </h3>
              <button onClick={handleCloseEdit} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 relative z-10">

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Descrição</label>
                <input
                  type="text"
                  value={editTransaction.description}
                  onChange={(e) => setEditTransaction({ ...editTransaction, description: e.target.value })}
                  className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-gray-100 transition-all"
                  placeholder="Ex: Salário"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500 font-bold text-lg">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editTransaction.amount.toString().replace('.', ',')}
                    onChange={(e) => {
                      const val = e.target.value.replace(',', '.');
                      const parsed = parseFloat(val);
                      setEditTransaction({ ...editTransaction, amount: isNaN(parsed) ? 0 : parsed });
                    }}
                    className="w-full p-3 pl-10 bg-gray-900/50 border border-gray-700 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-gray-100 text-lg font-bold transition-all"
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Data</label>
                <input
                  type="date"
                  value={editTransaction.date}
                  onChange={(e) => setEditTransaction({ ...editTransaction, date: e.target.value })}
                  className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-gray-100 transition-all"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Categoria</label>
                <select
                  value={editTransaction.category}
                  onChange={(e) => setEditTransaction({ ...editTransaction, category: e.target.value })}
                  className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] text-gray-100 transition-all"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Tipo</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditTransaction({ ...editTransaction, type: 'income' })}
                    className={`p-3 rounded-xl border font-medium text-center transition-all ${editTransaction.type === 'income' ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-900/20' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                  >
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTransaction({ ...editTransaction, type: 'expense' })}
                    className={`p-3 rounded-xl border font-medium text-center transition-all ${editTransaction.type === 'expense' ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/20' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                  >
                    Despesa
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Status</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditTransaction({ ...editTransaction, status: 'completed' })}
                    className={`p-3 rounded-xl border font-medium text-center transition-all ${editTransaction.status === 'completed' ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-900/20' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                  >
                    Pago
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTransaction({ ...editTransaction, status: 'pending' })}
                    className={`p-3 rounded-xl border font-medium text-center transition-all ${editTransaction.status === 'pending' ? 'bg-yellow-600 border-yellow-600 text-white shadow-lg shadow-yellow-900/20' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                  >
                    Pendente
                  </button>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-800/50 flex gap-3 relative z-10">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="flex-1 py-3 bg-gray-800/50 hover:bg-gray-700 text-white rounded-xl font-bold transition-all border border-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
