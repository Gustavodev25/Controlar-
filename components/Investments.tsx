import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PiggyBank, ArrowUpCircle, X, MoreVertical, ArrowDownCircle } from 'lucide-react';
import { Plus, Edit2, Trash2, Check, Target, Calendar, DollarSign, Coins, TrendingUp, Sparkles, TrendingDown, ChevronLeft, ChevronRight, Banknote, Wallet, Search, Filter, RotateCcw, FileText, Building } from './Icons';
import { useToasts } from './Toast';
import { ConfirmationCard, CustomSelect, CustomDatePicker } from './UIComponents';
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
  transactions?: Transaction[];
  onAdd: (investment: Omit<Investment, 'id'>) => void;
  onUpdate: (investment: Investment) => void;
  onDelete: (id: string) => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  userPlan?: 'starter' | 'pro' | 'family';
  title?: string;
  subtitle?: string;
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

// Componente de Card Individual (Estilo Subscriptions)
const InvestmentCard: React.FC<{
  investment: Investment;
  onEdit: (inv: Investment) => void;
  onDelete: (id: string) => void;
  onDeposit: (inv: Investment) => void;
  onView: (inv: Investment) => void;
}> = ({ investment, onEdit, onDelete, onDeposit, onView }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const colorClass = COLOR_OPTIONS.find(c => c.value === investment.color) || COLOR_OPTIONS[0];
  const progress = investment.targetAmount > 0 ? (investment.currentAmount / investment.targetAmount) * 100 : 0;
  const isComplete = progress >= 100 && investment.targetAmount > 0;
  const remainingAmount = Math.max(investment.targetAmount - investment.currentAmount, 0);

  return (
    <div 
      className="bg-gray-950 rounded-2xl p-6 border border-gray-800 hover:border-gray-700 transition-all group relative shadow-lg shadow-black/20 flex flex-col gap-6 h-full"
    >
      {/* Luz de fundo decorativa */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-5 group-hover:opacity-10 transition-opacity ${colorClass.bgClass.replace('/20', '')}`}></div>
      </div>

      {/* Header: Ícone, Nome e Menu */}
      <div className="flex justify-between items-start relative z-20">
        <div className="flex items-start gap-4">
          {/* Ícone */}
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5 shadow-inner bg-gray-900/80">
            {investment.icon.includes('.png') ? (
              <img src={`/assets/${investment.icon}`} alt={investment.name} className="w-8 h-8 object-contain" />
            ) : (
              <span className="text-2xl">{investment.icon}</span>
            )}
          </div>

          {/* Nome e Detalhes */}
          <div className="pt-0.5">
            <h4 className="font-bold text-gray-100 text-lg leading-tight mb-1.5">{investment.name}</h4>
            
            {/* Badges / Instituição */}
            <div className="flex flex-wrap items-center gap-2">
              {investment.isConnected ? (
                <span className="flex items-center gap-1.5 font-mono text-gray-500 text-[10px] uppercase tracking-wide">
                  <Building size={10} /> {investment.institution}
                </span>
              ) : (
                investment.deadline && (
                  <span className="flex items-center gap-1.5 font-mono text-gray-500 text-[10px] uppercase tracking-wide">
                    <Calendar size={10} /> {new Date(investment.deadline).toLocaleDateString('pt-BR')}
                  </span>
                )
              )}
              
              {investment.isConnected && (
                <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 uppercase tracking-wider font-bold flex items-center gap-1">
                  <Sparkles size={8} /> Auto
                </span>
              )}
              {isComplete && !investment.isConnected && (
                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 uppercase tracking-wider font-bold flex items-center gap-1">
                  <Check size={8} /> Completo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Menu Dropdown */}
        <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isMenuOpen ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
            >
              <MoreVertical size={18} />
            </button>

            {isMenuOpen && (
              <div className="absolute top-10 right-0 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-dropdown-open">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onView(investment);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3 transition-colors border-b border-gray-800"
                >
                  <FileText size={16} className="text-gray-500" />
                  Extrato
                </button>
                
                {!investment.isConnected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onDeposit(investment);
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3 transition-colors border-b border-gray-800"
                  >
                    <Wallet size={16} className="text-gray-500" />
                    Movimentar
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onEdit(investment);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-3 transition-colors border-b border-gray-800"
                >
                  <Edit2 size={16} className="text-gray-500" />
                  {investment.isConnected ? 'Editar Apelido' : 'Editar'}
                </button>

                {!investment.isConnected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onDelete(investment.id);
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-3 transition-colors"
                  >
                    <Trash2 size={16} />
                    Excluir
                  </button>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Body: Saldo e Meta */}
      <div className="relative z-10 flex-1 flex flex-col justify-center pl-1">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Saldo Atual</p>
        <p className="font-mono font-bold text-2xl md:text-3xl text-white tracking-tight">
          <NumberFlow value={investment.currentAmount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
        </p>
        
        {!investment.isConnected && investment.targetAmount > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 font-mono">
            <Target size={12} />
            <span>Meta: {formatCurrency(investment.targetAmount)}</span>
          </div>
        )}
      </div>

      {/* Footer: Barra de Progresso (apenas para manuais com meta) */}
      {!investment.isConnected && investment.targetAmount > 0 && (
        <div className="relative z-10">
          <div className="flex justify-between text-[10px] mb-1.5 text-gray-400 font-medium uppercase tracking-wide">
            <span className={isComplete ? 'text-emerald-400' : ''}>{Math.min(progress, 100).toFixed(0)}% Concluído</span>
            {!isComplete && <span>Falta {formatCurrency(remainingAmount)}</span>}
          </div>
          <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-[#d97757]'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {/* Spacer para Connected Accounts */}
      {investment.isConnected && <div className="h-4"></div>}

    </div>
  );
};

export const Investments: React.FC<InvestmentsProps> = ({
  investments,
  connectedSavingsAccounts = [],
  transactions = [],
  onAdd,
  onUpdate,
  onDelete,
  onAddTransaction,
  userPlan = 'starter',
  title = 'Caixinhas',
  subtitle = 'Organize seus sonhos e metas'
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [modalStep, setModalStep] = useState<'template' | 'form'>('template');
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Details Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  
  // Statement Filters
  const [detailsSearch, setDetailsSearch] = useState('');
  const [detailsStartDate, setDetailsStartDate] = useState('');
  const [detailsEndDate, setDetailsEndDate] = useState('');

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

  // Animation Control (Igual ao Reminders)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isModalOpen || depositModalOpen || detailsModalOpen) {
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
  }, [isModalOpen, depositModalOpen, detailsModalOpen]);


  const isLimitReached = userPlan === 'starter' && investments.length >= 2;

  const handleOpenModal = (investment?: Investment) => {
    // Removed the check that prevented editing connected accounts
    // if (investment?.isConnected) return; 

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
    // Validation: Name is always required. Target Amount is required only for manual investments.
    if (!formData.name) {
      toast.error("Preencha o nome.");
      return;
    }
    
    if (!editingInvestment?.isConnected && formData.targetAmount <= 0) {
      toast.error("Preencha a meta.");
      return;
    }

    if (editingInvestment) {
      onUpdate({ ...editingInvestment, ...formData });
      toast.success(editingInvestment.isConnected ? "Apelido atualizado!" : "Caixinha atualizada!");
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

  // Handle Opening the Details Modal
  const handleViewDetails = (investment: Investment) => {
    setSelectedInvestment(investment);
    setDetailsSearch('');
    setDetailsStartDate('');
    setDetailsEndDate('');
    setDetailsModalOpen(true);
  };

  // Filter Transactions for Selected Investment
  const investmentTransactions = React.useMemo(() => {
    if (!selectedInvestment) return [];
    
    let filtered = transactions.filter(t => {
      // Case 1: Connected Account
      if (selectedInvestment.isConnected) {
        return t.accountId === selectedInvestment.id;
      }
      
      // Case 2: Manual Caixinha (Match by Category "Caixinha - Name")
      if (t.category === `Caixinha - ${selectedInvestment.name}`) return true;
      
      // Fallback: Match by description + isInvestment flag
      return t.isInvestment && t.description.includes(selectedInvestment.name);
    });

    // Apply Filters
    if (detailsSearch) {
      const term = detailsSearch.toLowerCase();
      filtered = filtered.filter(t => 
        (t.description || '').toLowerCase().includes(term) || 
        (t.category || '').toLowerCase().includes(term)
      );
    }

    if (detailsStartDate) {
      filtered = filtered.filter(t => t.date >= detailsStartDate);
    }

    if (detailsEndDate) {
      filtered = filtered.filter(t => t.date <= detailsEndDate);
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date desc
  }, [selectedInvestment, transactions, detailsSearch, detailsStartDate, detailsEndDate]);

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
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
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

      {/* Lista de Caixinhas (Vertical List - Style Subscriptions) */}
      <div className="flex-1">
        {allInvestments.length === 0 ? (
          <EmptyState
            title="Nenhuma caixinha criada"
            description="Crie caixinhas para organizar e acompanhar seus objetivos financeiros de forma visual e prática."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {allInvestments.map((investment) => (
              <InvestmentCard 
                key={investment.id} 
                investment={investment} 
                onEdit={handleOpenModal} 
                onDelete={setDeleteId}
                onDeposit={handleOpenDeposit}
                onView={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* Details/Statement Modal */}
      {isVisible && detailsModalOpen && selectedInvestment && createPortal(
        <div className={`
            fixed inset-0 z-[9999] flex items-center justify-center p-4 
            transition-all duration-300 ease-in-out
            ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}
        `}>
          <div className={`
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-800 
                flex flex-col max-h-[90vh] relative 
                transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>
            {/* Background Effects */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
            </div>

            {/* Header */}
            <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {selectedInvestment.icon.includes('.png') ? (
                    <img src={`/assets/${selectedInvestment.icon}`} alt="icon" className="w-6 h-6 object-contain" />
                ) : (
                    <span className="text-2xl text-[#d97757]">{selectedInvestment.icon}</span>
                )}
                {selectedInvestment.name}
              </h2>
              <button onClick={() => setDetailsModalOpen(false)} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-gray-800/50 bg-gray-900/30 flex flex-col sm:flex-row gap-3 relative z-10">
                {/* Search */}
                <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                    <input 
                        type="text" 
                        placeholder="Buscar..." 
                        value={detailsSearch}
                        onChange={(e) => setDetailsSearch(e.target.value)}
                        className="w-full bg-gray-900/50 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 outline-none transition-all"
                    />
                </div>
                
                {/* Dates */}
                <div className="flex gap-2 flex-1">
                    <div className="flex-1">
                        <CustomDatePicker 
                            value={detailsStartDate}
                            onChange={setDetailsStartDate}
                            placeholder="Início"
                        />
                    </div>
                    <div className="flex-1">
                        <CustomDatePicker 
                            value={detailsEndDate}
                            onChange={setDetailsEndDate}
                            placeholder="Fim"
                        />
                    </div>
                </div>

                {/* Reset */}
                {(detailsSearch || detailsStartDate || detailsEndDate) && (
                    <button 
                        onClick={() => { setDetailsSearch(''); setDetailsStartDate(''); setDetailsEndDate(''); }}
                        className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700 transition-all"
                        title="Limpar filtros"
                    >
                        <RotateCcw size={16} />
                    </button>
                )}
            </div>

            {/* Content: Transaction List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-0">
              {investmentTransactions.length === 0 ? (
                <EmptyState
                  title="Nenhuma movimentação"
                  description="Esta caixinha ainda não possui histórico."
                  className="!border-0 !bg-transparent !shadow-none h-64"
                />
              ) : (
                <table className="min-w-full border-collapse text-sm text-left">
                  <thead className="bg-gray-900/30 text-xs font-bold text-gray-400 uppercase tracking-wider sticky top-0 z-20 backdrop-blur-sm">
                      <tr>
                          <th className="px-6 py-4 border-b border-gray-800/50">Data</th>
                          <th className="px-6 py-4 border-b border-gray-800/50">Descrição</th>
                          <th className="px-6 py-4 border-b border-gray-800/50 text-right">Valor</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                      {investmentTransactions.map(t => (
                          <tr key={t.id} className="hover:bg-gray-900/40 transition-colors">
                              <td className="px-6 py-4 text-gray-400 font-mono text-xs whitespace-nowrap">
                                  {new Date(t.date).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-6 py-4 text-gray-200 font-medium">
                                  {t.description}
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <span className={`font-bold font-mono ${t.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {formatCurrency(t.amount)}
                                  </span>
                              </td>
                          </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Footer Summary */}
            <div className="p-4 border-t border-gray-800/50 bg-gray-900/30 flex justify-between items-center text-xs font-medium text-gray-400 relative z-10">
               <span>Total de movimentações: {investmentTransactions.length}</span>
               <div className="flex items-center gap-2">
                  <span>Saldo Atual:</span>
                  <span className="text-white font-bold font-mono text-sm">{formatCurrency(selectedInvestment.currentAmount)}</span>
               </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Deposit/Withdraw Modal */}
      {isVisible && depositModalOpen && depositInvestment && createPortal(
        <div className={`
            fixed inset-0 z-[100] flex items-center justify-center p-4 
            transition-all duration-300 ease-in-out
            ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}
        `}>
          <div className={`
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-800 
                flex flex-col relative 
                transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>
             {/* Background Effects */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
            </div>

             {/* Header */}
            <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="text-[#d97757]" size={24} />
                Movimentar
              </h2>
              <button onClick={() => setDepositModalOpen(false)} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8 relative z-10">
                {/* Balance Display */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-inner">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Saldo Disponível</span>
                    <span className="text-2xl font-bold text-white font-mono tracking-tight">
                        {formatCurrency(depositInvestment.currentAmount)}
                    </span>
                </div>

                {/* Amount Input */}
                <div className="relative">
                    <div className="flex items-center justify-center gap-1">
                        <span className="text-2xl text-gray-500 font-bold -mt-1">R$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={depositAmount}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9,.]/g, '');
                                setDepositAmount(val);
                            }}
                            className="w-48 bg-transparent text-4xl font-bold text-white placeholder-gray-800 outline-none text-center font-mono"
                            placeholder="0,00"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleWithdraw}
                        disabled={!depositAmount || parseFloat(depositAmount.replace(',', '.')) <= 0}
                        className="py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 rounded-xl font-bold transition-all border border-red-500/20 hover:border-red-500/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <ArrowDownCircle size={18} className="group-hover:translate-y-0.5 transition-transform" />
                        Sacar
                    </button>
                    <button
                        onClick={handleDeposit}
                        disabled={!depositAmount || parseFloat(depositAmount.replace(',', '.')) <= 0}
                        className="py-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 hover:text-emerald-400 rounded-xl font-bold transition-all border border-emerald-500/20 hover:border-emerald-500/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <ArrowUpCircle size={18} className="group-hover:-translate-y-0.5 transition-transform" />
                        Depositar
                    </button>
                </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create/Edit Modal - VISUAL IGUAL REMINDERS */}

      {isVisible && isModalOpen && createPortal(
        <div className={`
            fixed inset-0 z-[9999] flex items-center justify-center p-4 
            transition-all duration-300 ease-in-out
            ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}
        `}>
          <div className={`
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800 
                flex flex-col max-h-[90vh] relative 
                transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>
            {/* Background Effects */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
            </div>

            {/* Header */}
            <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <PiggyBank className="text-[#d97757]" size={24} />
                {editingInvestment ? (editingInvestment.isConnected ? 'Editar Apelido' : 'Editar Caixinha') : 'Nova Caixinha'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-6 pt-6 overflow-y-auto custom-scrollbar relative z-10">
              {modalStep === 'template' && !editingInvestment ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="text-left mb-2">
                    <p className="text-gray-400 text-sm">Escolha um modelo para começar ou crie do zero.</p>
                  </div>

                  {/* Templates Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {TEMPLATES.map((template) => {
                      return (
                        <button
                          key={template.name}
                          onClick={() => handleSelectTemplate(template)}
                          className="p-4 bg-gray-900/40 border border-gray-800 rounded-xl hover:border-gray-600 hover:bg-gray-900 transition-all duration-200 group text-left flex items-center gap-3"
                        >
                            <div className="w-10 h-10 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                              <img
                                src={`/assets/${template.icon}`}
                                alt={template.name}
                                className="w-6 h-6 object-contain"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-200 group-hover:text-white">
                                {template.name}
                              </p>
                              <p className="text-[10px] font-mono text-gray-500 mt-0.5">
                                <NumberFlow value={template.suggestedAmount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                              </p>
                            </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-slide-up">
                  {/* Centered Icon Preview */}
                  <div className="flex justify-center">
                    <div className="w-20 h-20 bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center shadow-lg relative group cursor-pointer">
                        {formData.icon.includes('.png') ? (
                          <img
                            src={`/assets/${formData.icon}`}
                            alt="Ícone"
                            className="w-10 h-10 object-contain group-hover:scale-110 transition-transform"
                          />
                        ) : (
                          <span className="text-3xl">{formData.icon}</span>
                        )}
                        <div className="absolute -bottom-2 -right-2 bg-gray-800 rounded-full p-1.5 border border-gray-700 text-gray-400">
                            <Edit2 size={10} />
                        </div>
                    </div>
                  </div>

                  {/* Name Input - Minimalist */}
                  <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                        {editingInvestment?.isConnected ? 'Apelido da Conta' : 'Nome do Objetivo'}
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl text-white px-4 py-3 text-sm focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 outline-none transition-all font-bold placeholder-gray-600"
                        placeholder="Ex: Viagem dos Sonhos"
                        autoFocus
                      />
                  </div>

                  {/* Amount & Date Input - Hidden for Connected Accounts */}
                  {!(editingInvestment?.isConnected) && (
                   <>
                   <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Meta Financeira</label>
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">R$</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={formData.targetAmount > 0 ? formData.targetAmount.toString().replace('.', ',') : ''}
                                onChange={(e) => {
                                const val = e.target.value.replace(',', '.');
                                const parsed = parseFloat(val);
                                setFormData({ ...formData, targetAmount: isNaN(parsed) ? 0 : parsed });
                                }}
                                className="w-full bg-gray-900 border border-gray-800 rounded-xl text-white pl-12 pr-4 py-3.5 text-lg focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 outline-none transition-all font-mono font-bold"
                                placeholder="0,00"
                            />
                        </div>
                   </div>

                   <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Prazo <span className="text-gray-600 font-normal lowercase">(opcional)</span></label>
                        <CustomDatePicker 
                            value={formData.deadline || ''} 
                            onChange={(date) => setFormData({ ...formData, deadline: date })}
                            placeholder="Selecione uma data"
                            dropdownMode="absolute"
                        />
                   </div>
                   </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {modalStep === 'form' && (
              <div className="p-6 border-t border-gray-800/50 bg-gray-900/30 flex gap-3 relative z-10">
                <button
                  type="button"
                  onClick={() => editingInvestment ? handleCloseModal() : setModalStep('template')}
                  className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl font-bold transition-all border border-gray-800 hover:border-gray-700 text-sm"
                >
                  {editingInvestment ? 'Cancelar' : 'Voltar'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-[2] py-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/20 border border-[#d97757]/50 flex items-center justify-center gap-2 text-sm"
                >
                  <Check size={18} strokeWidth={3} />
                  {editingInvestment ? 'Salvar' : 'Criar Caixinha'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
