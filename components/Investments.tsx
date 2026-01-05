import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PiggyBank, ArrowUpCircle, X, MoreVertical, ArrowDownCircle, CheckSquare, Square } from 'lucide-react';
import { Plus, Edit2, Trash2, Check, Target, Calendar, DollarSign, Coins, TrendingUp, Sparkles, TrendingDown, ChevronLeft, ChevronRight, Banknote, Wallet, Search, Filter, RotateCcw, FileText, Building, RefreshCw, Settings } from './Icons';
import { useToasts } from './Toast';
import { CustomSelect, CustomDatePicker, Tooltip, CustomMonthPicker } from './UIComponents';
import { ConfirmationBar } from './ConfirmationBar';
import { Transaction, ConnectedAccount } from '../types';
import { EmptyState } from './EmptyState';
import NumberFlow from '@number-flow/react';
import { toLocalISODate, toLocalISOString } from '../utils/dateUtils';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './Dropdown';

export interface Investment {
  id: string;
  memberId?: string;
  name: string;
  icon: string; // Kept for compatibility, but hidden from UI
  color: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: string;
  deadline?: string;
  isConnected?: boolean;
  institution?: string;
  subtype?: string; // Para identificar conta poupança
  accountNumber?: string; // Número da conta
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
  { name: 'Viajar', color: 'blue', suggestedAmount: 5000 },
  { name: 'Comprar Carro', color: 'red', suggestedAmount: 50000 },
  { name: 'Reserva', color: 'green', suggestedAmount: 10000 },
  { name: 'Outros', color: 'purple', suggestedAmount: 1000 },
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

const formatCurrency = (val: number) => {
  if (val === undefined || val === null || isNaN(val)) return "--";
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// Componente de Card Individual (Estilo GRID/Card)
const InvestmentCard: React.FC<{
  investment: Investment;
  onEdit: (inv: Investment) => void;
  onDelete: (id: string) => void;
  onDeposit: (inv: Investment) => void;
  onView: (inv: Investment) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}> = ({ investment, onEdit, onDelete, onDeposit, onView, selectionMode = false, selected = false, onToggleSelect }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const progress = investment.targetAmount > 0 ? (investment.currentAmount / investment.targetAmount) * 100 : 0;
  const isComplete = progress >= 100 && investment.targetAmount > 0;
  const remainingAmount = Math.max(investment.targetAmount - investment.currentAmount, 0);

  // Status visual config
  let statusConfig = {
    accentColor: "bg-[#d97757]",
    badgeBg: "bg-[#d97757]/10",
    badgeText: "text-[#d97757]",
    statusText: "Em andamento",
    amountColor: "text-white"
  };

  if (isComplete) {
    statusConfig = {
      accentColor: "bg-emerald-500",
      badgeBg: "bg-emerald-500/10",
      badgeText: "text-emerald-400",
      statusText: "Completo",
      amountColor: "text-emerald-400"
    };
  } else if (investment.isConnected) {
    statusConfig = {
      accentColor: "bg-blue-500",
      badgeBg: "bg-blue-500/10",
      badgeText: "text-blue-400",
      statusText: "Open Finance",
      amountColor: "text-white"
    };
  }

  return (
    <div
      className={`
        group relative bg-[#30302E] rounded-2xl border border-[#373734] overflow-visible transition-all duration-300
        hover:border-[#4a4a47] hover:bg-[#343432] flex flex-col h-full
        ${selected ? 'ring-2 ring-[#d97757] border-[#d97757]' : ''}
        ${selectionMode || investment.isConnected ? 'cursor-pointer' : ''}
      `}
      onClick={
        selectionMode
          ? () => onToggleSelect && onToggleSelect(investment.id)
          : investment.isConnected
            ? () => onView(investment)
            : undefined
      }
    >
      {/* Luz de fundo decorativa */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-5 group-hover:opacity-10 transition-opacity bg-white`}></div>
      </div>

      {/* Checkbox de seleção (Absolute) */}
      {selectionMode && (
        <div className="absolute top-4 left-4 z-30">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(investment.id); }}
            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selected
              ? 'bg-[#d97757] border-[#d97757] text-white'
              : 'border-gray-600 bg-[#30302E] hover:border-[#d97757]'
              }`}
          >
            {selected && <Check size={14} strokeWidth={3} />}
          </button>
        </div>
      )}

      {/* Header: Name & Menu (No Icon) */}
      <div className="flex justify-between items-start px-5 pt-5 relative z-20">
        <div className="flex-1 min-w-0 pr-2">
          <h4 className="font-bold text-white text-lg leading-tight truncate">{investment.name}</h4>

          {/* Badges - Moved here from body for better header balance without icon */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {!investment.isConnected && investment.deadline && (
              <span className="flex items-center gap-1.5 font-mono text-gray-500 text-[10px] uppercase tracking-wide">
                <Calendar size={10} /> {new Date(investment.deadline).toLocaleDateString('pt-BR')}
              </span>
            )}

            {investment.isConnected && (
              <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 uppercase tracking-wider font-bold flex items-center gap-1">
                <Sparkles size={8} /> Open Finance
              </span>
            )}
            {(investment.subtype === 'SAVINGS' || investment.subtype === 'SAVINGS_ACCOUNT') && (
              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 uppercase tracking-wider font-bold flex items-center gap-1">
                <Banknote size={8} /> Poupança
              </span>
            )}
            {investment.accountNumber && (
              <span className="font-mono text-gray-500 text-[10px] tracking-wide">
                Conta: {investment.accountNumber}
              </span>
            )}
          </div>
        </div>

        {/* Menu Dropdown using reusable component */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Dropdown>
            <DropdownTrigger>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-gray-500 hover:text-white hover:bg-[#373734] group-hover:bg-[#373734]"
              >
                <MoreVertical size={18} />
              </button>
            </DropdownTrigger>
            <DropdownContent align="right">
              {!investment.isConnected && (
                <DropdownItem icon={FileText} onClick={() => onView(investment)}>
                  Extrato
                </DropdownItem>
              )}

              {!investment.isConnected && (
                <DropdownItem icon={Wallet} onClick={() => onDeposit(investment)}>
                  Movimentar
                </DropdownItem>
              )}

              <DropdownItem icon={Edit2} onClick={() => onEdit(investment)}>
                {investment.isConnected ? 'Editar Apelido' : 'Editar'}
              </DropdownItem>

              <DropdownItem
                icon={Trash2}
                danger
                onClick={() => onDelete(investment.id)}
              >
                Excluir
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>

      {/* Body: Amount */}
      <div className="px-5 mt-6 flex-1 flex flex-col justify-center">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Saldo Atual</p>
        <p className="font-mono font-bold text-2xl md:text-3xl text-white tracking-tight">
          <NumberFlow value={typeof investment.currentAmount === 'number' && !isNaN(investment.currentAmount) ? investment.currentAmount : 0} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
        </p>

        {!investment.isConnected && investment.targetAmount > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 font-mono">
            <Target size={12} />
            <span>Meta: {formatCurrency(investment.targetAmount)}</span>
          </div>
        )}
      </div>

      {/* Footer: Progress */}
      {!investment.isConnected && investment.targetAmount > 0 && (
        <div className="px-5 pb-6 pt-4 mt-auto">
          <div className="flex justify-between text-[10px] mb-1.5 text-gray-400 font-medium uppercase tracking-wide">
            <span className={isComplete ? 'text-emerald-400' : ''}>{Math.min(progress, 100).toFixed(0)}% Concluído</span>
            {!isComplete && <span>Falta {formatCurrency(remainingAmount)}</span>}
          </div>
          <div className="h-2 bg-[#272725] rounded-full overflow-hidden border border-[#373734]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-[#d97757]'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Spacer for consistency if no progress bar */}
      {!(!investment.isConnected && investment.targetAmount > 0) && <div className="h-6"></div>}

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

  // Selection Mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Merge connected accounts - filter out accounts with invalid balance
  const validSavingsAccounts = connectedSavingsAccounts.filter(acc => {
    const balance = acc.balance;
    return balance !== undefined && balance !== null && !isNaN(balance);
  });

  const connectedInvestments: Investment[] = validSavingsAccounts.map(acc => ({
    id: acc.id,
    name: acc.name,
    icon: 'reserva.png', // Default icon
    color: 'green',
    targetAmount: 0,
    currentAmount: typeof acc.balance === 'number' && !isNaN(acc.balance) ? acc.balance : 0,
    createdAt: acc.lastUpdated || toLocalISOString(),
    isConnected: true,
    institution: acc.institution,
    subtype: acc.subtype, // Para identificar conta poupança
    accountNumber: acc.accountNumber // Número da conta
  }));

  // Filter out investments with invalid data (NaN currentAmount, missing name, etc.)
  const validInvestments = investments.filter(inv => {
    const hasValidAmount = typeof inv.currentAmount === 'number' && !isNaN(inv.currentAmount);
    const hasValidName = inv.name && inv.name.trim() !== '';
    return hasValidAmount && hasValidName;
  });

  const allInvestments = [...connectedInvestments, ...validInvestments];

  // Deposit modal
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositInvestment, setDepositInvestment] = useState<Investment | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  const [formData, setFormData] = useState<Omit<Investment, 'id'>>({
    name: '',
    icon: 'reserva.png', // Default, but hidden
    color: 'blue',
    targetAmount: 0,
    currentAmount: 0,
    createdAt: toLocalISODate(),
    deadline: ''
  });

  const toast = useToasts();

  // Animation Control
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

  // Handle Selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === allInvestments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allInvestments.map(i => i.id));
    }
  };

  const isLimitReached = userPlan === 'starter' && investments.length >= 2;

  const handleOpenModal = (investment?: Investment) => {
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
      // Removed icon update
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
    if (investment.isConnected) return;
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

      // Case 2: Manual Caixinha
      if (t.category === `Caixinha - ${selectedInvestment.name}`) return true;

      // Fallback
      return t.isInvestment && t.description.includes(selectedInvestment.name);
    });

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

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedInvestment, transactions, detailsSearch, detailsStartDate, detailsEndDate]);

  const totalSaved = allInvestments.reduce((sum, inv) => sum + inv.currentAmount, 0);
  const totalTarget = allInvestments.reduce((sum, inv) => sum + inv.targetAmount, 0);

  return (
    <div className="w-full space-y-8 animate-fade-in font-sans pb-10">

      {/* HEADER PADRONIZADO */}
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
            <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
            <span className="hidden sm:inline font-bold text-sm">Nova</span>
          </button>
        </div>
      </div>

      {/* QUICK STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card Total Guardado */}
        <div className="rounded-2xl border border-[#373734] bg-[#30302E] p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#272725] border border-[#373734] rounded-xl text-emerald-500">
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
        <div className="rounded-2xl border border-[#373734] bg-[#30302E] p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#272725] border border-[#373734] rounded-xl text-blue-500">
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

      {/* LEGENDA DE STATUS */}
      {allInvestments.length > 0 && (
        <div className="flex justify-between items-center pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#d97757]/10 flex items-center justify-center text-[#d97757]">
              <PiggyBank size={18} strokeWidth={2.5} />
            </div>
            Suas Caixinhas
          </h3>

          <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/5 border border-white/5 group/legend backdrop-blur-sm">
            <Tooltip content="Open Finance (Conectada)">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 cursor-help transition-all duration-300 hover:scale-125 opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="Em andamento">
              <div className="w-2.5 h-2.5 rounded-full bg-[#d97757] cursor-help transition-all duration-300 hover:scale-125 opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="Completo">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 cursor-help transition-all duration-300 hover:scale-125 opacity-70 hover:opacity-100" />
            </Tooltip>
          </div>
        </div>
      )}

      {/* LISTA DE CONTEÚDO */}
      {allInvestments.length === 0 ? (
        <EmptyState
          title="Nenhuma caixinha criada"
          description="Crie caixinhas para organizar e acompanhar seus objetivos financeiros de forma visual e prática."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
          {allInvestments.map((investment) => (
            <InvestmentCard
              key={investment.id}
              investment={investment}
              onEdit={handleOpenModal}
              onDelete={setDeleteId}
              onDeposit={handleOpenDeposit}
              onView={handleViewDetails}
              selectionMode={selectionMode}
              selected={selectedIds.includes(investment.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))}
        </div>
      )}

      {/* Details/Statement Modal */}
      {isVisible && detailsModalOpen && selectedInvestment && createPortal(
        <div className={`
            fixed inset-0 z-[9999] flex items-center justify-center p-4 
            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
            ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
        `}>
          <div className={`
                bg-[#30302E] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-[#373734] 
                flex flex-col max-h-[90vh] relative 
                transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-10 bg-[#d97757]" />

            {/* Header */}
            <div className="px-4 py-3 border-b border-[#373734]/50 flex justify-between items-center relative z-10">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="text-[#d97757]" size={16} />
                Extrato: {selectedInvestment.name}
              </h2>
              <button onClick={() => setDetailsModalOpen(false)} className="text-gray-500 hover:text-white p-1.5 hover:bg-[#373734]/50 rounded-md transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-[#373734]/50 bg-[#272725]/30 flex flex-col sm:flex-row gap-3 relative z-10">
              {/* Search */}
              <div className="relative flex-1 group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={detailsSearch}
                  onChange={(e) => setDetailsSearch(e.target.value)}
                  className="w-full bg-[rgba(58,59,57,0.5)] border border-[#4a4b49] rounded-xl pl-10 pr-4 h-11 text-sm text-white focus:border-[#d97757] focus:bg-[rgba(58,59,57,0.8)] outline-none transition-all placeholder-gray-500"
                />
              </div>

              {/* Dates */}
              <div className="flex gap-2 flex-1">
                <div className="flex-1">
                  <CustomDatePicker
                    value={detailsStartDate}
                    onChange={setDetailsStartDate}
                    placeholder="Início"
                    dropdownMode="fixed"
                  />
                </div>
                <div className="flex-1">
                  <CustomDatePicker
                    value={detailsEndDate}
                    onChange={setDetailsEndDate}
                    placeholder="Fim"
                    dropdownMode="fixed"
                  />
                </div>
              </div>

              {/* Reset */}
              {(detailsSearch || detailsStartDate || detailsEndDate) && (
                <button
                  onClick={() => { setDetailsSearch(''); setDetailsStartDate(''); setDetailsEndDate(''); }}
                  className="p-2 bg-[#373734] hover:bg-[#4a4a47] text-gray-400 hover:text-white rounded-xl border border-[#4a4a47] transition-all"
                  title="Limpar filtros"
                >
                  <RotateCcw size={14} />
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
                <table className="min-w-full border-collapse text-left">
                  <thead className="bg-[#272725]/50 text-[10px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-20 backdrop-blur-sm border-b border-[#373734]">
                    <tr>
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3">Descrição</th>
                      <th className="px-5 py-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#373734]/50">
                    {investmentTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(t.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-5 py-3 text-gray-300 font-medium text-xs">
                          {t.description}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-bold font-mono text-xs ${t.type === 'expense' || t.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {t.type === 'expense' && t.amount > 0 ? `- ${formatCurrency(t.amount)}` : formatCurrency(t.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Deposit/Withdraw Modal */}
      {isVisible && depositModalOpen && depositInvestment && createPortal(
        <div className={`
            fixed inset-0 z-[100] flex items-center justify-center p-4 
            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
            ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
        `}>
          <div className={`
                bg-[#30302E] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-[#373734] 
                flex flex-col relative 
                transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#373734]/50 flex justify-between items-center relative z-10">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Wallet className="text-[#d97757]" size={16} />
                Movimentar
              </h2>
              <button onClick={() => setDepositModalOpen(false)} className="text-gray-500 hover:text-white p-1.5 hover:bg-[#373734]/50 rounded-md transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8 relative z-10">
              {/* Balance Display */}
              <div className="bg-[#272725] border border-[#373734] rounded-2xl p-4 flex flex-col items-center justify-center shadow-inner">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Saldo Disponível</span>
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
                    className="w-48 bg-transparent text-4xl font-bold text-white placeholder-gray-700 outline-none text-center font-mono"
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
                  className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl font-bold transition-all border border-red-500/20 hover:border-red-500/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group text-sm"
                >
                  <ArrowDownCircle size={16} className="group-hover:translate-y-0.5 transition-transform" />
                  Sacar
                </button>
                <button
                  onClick={handleDeposit}
                  disabled={!depositAmount || parseFloat(depositAmount.replace(',', '.')) <= 0}
                  className="py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-xl font-bold transition-all border border-emerald-500/20 hover:border-emerald-500/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group text-sm"
                >
                  <ArrowUpCircle size={16} className="group-hover:-translate-y-0.5 transition-transform" />
                  Depositar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create/Edit Modal - VISUAL IGUAL REMINDERS/SUBSCRIPTIONS */}
      {isVisible && isModalOpen && createPortal(
        <div className={`
            fixed inset-0 z-[9999] flex items-center justify-center p-4 
            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
            ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
        `}>
          <div className={`
                bg-[#30302E] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#373734] 
                flex flex-col max-h-[90vh] relative 
                transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-15 bg-[#d97757]" />

            {/* Header */}
            <div className="px-4 py-3 border-b border-[#373734]/50 flex justify-between items-center relative z-10">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <PiggyBank className="text-[#d97757]" size={16} />
                {editingInvestment ? (editingInvestment.isConnected ? 'Editar Apelido' : 'Editar Caixinha') : 'Nova Caixinha'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-white p-1.5 hover:bg-[#373734]/50 rounded-md transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 overflow-y-auto custom-scrollbar relative z-10">
              {modalStep === 'template' && !editingInvestment ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="text-left mb-2">
                    <p className="text-gray-400 text-sm">Escolha um modelo para começar ou crie do zero.</p>
                  </div>

                  {/* Templates Grid - Icons Removed */}
                  <div className="grid grid-cols-2 gap-3">
                    {TEMPLATES.map((template) => {
                      return (
                        <button
                          key={template.name}
                          onClick={() => handleSelectTemplate(template)}
                          className="p-4 bg-[#272725] border border-[#373734] rounded-xl hover:border-gray-500 hover:bg-[#323230] transition-all duration-200 group text-left flex flex-col gap-1"
                        >
                          <p className="text-sm font-bold text-gray-200 group-hover:text-white">
                            {template.name}
                          </p>
                          <p className="text-[10px] font-mono text-gray-500">
                            <NumberFlow value={template.suggestedAmount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-slide-up">
                  {/* Name Input - Minimalist */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                      {editingInvestment?.isConnected ? 'Apelido da Conta' : 'Nome do Objetivo'}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-[#272725]/40 border border-[#373734]/60 rounded-lg text-white px-4 py-2.5 text-[13px] focus:border-[#4a4a47] focus:bg-[#272725]/60 outline-none transition-all placeholder-gray-600"
                      placeholder="Ex: Viagem dos Sonhos"
                      autoFocus
                    />
                  </div>

                  {/* Amount & Date Input - Hidden for Connected Accounts */}
                  {!(editingInvestment?.isConnected) && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Meta Financeira</label>
                        <div className="relative group">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={formData.targetAmount > 0 ? formData.targetAmount.toString().replace('.', ',') : ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(',', '.');
                              const parsed = parseFloat(val);
                              setFormData({ ...formData, targetAmount: isNaN(parsed) ? 0 : parsed });
                            }}
                            className="w-full bg-[#272725]/40 border border-[#373734]/60 rounded-lg text-white pl-9 pr-4 py-2.5 text-[13px] focus:border-[#4a4a47] focus:bg-[#272725]/60 outline-none transition-all placeholder-gray-600 font-mono"
                            placeholder="0,00"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Prazo <span className="text-gray-600 font-normal lowercase">(opcional)</span></label>
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
              <div className="p-4 border-t border-[#373734]/50 bg-[#272725]/30 flex gap-3 relative z-10">
                <button
                  type="button"
                  onClick={() => editingInvestment ? handleCloseModal() : setModalStep('template')}
                  className="flex-1 py-2.5 bg-[#373734] hover:bg-[#4a4a47] text-gray-300 hover:text-white rounded-lg font-semibold transition-all border border-[#4a4a47] text-[13px]"
                >
                  {editingInvestment ? 'Cancelar' : 'Voltar'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-[2] py-2.5 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-lg font-semibold transition-all shadow-lg shadow-[#d97757]/20 border border-[#d97757]/50 flex items-center justify-center gap-2 text-[13px]"
                >
                  <Check size={16} strokeWidth={2.5} />
                  {editingInvestment ? 'Salvar' : 'Criar'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

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
        label="Excluir Caixinha?"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isDestructive={true}
      />
    </div>
  );
};