
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { Trash2, Search, Calendar, getCategoryIcon, X, Filter } from './Icons';
import { CustomSelect, CustomDatePicker, ConfirmationCard } from './UIComponents';

interface ExcelTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

export const ExcelTable: React.FC<ExcelTableProps> = ({ transactions, onDelete }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState<keyof Transaction>('date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  
  // Date Range Filters
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  // Confirmation Card State
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
     if(!dateStr) return '';
     const [y, m, d] = dateStr.split('-');
     return `${d}/${m}/${y}`;
  };

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
              <th className="px-4 py-3 border-b border-gray-700 w-16 text-center">
                Ação
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
                  {t.description}
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
                  <button
                    onClick={() => setDeleteId(t.id)}
                    className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-900/20 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
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
                <button
                  onClick={() => setDeleteId(t.id)}
                  className="text-gray-600 hover:text-red-400 p-1.5 rounded hover:bg-red-900/20 transition-colors ml-2"
                >
                  <Trash2 size={14} />
                </button>
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
    </div>
  );
};
