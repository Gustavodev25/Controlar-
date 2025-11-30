import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Transaction } from '../types';
import { X, Check, DollarSign, Calendar, Tag } from './Icons';
import { CheckSquare, Square } from 'lucide-react';

interface ImportReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (transactions: Omit<Transaction, 'id'>[]) => void;
  transactions: Omit<Transaction, 'id'>[];
  accountName?: string;
}

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  // dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

export const ImportReviewModal: React.FC<ImportReviewModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  transactions,
  accountName
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Reset selection when opening with new transactions
  useEffect(() => {
    if (isOpen) {
        // Select all by default
        const all = new Set(transactions.map((_, i) => i));
        setSelectedIndices(all);
        
        setIsVisible(true);
        requestAnimationFrame(() => setIsAnimating(true));
    } else {
        setIsAnimating(false);
        const timer = setTimeout(() => setIsVisible(false), 300);
        return () => clearTimeout(timer);
    }
  }, [isOpen, transactions]);

  const handleToggle = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedIndices.size === transactions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(transactions.map((_, i) => i)));
    }
  };

  const handleConfirm = () => {
    const selected = transactions.filter((_, i) => selectedIndices.has(i));
    onConfirm(selected);
  };

  if (!isVisible) return null;

  const totalSelected = selectedIndices.size;
  const totalAmount = transactions
    .filter((_, i) => selectedIndices.has(i))
    .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ${isAnimating ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0'}`}>
      <div className={`bg-gray-950 border border-gray-800 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden relative transition-all duration-300 ${isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`}>
        
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 bg-[#d97757]" />

        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center relative z-10 bg-gray-950/80 backdrop-blur-sm">
          <div>
            <h3 className="text-xl font-bold text-white">Revisar Importação</h3>
            <p className="text-sm text-gray-400 mt-1">
              {accountName ? `Transações de ${accountName}` : 'Selecione os itens que deseja salvar'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-500 hover:bg-gray-800 hover:text-white transition-colors border border-transparent hover:border-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 relative z-10" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
           <style>{`
             div::-webkit-scrollbar { display: none; }
           `}</style>
           {transactions.length === 0 ? (
             <div className="text-center py-10 text-gray-500">
               Nenhuma transação nova encontrada.
             </div>
           ) : (
             transactions.map((tx, index) => {
               const isSelected = selectedIndices.has(index);
               const isExpense = tx.type === 'expense';
               
               return (
                 <div 
                    key={index}
                    onClick={() => handleToggle(index)}
                    className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-gray-900 border-gray-700' : 'bg-transparent border-transparent hover:bg-gray-900/50'}`}
                 >
                    <div className={`shrink-0 transition-colors ${isSelected ? 'text-[#d97757]' : 'text-gray-600'}`}>
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isSelected ? 'text-white' : 'text-gray-400'}`}>{tx.description}</p>
                        <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                             <span className="flex items-center gap-1"><Calendar size={10}/> {formatDate(tx.date)}</span>
                             <span className="flex items-center gap-1"><Tag size={10}/> {tx.category}</span>
                        </div>
                    </div>

                    <div className={`font-mono font-bold whitespace-nowrap ${isExpense ? 'text-gray-300' : 'text-emerald-400'} ${!isSelected && 'opacity-50'}`}>
                        {isExpense ? '-' : '+'} {formatCurrency(tx.amount)}
                    </div>
                 </div>
               )
             })
           )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-950/80 backdrop-blur-sm relative z-10">
           <div className="flex justify-between items-center mb-4">
              <button onClick={handleToggleAll} className="text-sm font-bold text-gray-400 hover:text-white flex items-center gap-2 transition-colors">
                 {totalSelected === transactions.length ? <CheckSquare size={18} className="text-[#d97757]"/> : <Square size={18}/>}
                 Selecionar todos
              </button>
              <div className="text-right">
                 <p className="text-[10px] uppercase font-bold text-gray-500">Impacto Total</p>
                 <p className={`font-mono font-bold text-lg ${totalAmount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {totalAmount > 0 ? '+' : ''}{formatCurrency(totalAmount)}
                 </p>
              </div>
           </div>

           <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3.5 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border border-gray-800 hover:border-gray-700">
                Cancelar
              </button>
              <button 
                onClick={handleConfirm}
                disabled={totalSelected === 0}
                className="flex-[2] py-3.5 rounded-xl font-bold bg-[#d97757] hover:bg-[#c56a4d] text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#d97757]/20 transition-all flex items-center justify-center gap-2 border border-[#d97757]/50"
              >
                <Check size={18} strokeWidth={3} />
                Importar {totalSelected} ite{totalSelected !== 1 ? 'ns' : 'm'}
              </button>
           </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
