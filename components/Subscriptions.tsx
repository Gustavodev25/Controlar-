import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Subscription, Transaction } from '../types';
import {
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  Tag,
  DollarSign,
  Check,
  X,
  Edit2,
  CreditCard,
  TrendingUp,
  getCategoryIcon,
  Send,
  User,
  Settings
} from './Icons';
import { EmptyState } from './EmptyState';
import { CustomAutocomplete, CustomSelect, TextShimmer, CustomMonthPicker, Tooltip } from './UIComponents';
import { ConfirmationBar } from './ConfirmationBar';
import { UniversalModal } from './UniversalModal';
import { parseSubscriptionFromText } from '../services/claudeService';
import coinzinhaImg from '../assets/coinzinha.png';
import NumberFlow from '@number-flow/react';
import { FileText } from 'lucide-react';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './Dropdown';

interface SubscriptionsProps {
  subscriptions: Subscription[];
  transactions: Transaction[]; // To show history
  onAddSubscription: (sub: Omit<Subscription, 'id'>) => void;
  onUpdateSubscription: (sub: Subscription) => void;
  onDeleteSubscription: (id: string) => void;
  currentDate?: string;
  isProMode?: boolean;
  userPlan?: 'starter' | 'pro' | 'family';
  onUpgrade?: () => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const SubscriptionCard: React.FC<{
  sub: Subscription,
  onDelete: (id: string) => void,
  onEdit: (sub: Subscription) => void,
  onTogglePaid: (sub: Subscription) => void,
  isPaidThisMonth: boolean,
  filterMonth: string,
  selectionMode?: boolean,
  selected?: boolean,
  onToggleSelect?: (id: string) => void
}> = ({ sub, onDelete, onEdit, onTogglePaid, isPaidThisMonth, filterMonth, selectionMode = false, selected = false, onToggleSelect }) => {

  // Cores based on Status/Cycle
  let statusConfig = {
    accentColor: "bg-emerald-500",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-400",
    statusText: sub.billingCycle === 'monthly' ? "Mensal" : "Anual",
    amountColor: "text-white"
  };

  if (sub.status === 'canceled') {
    statusConfig = {
      accentColor: "bg-red-500",
      badgeBg: "bg-red-500/10",
      badgeText: "text-red-400",
      statusText: "Cancelada",
      amountColor: "text-gray-500"
    };
  }

  // Se está pago no mês, sobrescreve o status visual
  if (isPaidThisMonth) {
    statusConfig = {
      accentColor: "bg-gray-500",
      badgeBg: "bg-gray-500/10",
      badgeText: "text-gray-500",
      statusText: "Pago",
      amountColor: "text-gray-500 line-through"
    };
  }

  return (
    <div
      className={`
        group relative bg-[#30302E] rounded-xl sm:rounded-2xl border border-[#373734] overflow-hidden transition-all duration-300
        hover:border-[#4a4a47] hover:bg-[#343432]
        ${isPaidThisMonth ? 'opacity-60' : ''}
        ${selected ? 'ring-2 ring-[#d97757] border-[#d97757]' : ''}
        ${selectionMode ? 'cursor-pointer' : ''}
      `}
      onClick={selectionMode ? () => onToggleSelect && onToggleSelect(sub.id) : undefined}
    >
      {/* Conteúdo Principal */}
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4">

        {/* Checkbox de seleção */}
        {selectionMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(sub.id); }}
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${selected
              ? 'bg-[#d97757] border-[#d97757] text-white'
              : 'border-gray-600 hover:border-[#d97757]'
              }`}
          >
            {selected && <Check size={12} className="sm:w-3.5 sm:h-3.5" strokeWidth={3} />}
          </button>
        )}

        {/* Indicador de status (bolinha colorida) */}
        <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 ${statusConfig.accentColor}`} />

