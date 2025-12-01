import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PiggyBank, ArrowUpCircle, X } from 'lucide-react';
import { Plus, Edit2, Trash2, Check, Target, Calendar, DollarSign, Coins, TrendingUp, Sparkles, TrendingDown, ChevronLeft, ChevronRight } from './Icons';
import { useToasts } from './Toast';
import { ConfirmationCard } from './UIComponents';
import { Transaction, ConnectedAccount } from '../types';
import { EmptyState } from './EmptyState';
import NumberFlow from '@number-flow/react';
import { toLocalISODate, toLocalISOString } from '../utils/dateUtils';

export interface Investment {
  id: string;
  memberId?: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: string;
  deadline?: string;
  isConnected?: boolean;
  institution?: string;
}

interface InvestmentsProps {
  investments: Investment[];
  connectedSavingsAccounts?: ConnectedAccount[];
  onAdd: (investment: Omit<Investment, 'id'>) => void;
  onUpdate: (investment: Investment) => void;
  onDelete: (id: string) => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  userPlan?: 'starter' | 'pro' | 'family';
}

const TEMPLATES = [
  { name: 'Viajar', icon: 'viajar.png', color: 'blue', suggestedAmount: 5000, isImage: true },
  { name: 'Comprar Carro', icon: 'carro.png', color: 'red', suggestedAmount: 50000, isImage: true },
  { name: 'Reserva', icon: 'reserva.png', color: 'green', suggestedAmount: 10000, isImage: true },
  { name: 'Outros', icon: 'reserva.png', color: 'purple', suggestedAmount: 1000, isImage: true },
];

const COLOR_OPTIONS = [
  { value: 'blue', class: 'from-blue-500 to-blue-600', textClass: 'text-blue-400', bgClass: 'bg-blue-900/20' },
  { value: 'green', class: 'from-green-500 to-green-600', textClass: 'text-green-400', bgClass: 'bg-green-900/20' },
  { value: 'purple', class: 'from-purple-500 to-purple-600', textClass: 'text-purple-400', bgClass: 'bg-purple-900/20' },
  { value: 'red', class: 'from-red-500 to-red-600', textClass: 'text-red-400', bgClass: 'bg-red-900/20' },
  { value: 'orange', class: 'from-orange-500 to-orange-600', textClass: 'text-orange-400', bgClass: 'bg-orange-900/20' },
  { value: 'pink', class: 'from-pink-500 to-pink-600', textClass: 'text-pink-400', bgClass: 'bg-pink-900/20' },
  { value: 'indigo', class: 'from-indigo-500 to-indigo-600', textClass: 'text-indigo-400', bgClass: 'bg-indigo-900/20' },
  { value: 'teal', class: 'from-teal-500 to-teal-600', textClass: 'text-teal-400', bgClass: 'bg-teal-900/20' },
];

