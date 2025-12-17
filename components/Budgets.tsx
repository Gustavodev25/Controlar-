import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit2, AlertTriangle, Target, X, Check, Tag, DollarSign, MathMaxMin } from './Icons';
import { Budget, Transaction, Member } from '../types';
import * as dbService from '../services/database';
import { useToasts } from './Toast';
import { CustomAutocomplete } from './UIComponents';
import { ConfirmationBar } from './ConfirmationBar';
import { EmptyState } from './EmptyState';
import NumberFlow from '@number-flow/react';
import { getCurrentLocalMonth } from '../utils/dateUtils';

interface BudgetsProps {
    userId: string;
    transactions: Transaction[];
    members: Member[];
    activeMemberId: string;
    budgets: Budget[];
    userPlan?: 'starter' | 'pro' | 'family';
}

export const Budgets: React.FC<BudgetsProps> = ({ userId, transactions, members, activeMemberId, budgets, userPlan = 'starter' }) => {
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const toast = useToasts();

    // Form State
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [limitAmount, setLimitAmount] = useState('');
    const [alertThreshold, setAlertThreshold] = useState('80');

    // Modal Animation Logic
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isModalOpen) {
            setIsVisible(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });
        } else {
            setIsAnimating(false);
            timeoutId = setTimeout(() => {
                setIsVisible(false);
            }, 300);
        }
        return () => clearTimeout(timeoutId);
    }, [isModalOpen]);

    const isLimitReached = userPlan === 'starter' && budgets.length >= 2;

    const handleOpenModal = (budget?: Budget) => {
        if (!budget && isLimitReached) {
            toast.error("Plano Starter limitado a 2 metas. Faça upgrade para criar mais.");
            return;
        }

        if (budget) {
            setEditingBudget(budget);
            setName(budget.name || '');
            setCategory(budget.category);
            setLimitAmount(budget.limitAmount.toString());
            setAlertThreshold(budget.alertThreshold.toString());
        } else {
            setEditingBudget(null);
            setName('');
            setCategory('');
            setLimitAmount('');
            setAlertThreshold('80');
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!category || !limitAmount) {
            toast.error("Preencha todos os campos.");
            return;
        }

        const budgetData: Omit<Budget, 'id'> = {
            name: name || undefined,
            category,
            limitAmount: parseFloat(limitAmount),
            month: 'recurring', // MVP: Recurring only for now
            alertThreshold: parseInt(alertThreshold),
            memberId: activeMemberId === 'FAMILY_OVERVIEW' ? undefined : activeMemberId
        };

        try {
            if (editingBudget) {
                await dbService.updateBudget(userId, { ...budgetData, id: editingBudget.id });
                toast.success("Meta atualizada!");
            } else {
                await dbService.addBudget(userId, budgetData);
                toast.success("Meta criada!");
            }
            handleCloseModal();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar meta.");
        }
    };

    const handleDelete = async () => {
        if (deleteId) {
            await dbService.deleteBudget(userId, deleteId);
            toast.success("Meta removida.");
            setDeleteId(null);
        }
    };

    // Calculate Progress
    const budgetProgress = useMemo(() => {
        const currentMonth = getCurrentLocalMonth(); // YYYY-MM

        return budgets.map(budget => {
            const relevantTransactions = transactions.filter(t => {
                const isSameCategory = t.category === budget.category;
                const isExpense = t.type === 'expense';
                const isCurrentMonth = t.date.startsWith(currentMonth);

                let isMemberMatch = true;
                if (activeMemberId !== 'FAMILY_OVERVIEW') {
                    isMemberMatch = t.memberId === activeMemberId;
                } else if (budget.memberId) {
                    isMemberMatch = t.memberId === budget.memberId;
                }

                return isSameCategory && isExpense && isCurrentMonth && isMemberMatch;
            });

            const spent = relevantTransactions.reduce((acc, t) => acc + t.amount, 0);
            const percentage = Math.min((spent / budget.limitAmount) * 100, 100);

            return {
                ...budget,
                spent,
                percentage
            };
        });
    }, [budgets, transactions, activeMemberId]);

    // Filter budgets based on active view
    const filteredBudgets = useMemo(() => {
        if (activeMemberId === 'FAMILY_OVERVIEW') return budgetProgress;
        return budgetProgress.filter(b => !b.memberId || b.memberId === activeMemberId);
    }, [budgetProgress, activeMemberId]);

    const getProgressBarColor = (percentage: number) => {
        if (percentage < 70) return 'bg-green-500';
        if (percentage < 90) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    // Extract unique categories from transactions for autocomplete/select
    const availableCategories = useMemo(() => {
        const cats = new Set(transactions.map(t => t.category));
        return Array.from(cats).sort();
    }, [transactions]);

    return (
        <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Metas Mensais</h2>
                    <p className="text-gray-400 text-sm">Acompanhe seus gastos por categoria.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    disabled={isLimitReached}
                    className={`
                        px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-lg
                        ${isLimitReached
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed shadow-none'
                            : 'bg-[#d97757] hover:bg-[#c56a4d] text-white shadow-[#d97757]/20'
                        }
                    `}
                >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Nova Meta</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredBudgets.map(budget => (
                    <div key={budget.id} className="bg-[#30302E] border border-[#373734] rounded-2xl p-5 hover:border-[#4a4a47] transition-all group relative overflow-hidden">
                        {/* Background Progress Bar (Subtle) */}
                        <div
                            className={`absolute bottom-0 left-0 h-1 transition-all duration-500 ${getProgressBarColor(budget.percentage)}`}
                            style={{ width: `${budget.percentage}%` }}
                        ></div>

                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#272725] border border-[#373734] rounded-xl text-gray-300">
                                    <MathMaxMin size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{budget.name || budget.category}</h3>
                                    <div className="flex flex-col">
                                        {budget.name && (
                                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{budget.category}</span>
                                        )}
                                        <p className="text-xs text-gray-500">
                                            {budget.memberId ? members.find(m => m.id === budget.memberId)?.name : 'Geral'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleOpenModal(budget)}
                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-[#373734] rounded-lg transition-colors"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    onClick={() => setDeleteId(budget.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#373734] rounded-lg transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Gasto: <span className="text-white font-medium"><NumberFlow value={budget.spent} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" /></span></span>
                                <span className="text-gray-400">Limite: <span className="text-white font-medium"><NumberFlow value={budget.limitAmount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" /></span></span>
                            </div>

                            <div className="h-2 bg-[#272725] rounded-full overflow-hidden border border-[#373734]">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(budget.percentage)}`}
                                    style={{ width: `${budget.percentage}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-between items-center text-xs mt-1">
                                <span className={`${budget.percentage > 100 ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                                    <NumberFlow value={budget.percentage} format={{ maximumFractionDigits: 0 }} />% utilizado
                                </span>
                                {budget.percentage >= budget.alertThreshold && budget.percentage < 100 && (
                                    <span className="flex items-center gap-1 text-yellow-500">
                                        <AlertTriangle size={10} />
                                        Atenção
                                    </span>
                                )}
                                {budget.percentage >= 100 && (
                                    <span className="flex items-center gap-1 text-red-500">
                                        <AlertTriangle size={10} />
                                        Excedido
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {filteredBudgets.length === 0 && (
                    <div className="col-span-full">
                        <EmptyState
                            title="Nenhuma meta definida"
                            description="Crie metas para acompanhar seus gastos por categoria e manter suas finanças organizadas."
                        />
                    </div>
                )}
            </div>

            {/* New Modal Implementation */}
            {isVisible && createPortal(
                <div
                    className={`
                fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
            `}
                >
                    <div
                        className={`
                bg-[#30302E] rounded-2xl shadow-2xl w-full max-w-lg overflow-visible border border-[#373734] flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
            `}
                    >
                        {/* Background Glow */}
                        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-15 bg-[#d97757]" />

                        {/* Header */}
                        <div className="px-4 py-3 border-b border-[#373734]/50 flex justify-between items-center relative z-10">
                            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                                <MathMaxMin className="text-[#d97757]" size={16} />
                                {editingBudget ? 'Editar Meta' : 'Nova Meta'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-500 hover:text-white p-1.5 hover:bg-[#373734]/50 rounded-md transition-all">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4 overflow-y-visible custom-scrollbar relative z-10">
                            <form onSubmit={handleSave} className="space-y-4 animate-fade-in">

                                {/* Name (Optional) */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Nome da Meta (Opcional)</label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-[#272725]/40 border border-[#373734]/60 rounded-lg text-white px-4 py-2.5 text-[13px] focus:border-[#4a4a47] focus:bg-[#272725]/60 outline-none transition-all placeholder-gray-600"
                                            placeholder="Ex: Viagem para Paris, Carro Novo..."
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* Category */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Categoria</label>
                                    <div className="relative z-20 group">
                                        <CustomAutocomplete
                                            value={category}
                                            onChange={setCategory}
                                            options={availableCategories}
                                            icon={<Tag size={16} />}
                                            placeholder="Ex: Alimentação, Lazer..."
                                        />
                                    </div>
                                </div>

                                {/* Limit Amount */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Limite Mensal (R$)</label>
                                    <div className="relative group">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">R$</span>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            value={limitAmount}
                                            onChange={(e) => setLimitAmount(e.target.value)}
                                            className="w-full bg-[#272725]/40 border border-[#373734]/60 rounded-lg text-white pl-9 pr-4 py-2.5 text-[13px] focus:border-[#4a4a47] focus:bg-[#272725]/60 outline-none transition-all placeholder-gray-600 font-mono"
                                            placeholder="0,00"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* Alert Threshold */}
                                <div className="bg-[#272725]/50 p-4 rounded-xl border border-[#373734]/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-gray-300 font-medium text-sm">
                                            <AlertTriangle size={16} className="text-yellow-500" />
                                            Alerta de Consumo
                                        </div>
                                        <span className="text-[#d97757] font-bold font-mono">{alertThreshold}%</span>
                                    </div>

                                    <input
                                        type="range"
                                        min="50"
                                        max="100"
                                        step="5"
                                        value={alertThreshold}
                                        onChange={(e) => setAlertThreshold(e.target.value)}
                                        className="w-full h-2 bg-[#373734] rounded-lg appearance-none cursor-pointer accent-[#d97757]"
                                    />
                                    <p className="text-[10px] text-gray-500">
                                        Você será avisado visualmente quando atingir esta porcentagem do limite.
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="w-full py-4 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/30 flex items-center justify-center gap-2"
                                    >
                                        <Check size={18} />
                                        Salvar Meta
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <ConfirmationBar
                isOpen={!!deleteId}
                onCancel={() => setDeleteId(null)}
                onConfirm={handleDelete}
                label="Excluir Meta?"
                confirmText="Sim, excluir"
                cancelText="Cancelar"
                isDestructive={true}
            />
        </div>
    );
};