        {/* Info Principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
            <h4 className={`font-semibold text-sm sm:text-[15px] truncate ${isPaidThisMonth ? 'text-gray-500' : 'text-white'}`}>{sub.name}</h4>
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-gray-500 bg-[#272725] px-1.5 py-0.5 rounded-md border border-[#373734]">
              <RefreshCw size={9} />
              <span className="uppercase tracking-wider">Auto</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-[12px] text-gray-500">
            <span className="flex items-center gap-1">
              {getCategoryIcon(sub.category, 10)}
              <span className="hidden sm:inline">{sub.category}</span>
            </span>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <span className="font-mono text-[10px] sm:text-[12px]">{sub.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
          </div>
        </div>

        {/* Valor e Status */}
        <div className="flex flex-col items-end gap-0.5 sm:gap-1 flex-shrink-0">
          <span className={`font-mono font-bold text-base sm:text-lg tracking-tight ${statusConfig.amountColor}`}>
            <NumberFlow value={sub.amount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
          </span>
          <span className={`flex items-center gap-1 text-[9px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${statusConfig.badgeBg} ${statusConfig.badgeText}`}>
            {statusConfig.statusText}
          </span>
        </div>

        {/* Ações - aparecem no hover (desktop) ou sempre visíveis parcialmente (mobile) */}
        <div className={`flex items-center gap-0.5 sm:gap-1 transition-all duration-300 ${selectionMode ? 'opacity-0 pointer-events-none w-0' : 'sm:opacity-0 sm:group-hover:opacity-100 sm:-mr-2 sm:group-hover:mr-0 sm:w-0 sm:group-hover:w-auto overflow-hidden'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePaid(sub); }}
            className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-all ${isPaidThisMonth
              ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
              : 'text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10'
              }`}
            title={isPaidThisMonth ? "Desmarcar como pago" : "Marcar como pago"}
          >
            <Check size={14} className="sm:w-4 sm:h-4" strokeWidth={2.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(sub); }}
            className="w-7 h-7 sm:w-8 sm:h-8 hidden sm:flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
            title="Editar"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(sub.id); }}
            className="w-7 h-7 sm:w-8 sm:h-8 hidden sm:flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};


