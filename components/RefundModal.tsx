import React, { useState, useEffect } from 'react';
import { UniversalModal } from './UniversalModal';
import { Button } from './Button';
import { Undo2, DollarSign, Calculator } from 'lucide-react';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/currency';

interface RefundModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
    onConfirm: (amount: number) => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({
    isOpen,
    onClose,
    transaction,
    onConfirm
}) => {
    const [amount, setAmount] = useState<number>(0);
    const [mode, setMode] = useState<'total' | 'partial'>('total');

    useEffect(() => {
        if (isOpen && transaction) {
            // Default to total amount (absolute value, as expenses are usually negative)
            setAmount(Math.abs(transaction.amount));
            setMode('total');
        }
    }, [isOpen, transaction]);

    const handleSubmit = () => {
        if (amount > 0) {
            onConfirm(amount);
            onClose();
        }
    };

    if (!transaction) return null;

    const originalAmount = Math.abs(transaction.amount);

    return (
        <UniversalModal
            isOpen={isOpen}
            onClose={onClose}
            title="Lançar Estorno"
            icon={<Undo2 size={18} />}
            themeColor="#10b981" // Green for refund/credit
            footer={
                <div className="flex gap-3 w-full">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white border-none"
                        onClick={handleSubmit}
                        disabled={amount <= 0}
                    >
                        Confirmar Estorno
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800/60">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Transação Original</h3>
                    <div className="flex items-center justify-between">
                        <span className="text-gray-300 font-medium">{transaction.description}</span>
                        <span className="text-gray-200 font-mono font-bold">{formatCurrency(Math.abs(transaction.amount))}</span>
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500">
                        {new Date(transaction.date).toLocaleDateString()} • {transaction.category}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Valor do Estorno</label>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <button
                            type="button"
                            onClick={() => {
                                setMode('total');
                                setAmount(originalAmount);
                            }}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${mode === 'total'
                                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                    : 'bg-gray-900/40 border-gray-800/60 text-gray-400 hover:border-gray-700'
                                }`}
                        >
                            <div className="mb-1"><Undo2 size={18} /></div>
                            <span className="text-xs font-bold">Total</span>
                            <span className="text-[10px] opacity-70 mt-0.5">Estornar tudo</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setMode('partial');
                                setAmount(0); // Reset or keep? Maybe better to start at 0 or original?
                                // If switching to partial, user typically wants to type. 
                                // Let's keep it 0 or previous if valid. 
                                if (amount === originalAmount) setAmount(0);
                            }}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${mode === 'partial'
                                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                                    : 'bg-gray-900/40 border-gray-800/60 text-gray-400 hover:border-gray-700'
                                }`}
                        >
                            <div className="mb-1"><Calculator size={18} /></div>
                            <span className="text-xs font-bold">Parcial</span>
                            <span className="text-[10px] opacity-70 mt-0.5">Digitar valor</span>
                        </button>
                    </div>

                    <div className="relative">
                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                        <input
                            type="text"
                            inputMode="numeric"
                            value={amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount) : ''}
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                const numberValue = Number(value) / 100;
                                setAmount(numberValue);
                                if (numberValue !== originalAmount) setMode('partial');
                                else setMode('total');
                            }}
                            className="w-full bg-gray-900/80 border border-gray-700 rounded-xl text-white pl-10 pr-4 py-4 text-lg font-mono font-bold focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder-gray-600"
                            placeholder="R$ 0,00"
                        />
                    </div>

                    {amount > originalAmount && (
                        <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                            <span className="shrink-0">⚠️</span>
                            <p>O valor do estorno é maior que a compra original.</p>
                        </div>
                    )}
                </div>
            </div>
        </UniversalModal>
    );
};