const getRandomColor = () => {
  const colors = ['blue', 'green', 'purple', 'red', 'orange', 'pink', 'indigo', 'teal'];
  return colors[Math.floor(Math.random() * colors.length)];
};

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const Investments: React.FC<InvestmentsProps> = ({
  investments,
  connectedSavingsAccounts = [],
  onAdd,
  onUpdate,
  onDelete,
  onAddTransaction,
  userPlan = 'starter'
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [modalStep, setModalStep] = useState<'template' | 'form'>('template');
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // Merge connected accounts
  const connectedInvestments: Investment[] = connectedSavingsAccounts.map(acc => ({
    id: acc.id,
    name: acc.name,
    icon: 'reserva.png', // Default icon
    color: 'green',
    targetAmount: 0, // Connected accounts don't have explicit targets here usually
    currentAmount: acc.balance || 0,
    createdAt: acc.lastUpdated || toLocalISOString(),
    isConnected: true,
    institution: acc.institution
  }));

  const allInvestments = [...connectedInvestments, ...investments];

  // Deposit modal
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositInvestment, setDepositInvestment] = useState<Investment | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  const [formData, setFormData] = useState<Omit<Investment, 'id'>>({
    name: '',
    icon: 'reserva.png',
    color: 'blue',
    targetAmount: 0,
    currentAmount: 0,
    createdAt: toLocalISODate(),
    deadline: ''
  });

  const toast = useToasts();

  // Reset para página 1 quando as caixinhas mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [allInvestments.length]);

  // Animation Control (Igual ao Reminders)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isModalOpen || depositModalOpen) {
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
  }, [isModalOpen, depositModalOpen]);


  const isLimitReached = userPlan === 'starter' && investments.length >= 2;

  const handleOpenModal = (investment?: Investment) => {
    if (investment?.isConnected) return; // Cannot edit connected accounts

    if (!investment && isLimitReached) {
        if (toast && toast.error) {
            toast.error("Plano Starter limitado a 2 caixinhas. Faça upgrade para criar mais.");
        } else {
            alert("Plano Starter limitado a 2 caixinhas.");
        }
        return;
    }

    if (investment) {
      setEditingInvestment(investment);
      setFormData({
        name: investment.name,
        icon: investment.icon,
        color: investment.color,
        targetAmount: investment.targetAmount,
        currentAmount: investment.currentAmount,
        createdAt: investment.createdAt,
        deadline: investment.deadline || ''
      });
      setModalStep('form');
    } else {
      setEditingInvestment(null);
      setFormData({
        name: '',
        icon: 'reserva.png',
        color: 'blue',
        targetAmount: 0,
        currentAmount: 0,
        createdAt: toLocalISODate(),
        deadline: ''
      });
      setModalStep('template');
    }
    setIsModalOpen(true);
  };

  const handleSelectTemplate = (template: typeof TEMPLATES[0]) => {
    setFormData({
      ...formData,
      name: template.name === 'Outros' ? '' : template.name,
      icon: template.icon,
      color: getRandomColor(),
      targetAmount: template.suggestedAmount,
    });
    setModalStep('form');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setEditingInvestment(null);
      setModalStep('template');
      setFormData({
        name: '',
        icon: 'reserva.png',
        color: 'blue',
        targetAmount: 0,
        currentAmount: 0,
        createdAt: toLocalISODate(),
        deadline: ''
      });
    }, 300);
  };

  const handleSave = () => {
    if (!formData.name || formData.targetAmount <= 0) {
      toast.error("Preencha o nome e a meta.");
      return;
    }

    if (editingInvestment) {
      onUpdate({ ...editingInvestment, ...formData });
      toast.success("Caixinha atualizada!");
    } else {
      onAdd(formData);
      toast.success("Caixinha criada!");
    }
    handleCloseModal();
  };

  const handleOpenDeposit = (investment: Investment) => {
    if (investment.isConnected) return; // Disable manual deposit for connected accounts
    setDepositInvestment(investment);
    setDepositAmount('');
    setDepositModalOpen(true);
  };

  const handleDeposit = () => {
    if (!depositInvestment) return;
    const amount = parseFloat(depositAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Insira um valor válido.");
      return;
    }

    const newAmount = depositInvestment.currentAmount + amount;
    onUpdate({
      ...depositInvestment,
      currentAmount: Math.min(newAmount, depositInvestment.targetAmount)
    });

    onAddTransaction({
      date: toLocalISODate(),
      description: `Depósito em ${depositInvestment.name}`,
      amount: amount,
      category: `Caixinha - ${depositInvestment.name}`,
      type: 'expense',
      status: 'completed',
      memberId: depositInvestment.memberId,
      isInvestment: true
    });

    toast.success(`R$ ${amount.toFixed(2)} depositado!`);
    setDepositModalOpen(false);
    setDepositInvestment(null);
    setDepositAmount('');
  };

  const handleWithdraw = () => {
    if (!depositInvestment) return;
    const amount = parseFloat(depositAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Insira um valor válido.");
      return;
    }

    const newAmount = depositInvestment.currentAmount - amount;
    if (newAmount < 0) {
      toast.error("Saldo insuficiente na caixinha.");
      return;
    }

    onUpdate({
      ...depositInvestment,
      currentAmount: newAmount
    });

    onAddTransaction({
      date: toLocalISODate(),
      description: `Retirada de ${depositInvestment.name}`,
      amount: amount,
      category: `Caixinha - ${depositInvestment.name}`,
      type: 'income',
      status: 'completed',
      memberId: depositInvestment.memberId,
      isInvestment: true
    });

    toast.success(`R$ ${amount.toFixed(2)} retirado!`);
    setDepositModalOpen(false);
    setDepositInvestment(null);
    setDepositAmount('');
  };

  const getColorClass = (color: string) => {
    return COLOR_OPTIONS.find(c => c.value === color) || COLOR_OPTIONS[0];
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage < 70) return 'bg-emerald-500';
    if (percentage < 90) return 'bg-amber-500';
    return 'bg-red-500'; // Ou verde escuro, dependendo da lógica visual
  };

  const totalSaved = allInvestments.reduce((sum, inv) => sum + inv.currentAmount, 0);
  const totalTarget = allInvestments.reduce((sum, inv) => sum + inv.targetAmount, 0);
  
  // Variáveis para o modal de depósito
  const depositProgress = depositInvestment && depositInvestment.targetAmount > 0
    ? (depositInvestment.currentAmount / depositInvestment.targetAmount) * 100
    : 0;

  return (
    <div className="space-y-8 animate-fade-in font-sans pb-10 flex flex-col h-full">
      
      {/* HEADER PADRONIZADO (Igual Reminders) */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Caixinhas</h2>
          <p className="text-gray-400 text-sm mt-1">Organize seus sonhos e metas</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          disabled={isLimitReached}
          className={`
            px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg
            ${isLimitReached
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed shadow-none border border-gray-800'
              : 'bg-[#d97757] hover:bg-[#c56a4d] text-white shadow-[#d97757]/20 hover:shadow-[#d97757]/40 hover:-translate-y-0.5 border border-[#d97757]/50'
            }
          `}
        >
          <Plus size={20} strokeWidth={2.5} />
          <span className="hidden sm:inline font-bold text-sm">Nova Caixinha</span>
        </button>
      </div>

      {/* QUICK STATS CARDS - VISUAL IGUAL REMINDERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card Total Guardado */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 flex flex-col justify-between">
           <div className="flex justify-between items-start mb-3">
               <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-emerald-500">
                        <Coins size={20} />
                    </div>
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Guardado</span>
               </div>
           </div>
           <div>
              <p className="text-3xl font-bold text-white tracking-tight">
                <NumberFlow value={totalSaved} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
              </p>
              <p className="text-xs text-gray-500 mt-1">Saldo acumulado em todas as metas</p>
           </div>
        </div>

        {/* Card Meta Total */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 flex flex-col justify-between">
           <div className="flex justify-between items-start mb-3">
               <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-blue-500">
                        <Target size={20} />
                    </div>
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Meta Total</span>
               </div>
           </div>
           <div>
              <p className="text-3xl font-bold text-white tracking-tight">
                <NumberFlow value={totalTarget} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
              </p>
              <p className="text-xs text-gray-500 mt-1">Objetivo financeiro global</p>
           </div>
        </div>
      </div>

      {/* Lista de Caixinhas */}
      <div className="flex-1">
        {allInvestments.length === 0 ? (
          <EmptyState
            title="Nenhuma caixinha criada"
            description="Crie caixinhas para organizar e acompanhar seus objetivos financeiros de forma visual e prática."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {(() => {
                const totalPages = Math.ceil(allInvestments.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedInvestments = allInvestments.slice(startIndex, endIndex);

                return paginatedInvestments.map((investment) => {
              const progress = investment.targetAmount > 0
                ? (investment.currentAmount / investment.targetAmount) * 100
                : 0;
              const colorClass = getColorClass(investment.color);
              const isComplete = progress >= 100 && investment.targetAmount > 0;
              const remainingAmount = Math.max(investment.targetAmount - investment.currentAmount, 0);

              return (
                <div
                  key={investment.id}
                  className="bg-gray-950 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-200 group relative shadow-lg shadow-black/20 overflow-hidden"
                >
                  {/* Luz de fundo decorativa suave */}
                  <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none ${colorClass.bgClass.replace('/20', '')}`}></div>

                  {/* Connected/Complete badge */}
                  <div className="absolute -top-0 -right-0 flex flex-col items-end">
                      {investment.isConnected && (
                        <div className="bg-blue-500/10 border-l border-b border-blue-500/20 text-blue-400 text-[10px] font-bold px-3 py-1.5 rounded-bl-xl flex items-center gap-1 z-10 uppercase tracking-wide mb-1">
                          <Sparkles size={10} />
                          Conectado
                        </div>
                      )}
                      {isComplete && !investment.isConnected && (
                        <div className="bg-emerald-500/10 border-l border-b border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-bl-xl flex items-center gap-1 z-10 uppercase tracking-wide">
                          <Sparkles size={10} />
                          Completo
                        </div>
                      )}
                  </div>

                  <div className="flex justify-between items-start mb-5 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gray-900 border border-gray-800 shadow-inner">
                        {investment.icon.includes('.png') ? (
                          <img
                            src={`/assets/${investment.icon}`}
                            alt={investment.name}
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <span className="text-3xl">{investment.icon}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-100 text-lg leading-tight truncate max-w-[150px]">{investment.name}</h3>
                        {investment.isConnected ? (
                             <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-mono">
                                {investment.institution}
                             </p>
                        ) : (
                            investment.deadline && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-mono">
                                <Calendar size={12} />
                                {new Date(investment.deadline).toLocaleDateString('pt-BR')}
                            </p>
                            )
                        )}
                      </div>
                    </div>
                    
                    {/* Actions (Style from Reminders) */}
                    {!investment.isConnected && (
                        <div className="flex gap-1">
                        <button
                            onClick={() => handleOpenModal(investment)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-500 hover:text-white border border-gray-800 hover:border-gray-700 transition-all"
                            title="Editar"
                        >
                            <Edit2 size={14} />
                        </button>
                        <button
                            onClick={() => setDeleteId(investment.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-900 hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-gray-800 hover:border-red-500/30 transition-all"
                            title="Excluir"
                        >
                            <Trash2 size={14} />
                        </button>
                        </div>
                    )}
                  </div>

                  <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Guardado</p>
                        <p className={`text-xl font-mono font-bold ${isComplete ? 'text-emerald-400' : 'text-white'}`}>
                            <NumberFlow value={investment.currentAmount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                        </p>
                      </div>
                      {!investment.isConnected && (
                        <div className="text-right">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Meta</p>
                            <p className="text-sm font-mono text-gray-400">
                                <NumberFlow value={investment.targetAmount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                            </p>
                        </div>
                      )}
                    </div>

                    {!investment.isConnected && (
                        <>
                            <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800/50">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-[#d97757]'}`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                            ></div>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                            <span className={`${isComplete ? 'text-emerald-400 font-bold' : 'text-gray-500'}`}>
                                <NumberFlow value={Math.min(progress, 100)} format={{ maximumFractionDigits: 0 }} />% alcançado
                            </span>
                            {!isComplete && (
                                <span className="font-mono text-gray-400">
                                Falta <NumberFlow value={remainingAmount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                                </span>
                            )}
                            </div>
                        </>
                    )}

                    <button
                      onClick={() => handleOpenDeposit(investment)}
                      disabled={investment.isConnected}
                      className={`w-full py-3 rounded-xl font-medium transition-all border flex items-center justify-center gap-2 group/btn
                        ${investment.isConnected 
                             ? 'bg-gray-900 text-gray-600 border-gray-800 cursor-default' 
                             : 'bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border-gray-800 hover:border-gray-700'
                        }
                      `}
                    >
                      <ArrowUpCircle size={16} className={investment.isConnected ? 'text-gray-600' : 'text-[#d97757] group-hover/btn:text-white transition-colors'} />
                      <span className="text-xs font-bold uppercase tracking-wider">
                          {investment.isConnected ? 'Saldo Sincronizado' : 'Depositar / Retirar'}
                      </span>
                    </button>
                  </div>
                </div>
              );
                });
              })()}
            </div>

            {/* Controles de Paginação */}
            {(() => {
              const totalPages = Math.ceil(allInvestments.length / itemsPerPage);

              if (totalPages <= 1) return null;

              return (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`p-2.5 rounded-xl transition-all border ${
                      currentPage === 1
                        ? 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed'
                        : 'bg-gray-900 hover:bg-gray-800 text-white border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <span className="text-sm text-gray-400 font-medium">
                    Página <span className="text-white font-bold">{currentPage}</span> de <span className="text-white font-bold">{totalPages}</span>
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`p-2.5 rounded-xl transition-all border ${
                      currentPage === totalPages
                        ? 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed'
                        : 'bg-gray-900 hover:bg-gray-800 text-white border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Create/Edit Modal - VISUAL IGUAL REMINDERS */}

      {isVisible && isModalOpen && createPortal(
        <div className={`
            fixed inset-0 z-[9999] flex items-center justify-center p-4 
            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
            ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
        `}>
          <div className={`
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-800 
                flex flex-col max-h-[90vh] relative 
                transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20"></div>

            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-center relative z-10 bg-gray-950/80 backdrop-blur-sm">
              <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                <div className="p-2 bg-[#d97757]/10 rounded-lg text-[#d97757]">
                    <PiggyBank size={20} />
                </div>
                {editingInvestment ? 'Editar Caixinha' : 'Nova Caixinha'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-xl border border-transparent hover:border-gray-700 transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar relative z-10">
              {modalStep === 'template' && !editingInvestment ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="text-center mb-2">
                    <h4 className="text-2xl font-bold text-white mb-2">
                      Escolha um modelo
                    </h4>
                    <p className="text-sm text-gray-500">Comece rapidamente com uma sugestão</p>
                  </div>

                  {/* Templates Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {TEMPLATES.map((template) => {
                      const colorClass = getColorClass(template.color);
                      return (
                        <button
                          key={template.name}
                          onClick={() => handleSelectTemplate(template)}
                          className="p-5 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-[#d97757]/50 hover:bg-gray-900 transition-all duration-300 group text-center relative overflow-hidden"
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${colorClass.class} opacity-0 group-hover:opacity-5 transition-all duration-500`}></div>

                          <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="mb-1 transform group-hover:scale-110 transition-transform duration-300">
                              <img
                                src={`/assets/${template.icon}`}
                                alt={template.name}
                                className="w-16 h-16 object-contain"
                              />
                            </div>
                            <div>
                              <p className="text-base font-bold text-gray-200 group-hover:text-white">
                                {template.name}
                              </p>
                              <p className="text-xs font-mono text-gray-500 mt-1">
                                Meta: <NumberFlow value={template.suggestedAmount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-5 animate-slide-up">
                  {/* Icon Preview and Name */}
                  <div className="flex items-start gap-4 bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
                    {/* Icon Preview */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gray-950 border border-gray-800 rounded-xl flex items-center justify-center shadow-inner">
                        {formData.icon.includes('.png') ? (
                          <img
                            src={`/assets/${formData.icon}`}
                            alt="Ícone"
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <span className="text-3xl">{formData.icon}</span>
                        )}
                      </div>
                    </div>

                    {/* Name */}
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Nome da Caixinha</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl text-white px-4 py-3 text-sm focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 outline-none transition-all font-bold"
                        placeholder="Ex: Viagem para Europa"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      {/* Target Amount */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Meta (R$)</label>
                        <div className="relative group">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
                            <input
                                type="text"
                                inputMode="decimal"
                                value={formData.targetAmount > 0 ? formData.targetAmount.toString().replace('.', ',') : ''}
                                onChange={(e) => {
                                const val = e.target.value.replace(',', '.');
                                const parsed = parseFloat(val);
                                setFormData({ ...formData, targetAmount: isNaN(parsed) ? 0 : parsed });
                                }}
                                className="w-full bg-gray-900/50 border border-gray-800 rounded-xl text-white pl-12 pr-4 py-3.5 text-sm focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 outline-none transition-all font-mono"
                                placeholder="0,00"
                            />
                        </div>
                      </div>

                      {/* Deadline */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Prazo <span className="text-gray-600 font-normal lowercase">(opcional)</span></label>
                        <div className="relative group">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={18} />
                            <input
                                type="date"
                                value={formData.deadline}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                className="w-full bg-gray-900/50 border border-gray-800 rounded-xl text-white pl-12 pr-4 py-3.5 text-sm focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 outline-none transition-all"
                            />
                        </div>
                      </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {modalStep === 'form' && (
              <div className="p-6 border-t border-gray-800 flex gap-3 relative z-10 bg-gray-950/50">
                <button
                  type="button"
                  onClick={() => editingInvestment ? handleCloseModal() : setModalStep('template')}
                  className="flex-1 py-3.5 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl font-bold transition-all border border-gray-800 hover:border-gray-700"
                >
                  {editingInvestment ? 'Cancelar' : 'Voltar'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-[2] py-3.5 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 border border-[#d97757]/50 flex items-center justify-center gap-2"
                >
                  <Check size={18} strokeWidth={3} />
                  {editingInvestment ? 'Salvar Alterações' : 'Criar Caixinha'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Deposit/Withdraw Modal - VISUAL IGUAL REMINDERS */}
      {isVisible && depositModalOpen && depositInvestment && createPortal(
        <div className={`
            fixed inset-0 z-[9999] flex items-center justify-center p-4 
            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
            ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
        `}>
          <div className={`
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800 
                flex flex-col relative 
                transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#d97757]/10 rounded-full blur-3xl -mr-12 -mt-12"></div>
            </div>

            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex justify-between items-center relative z-10 bg-gray-950/80 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#d97757]/15 text-[#d97757] border border-[#d97757]/30 shadow-inner">
                  <ArrowUpCircle size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Gerenciar Saldo</p>
                  <h3 className="text-lg font-bold text-white">{depositInvestment.name}</h3>
                </div>
              </div>
              <button
                onClick={() => {
                  setDepositModalOpen(false);
                  setDepositInvestment(null);
                  setDepositAmount('');
                }}
                className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-xl border border-transparent hover:border-gray-700 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 relative z-10">
              {/* Infos Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-bold">Saldo Atual</p>
                  <p className="text-lg font-mono font-bold text-white">
                    <NumberFlow value={depositInvestment.currentAmount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-bold">Meta</p>
                  <p className="text-lg font-mono font-bold text-gray-400">
                    <NumberFlow value={depositInvestment.targetAmount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400 font-medium">Progresso</span>
                    <span className="text-xs text-white font-bold">
                        <NumberFlow value={Math.min(depositProgress, 100)} format={{ maximumFractionDigits: 0 }} />%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-800/50">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(depositProgress)}`}
                        style={{ width: `${Math.min(depositProgress, 100)}%` }}
                    ></div>
                  </div>
              </div>

              {/* Input Value */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  Valor da operação
                </label>
                <div className="relative group">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xl group-focus-within:text-[#d97757] transition-colors">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full p-5 pl-14 bg-gray-900 border border-gray-800 rounded-2xl focus:ring-1 focus:ring-[#d97757]/50 focus:border-[#d97757] text-white text-2xl font-bold transition-all outline-none font-mono placeholder-gray-700"
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleDeposit}
                  className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 border border-emerald-500/50"
                >
                  <ArrowUpCircle size={18} strokeWidth={2.5} />
                  Depositar
                </button>
                <button
                  onClick={handleWithdraw}
                  className="py-4 bg-gray-800 hover:bg-red-500/10 text-gray-300 hover:text-red-500 rounded-xl font-bold transition-all border border-gray-700 hover:border-red-500/50 flex items-center justify-center gap-2"
                >
                  <TrendingDown size={18} strokeWidth={2.5} />
                  Retirar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation */}
      <ConfirmationCard
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            onDelete(deleteId);
            toast.success("Caixinha removida!");
            setDeleteId(null);
          }
        }}
        title="Remover Caixinha?"
        description="Você está prestes a apagar esta caixinha. Todo o histórico de progresso será perdido."
        isDestructive={true}
        confirmText="Sim, remover"
        cancelText="Cancelar"
      />
    </div>
  );
};