export const Subscriptions: React.FC<SubscriptionsProps> = ({ subscriptions, transactions, onAddSubscription, onUpdateSubscription, onDeleteSubscription, currentDate, isProMode = false, userPlan = 'starter', onUpgrade }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filter Month State
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [filterMonth, setFilterMonth] = useState(currentDate || currentMonthStr);

  useEffect(() => {
    if (currentDate) {
      setFilterMonth(currentDate);
    }
  }, [currentDate]);



  // Mode state
  const [modalMode, setModalMode] = useState<'ai' | 'manual'>('manual');

  // AI State - Chat System (igual Reminders)
  interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    summaryData?: { name: string, amount: number, billingCycle: 'monthly' | 'yearly', category: string };
  }
  const [aiInput, setAiInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating'>('idle');
  const [generationMessage, setGenerationMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Limit Logic
  const [starterMessageCount, setStarterMessageCount] = useState(() => {
    const saved = localStorage.getItem('coinzinha_starter_count');
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    localStorage.setItem('coinzinha_starter_count', starterMessageCount.toString());
  }, [starterMessageCount]);

  const isLimitReached = userPlan === 'starter' && starterMessageCount >= 5;

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    billingCycle: 'monthly' as 'monthly' | 'yearly',
    category: '',
    status: 'active' as 'active' | 'canceled'
  });

  const categories = ['Lazer', 'Tecnologia', 'Trabalho', 'Educação', 'Saúde', 'Outros', 'Moradia', 'Transporte'];

  // --- SELECTION MODE STATES ---
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkCycle, setBulkCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  // Animation state for bottom bar
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(false);
  const [shouldRenderBottomBar, setShouldRenderBottomBar] = useState(false);

  const [isCycleModalVisible, setIsCycleModalVisible] = useState(false);
  const [shouldRenderCycleModal, setShouldRenderCycleModal] = useState(false);

  useEffect(() => {
    if (selectionMode) {
      setShouldRenderBottomBar(true);
      const timer = setTimeout(() => setIsBottomBarVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsBottomBarVisible(false);
      const timer = setTimeout(() => setShouldRenderBottomBar(false), 500);
      return () => clearTimeout(timer);
    }
  }, [selectionMode]);

  useEffect(() => {
    if (showBulkEditModal) {
      setShouldRenderCycleModal(true);
      const timer = setTimeout(() => setIsCycleModalVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsCycleModalVisible(false);
      const timer = setTimeout(() => setShouldRenderCycleModal(false), 500);
      return () => clearTimeout(timer);
    }
  }, [showBulkEditModal]);

  // Clean up selectedIds if subscriptions are removed
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => subscriptions.some((s) => s.id === id)));
  }, [subscriptions]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === subscriptions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(subscriptions.map((s) => s.id));
    }
  };

  const resetBulkSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    setShowBulkEditModal(false);
    setBulkCycle('monthly');
    setIsApplyingBulk(false);
  };

  const selectedSubscriptions = useMemo(() => {
    return subscriptions.filter((s) => selectedIds.includes(s.id));
  }, [subscriptions, selectedIds]);

  const handleBulkApplyCycles = async () => {
    if (selectedSubscriptions.length === 0) return;
    setIsApplyingBulk(true);
    try {
      const updates = selectedSubscriptions.map((sub) => {
        if (sub.billingCycle === bulkCycle) return null;
        return Promise.resolve(onUpdateSubscription({ ...sub, billingCycle: bulkCycle }));
      }).filter((p): p is Promise<void> => !!p);
      await Promise.all(updates);
    } finally {
      setIsApplyingBulk(false);
      resetBulkSelection();
    }
  };

  const allSelected = subscriptions.length > 0 && selectedIds.length === subscriptions.length;
  // --- END SELECTION MODE STATES ---

  // Modal Animation Logic
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isModalOpen) {
      setIsVisible(true);

      // Sync limit from storage
      const savedCount = localStorage.getItem('coinzinha_starter_count');
      if (savedCount) setStarterMessageCount(parseInt(savedCount, 10));

      // Não forçar mais modo manual no modo Auto - AI liberada
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      // Inicializar mensagem de boas-vindas do chat
      if (chatMessages.length === 0) {
        setChatMessages([{
          id: 'init',
          role: 'assistant',
          content: 'Olá! Sou o Coinzinha. Diga o que você quer assinar. Ex: "Netflix 55 reais por mês"'
        }]);
      }
    } else {
      setIsAnimating(false);
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isModalOpen, isProMode]);

  // Scroll automático para novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, generationStatus]);

  const handleSendMessage = async () => {
    if (!aiInput.trim()) return;
    if (userPlan === 'starter') {
      const currentCount = parseInt(localStorage.getItem('coinzinha_starter_count') || '0', 10);
      if (currentCount >= 5) {
        setStarterMessageCount(currentCount);
        return;
      }
      setStarterMessageCount(currentCount + 1);
    }

    const userText = aiInput;
    setAiInput('');

    // Adicionar mensagem do usuário
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText
    };
    setChatMessages(prev => [...prev, newMessage]);

    // Iniciar fluxo de geração
    setGenerationMessage("Processando...");
    setGenerationStatus('generating');

    try {
      const result = await parseSubscriptionFromText(userText);

      if (result && result.name) {
        setGenerationMessage("Identificando assinatura...");

        setTimeout(() => {
          onAddSubscription({
            userId: '',
            name: result.name,
            amount: result.amount,
            billingCycle: result.billingCycle,
            category: result.category,
            status: 'active'
          });
          setGenerationStatus('idle');

          setChatMessages(prev => [...prev, {
            id: Date.now().toString() + '_ai',
            role: 'assistant',
            content: `Pronto! Criei a assinatura "${result.name}".`,
            summaryData: result
          }]);
        }, 1500);
      } else {
        setGenerationStatus('idle');
        setChatMessages(prev => [...prev, {
          id: Date.now().toString() + '_err',
          role: 'assistant',
          content: "Não entendi muito bem. Tente dizer o nome do serviço e o valor, por exemplo: 'Spotify 21 reais por mês'."
        }]);
      }
    } catch (err: any) {
      setGenerationStatus('idle');
      const msg = err?.message || "";
      let errorResponse = "Tive um erro interno. Tente novamente.";
      if (msg.includes("MISSING_GEMINI_API_KEY")) {
        errorResponse = "Preciso que configure a API KEY do Gemini no sistema.";
      }
      setChatMessages(prev => [...prev, {
        id: Date.now().toString() + '_err',
        role: 'assistant',
        content: errorResponse
      }]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      userId: '', // Filled by service/parent logic usually
      name: formData.name,
      amount: parseFloat(formData.amount),
      billingCycle: formData.billingCycle,
      category: formData.category,
      status: formData.status
    };

    if (editingId) {
      const original = subscriptions.find(s => s.id === editingId);
      if (original) {
        onUpdateSubscription({ ...original, ...data });
      }
    } else {
      onAddSubscription(data);
    }
    handleClose();
  };

  const handleEdit = (sub: Subscription) => {
    setEditingId(sub.id);
    setFormData({
      name: sub.name,
      amount: sub.amount.toString(),
      billingCycle: sub.billingCycle,
      category: sub.category,
      status: sub.status
    });
    setModalMode('manual');
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setEditingId(null);
      setFormData({ name: '', amount: '', billingCycle: 'monthly', category: '', status: 'active' });
      setModalMode('manual');
      setAiInput('');
      setChatMessages([]);
      setGenerationStatus('idle');
      setGenerationMessage('');
    }, 300);
  };

  // Função para alternar o estado de pago no mês SELECIONADO (filterMonth)
  const handleTogglePaid = (sub: Subscription) => {
    const paidMonths = sub.paidMonths || [];
    const isPaid = paidMonths.includes(filterMonth);

    const updatedPaidMonths = isPaid
      ? paidMonths.filter(m => m !== filterMonth) // Remove o mês selecionado
      : [...paidMonths, filterMonth]; // Adiciona o mês selecionado

    onUpdateSubscription({
      ...sub,
      paidMonths: updatedPaidMonths
    });
  };

  // Verifica se uma assinatura está paga no mês SELECIONADO
  const isSubscriptionPaidThisMonth = (sub: Subscription): boolean => {
    return (sub.paidMonths || []).includes(filterMonth);
  };

  // Totais baseados no estado atual (considerando o mês filtrado para status "Pago")
  const totalMonthly = useMemo(() => {
    return subscriptions
      .filter(s => s.status === 'active' && !isSubscriptionPaidThisMonth(s))
      .reduce((acc, curr) => {
        const monthlyAmount = curr.billingCycle === 'monthly' ? curr.amount : curr.amount / 12;
        return acc + monthlyAmount;
      }, 0);
  }, [subscriptions, filterMonth]);

  return (
    <div className="w-full space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in pb-10">

      {/* Header Padronizado - Responsivo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 sm:pb-4">
        {/* Título e subtítulo - Escondido em mobile (já aparece no Header) */}
        <div className="hidden sm:flex items-center gap-4">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight">Assinaturas</h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1">Gerencie seus serviços recorrentes</p>
          </div>
        </div>

        {/* Controles - Em linha para mobile */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Opções Placeholder */}
          <Dropdown className="flex items-center">
            <DropdownTrigger className="flex items-center">
              <button
                className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
                title="Opções"
              >
                <Settings size={18} className="sm:w-5 sm:h-5" />
              </button>
            </DropdownTrigger>
            <DropdownContent align="left">
              <DropdownItem icon={RefreshCw} onClick={() => setSelectionMode(true)}>
                Gerenciar Ciclos
              </DropdownItem>
            </DropdownContent>
          </Dropdown>

          {/* Month Picker - Flex grow em mobile */}
          <div className="w-auto sm:w-40 lg:w-48">
            <CustomMonthPicker
              value={filterMonth}
              onChange={setFilterMonth}
              placeholder="Mês"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#d97757] hover:bg-[#c56a4d] text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#d97757]/20 hover:shadow-[#d97757]/40 hover:-translate-y-0.5 border border-[#d97757]/50 flex-shrink-0"
          >
            <Plus size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
            <span className="hidden sm:inline font-bold text-sm">Novo</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Responsivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
        <div className="rounded-xl sm:rounded-2xl border border-[#373734] bg-[#30302E] p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 bg-[#272725] border border-[#373734] rounded-lg sm:rounded-xl text-emerald-500">
                <CreditCard size={18} className="sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest">Custo Mensal</span>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              <NumberFlow
                value={totalMonthly}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">A pagar em {filterMonth.split('-').reverse().join('/')}</p>
          </div>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-[#373734] bg-[#30302E] p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 bg-[#272725] border border-[#373734] rounded-lg sm:rounded-xl text-blue-500">
                <TrendingUp size={18} className="sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest">Estimativa Anual</span>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              <NumberFlow
                value={totalMonthly * 12}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Projeção baseada no mês atual</p>
          </div>
        </div>
      </div>

      {/* LEGENDA DE STATUS - Responsiva */}
      {subscriptions.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pb-2 sm:pb-4">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#d97757]/10 flex items-center justify-center text-[#d97757]">
              <Calendar size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
            </div>
            Suas Assinaturas
          </h3>

          {/* Legenda de cores Minimalista */}
          <div className="flex items-center gap-2 px-2 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/5 border border-white/5 group/legend backdrop-blur-sm self-start sm:self-auto">
            <Tooltip content="Ativa">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(16,185,129,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="Cancelada">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(239,68,68,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="Paga">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-gray-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(107,114,128,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
          </div>
        </div>
      )}

      {/* Lista de assinaturas */}
      {subscriptions.length === 0 ? (
        <EmptyState title="Nenhuma assinatura" description="Adicione serviços como Netflix, Spotify, etc." />
      ) : (
        <div className="animate-fade-in space-y-3">
          {subscriptions.map(sub => (
            <SubscriptionCard
              key={sub.id}
              sub={sub}
              onDelete={setDeleteId}
              onEdit={handleEdit}
              onTogglePaid={handleTogglePaid}
              isPaidThisMonth={isSubscriptionPaidThisMonth(sub)}
              filterMonth={filterMonth}
              selectionMode={selectionMode}
              selected={selectedIds.includes(sub.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))}
        </div>
      )}

      {/* NEW MINIMALIST FLOATING BOTTOM BAR (ACTIONS) */}
      {shouldRenderBottomBar && createPortal(
        <div
          className={`
                fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] 
                transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]
                ${isBottomBarVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-24 opacity-0 scale-90'}
            `}
        >
          <div className={`bg-[#30302E] border border-[#373734] shadow-2xl flex items-center px-4 py-2.5 gap-4 relative overflow-hidden transition-all duration-300 ${showBulkEditModal ? 'rounded-b-2xl rounded-t-none border-t-0 w-[420px] justify-center' : 'rounded-2xl'}`}>
            {/* Decorative Glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#d97757] rounded-full blur-3xl -mr-10 -mt-10 opacity-20 pointer-events-none"></div>

            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-[#d97757] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-lg shadow-[#d97757]/30">
                {selectedSubscriptions.length}
              </div>
              <span className="text-sm font-bold text-white">Selecionados</span>
            </div>

            <div className="flex items-center gap-2 relative z-10">
              <button
                onClick={handleSelectAll}
                className="px-3 py-2 hover:bg-[#373734] rounded-xl text-gray-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
                title="Selecionar Todos"
              >
                {allSelected ? 'Limpar' : 'Todos'}
              </button>

              <button
                onClick={() => setShowBulkEditModal(true)}
                disabled={selectedSubscriptions.length === 0}
                className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <RefreshCw size={14} strokeWidth={2.5} />
                Alterar Ciclo
              </button>

              <button
                onClick={resetBulkSelection}
                className="p-2 hover:bg-[#373734] rounded-xl text-gray-500 hover:text-red-400 transition-colors"
                title="Cancelar"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* NEW MINIMALIST BULK EDIT MODAL - CONNECTED TO BOTTOM BAR */}
      {shouldRenderCycleModal && createPortal(
        <div
          className={`
                fixed bottom-6 left-1/2 -translate-x-1/2 z-[99] w-[420px]
                transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                ${isCycleModalVisible
              ? '-translate-y-[52px] opacity-100'
              : 'translate-y-0 opacity-0 pointer-events-none'
            }
            `}
        >
          <div className="bg-[#30302E] border border-[#373734] border-b-0 rounded-t-2xl shadow-2xl relative overflow-hidden">
            {/* Decorative Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d97757] rounded-full blur-3xl -mr-10 -mt-10 opacity-10 pointer-events-none"></div>

            {/* Header */}
            <div className="px-5 pt-4 pb-2 flex justify-between items-center relative z-10">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Novo Ciclo</h3>
                <p className="text-[11px] font-medium text-gray-400">Para {selectedSubscriptions.length} itens selecionados</p>
              </div>
              <button
                onClick={() => setShowBulkEditModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#373734]/50 text-gray-400 hover:bg-[#373734] hover:text-white transition-colors"
                title="Fechar"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 pt-0 space-y-4 relative z-10">
              {/* Content - Cycle Selector */}
              <div className="pt-2">
                <CustomSelect
                  value={bulkCycle}
                  onChange={(val) => setBulkCycle(val as any)}
                  options={[
                    { value: 'monthly', label: 'Mensal' },
                    { value: 'yearly', label: 'Anual' }
                  ]}
                  icon={<RefreshCw size={16} />}
                  className="w-full text-sm"
                />
              </div>

              {/* Actions */}
              <button
                onClick={handleBulkApplyCycles}
                disabled={isApplyingBulk}
                className="w-full h-10 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold shadow-lg shadow-[#d97757]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm"
              >
                <Check size={18} strokeWidth={3} />
                Aplicar Mudanças
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Reformulada (UniversalModal) */}
      <UniversalModal
        isOpen={isModalOpen}
        onClose={handleClose}
        title={editingId ? "Editar Assinatura" : "Nova Assinatura"}
        icon={editingId ? <Edit2 size={18} /> : <Plus size={18} />}
        width="max-w-md"
        themeColor="#d97757"
        footer={
          modalMode === 'manual' || editingId ? (
            <button
              onClick={handleSubmit as any}
              className="w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm bg-[#d97757] hover:bg-[#c56a4d] text-white"
            >
              <Check size={18} strokeWidth={2.5} />
              Confirmar
            </button>
          ) : undefined
        }
      >
        <div className="space-y-5">
          {/* --- AI MODE (Chat Style) --- */}
          {modalMode === 'ai' && !editingId && (
            <>
              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar max-h-[50vh]">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                    <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-[#d97757] border-[#e68e70]' : 'bg-[#373734] border-[#4a4a47]'}`}>
                        {msg.role === 'user' ? (
                          <User size={14} className="text-white" />
                        ) : (
                          <img src={coinzinhaImg} className="w-full h-full rounded-full object-cover" alt="Coinzinha" />
                        )}
                      </div>

                      {/* Bubble */}
                      <div>
                        <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                          ? 'bg-[#d97757]/20 text-white rounded-br-none border border-[#d97757]/30'
                          : 'bg-[#373734]/50 text-gray-200 rounded-bl-none border border-[#4a4a47]/50'
                          }`}>
                          {msg.content}
                        </div>

                        {/* Subscription Summary Card */}
                        {msg.summaryData && (
                          <div className="mt-3 w-full max-w-[280px] bg-[#272725] border border-[#373734] rounded-2xl overflow-hidden shadow-xl">
                            <div className="bg-[#30302E]/80 px-4 py-2.5 border-b border-[#373734] flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#d97757]"></div>
                                Assinatura Criada
                              </span>
                            </div>
                            <div className="p-3 hover:bg-white/5 transition-colors group">
                              <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
                                    {msg.summaryData.name}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-[10px] text-gray-500 bg-[#272725] px-1.5 py-0.5 rounded flex items-center gap-1 border border-[#373734]/50">
                                      <Tag size={10} /> {msg.summaryData.category}
                                    </span>
                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                      <RefreshCw size={10} /> {msg.summaryData.billingCycle === 'monthly' ? 'Mensal' : 'Anual'}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-emerald-400">
                                    R$ {msg.summaryData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Processing Bubble */}
                {generationStatus !== 'idle' && (
                  <div className="flex w-full justify-start animate-fade-in-up">
                    <div className="flex items-end gap-2 max-w-[85%]">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-[#373734] border-[#4a4a47]">
                        <img src={coinzinhaImg} className="w-full h-full rounded-full object-cover" alt="Coinzinha" />
                      </div>
                      <div className="bg-[#373734]/50 text-gray-200 rounded-2xl rounded-bl-none border border-[#4a4a47]/50 p-3 shadow-sm flex items-center">
                        <TextShimmer className='font-medium text-sm' duration={1.5}>
                          {generationMessage}
                        </TextShimmer>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Limit Banner */}
              {isLimitReached && (
                <div className="px-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Limite de 5 mensagens atingido.
                  </span>
                  <button
                    onClick={() => onUpgrade?.()}
                    className="text-xs font-bold text-[#d97757] hover:text-[#c56a4d] transition-colors"
                  >
                    Fazer Upgrade
                  </button>
                </div>
              )}

              {/* Input Area */}
              <div className="pt-4 border-t border-gray-800/50">
                <div className="relative flex items-center gap-2">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={isLimitReached ? "Limite atingido. Use o modo manual." : "Digite sua assinatura... (ex: Netflix 55)"}
                    disabled={generationStatus !== 'idle' || isLimitReached}
                    className="flex-1 bg-gray-900/40 border border-gray-800/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gray-700 focus:bg-gray-900/60 disabled:opacity-50 transition-all placeholder-gray-600 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!aiInput.trim() || generationStatus !== 'idle' || isLimitReached}
                    className="p-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#d97757]/20"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* MANUAL FORM */}
          {(modalMode === 'manual' || editingId) && (
            <>
              {/* Nome do Serviço */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Nome do Serviço</label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                    placeholder="Ex: Netflix"
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
                      required
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Ciclo */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Ciclo</label>
                  <CustomSelect
                    value={formData.billingCycle}
                    onChange={(val) => setFormData({ ...formData, billingCycle: val as any })}
                    options={[
                      { value: 'monthly', label: 'Mensal' },
                      { value: 'yearly', label: 'Anual' }
                    ]}
                    icon={<RefreshCw size={16} />}
                    portal
                  />
                </div>
              </div>

              {/* Categoria */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Categoria</label>
                <CustomAutocomplete
                  value={formData.category}
                  onChange={(val) => setFormData({ ...formData, category: val })}
                  options={categories}
                  icon={<Tag size={16} />}
                  placeholder="Selecione ou digite..."
                  portal
                />
              </div>

              {/* Status Toggle (apenas para edição) */}
              {editingId && (
                <div className="flex items-center justify-between py-3 border-t border-gray-800/40">
                  <div className="flex items-center gap-2.5">
                    {formData.status === 'active'
                      ? <Check size={16} className="text-emerald-500" />
                      : <X size={16} className="text-red-500" />
                    }
                    <div>
                      <span className="block text-sm font-medium text-gray-300">Status</span>
                      <span className="block text-[10px] text-gray-500">
                        {formData.status === 'active' ? 'Ativa' : 'Cancelada'}
                      </span>
                    </div>
                  </div>

                  <div className="relative flex bg-gray-900 rounded-lg p-0.5 border border-gray-800 w-40">
                    <div
                      className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-300 ease-out
                        ${formData.status === 'canceled' ? 'left-0.5 bg-red-500/20' : 'left-1/2 bg-emerald-500/20'}
                      `}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'canceled' })}
                      className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${formData.status === 'canceled' ? 'text-red-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'active' })}
                      className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${formData.status === 'active' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Ativa
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </UniversalModal>

      {/* Delete Confirmation */}
      <ConfirmationBar
        isOpen={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            onDeleteSubscription(deleteId);
            setDeleteId(null);
          }
        }}
        label="Excluir Assinatura?"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isDestructive={true}
      />
    </div>
  );
};