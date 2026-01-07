import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Reminder } from '../types';
import { CalendarClock, Check, Trash2, AlertCircle, DollarSign, Tag, Calendar, getCategoryIcon, X, LayoutDashboard, Table2, FileText, Sparkles, Plus, Bot, ArrowRight, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Edit2, Send, User, Clock, ChevronLeft, ChevronRight } from './Icons';
import { CustomSelect, CustomDatePicker, CustomAutocomplete, TextShimmer, CustomMonthPicker, Tooltip } from './UIComponents';
import { ConfirmationBar } from './ConfirmationBar';
import { UniversalModal } from './UniversalModal';
import { parseReminderFromText, AIParsedReminder, parseMessageIntent } from '../services/claudeService';
import { EmptyState } from './EmptyState';
import coinzinhaImg from '../assets/coinzinha.png';
import { CoinzinhaGreeting } from './CoinzinhaGreeting';
import NumberFlow from '@number-flow/react';
import { toLocalISODate } from '../utils/dateUtils';
import { CheckSquare, Square, Settings } from 'lucide-react';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './Dropdown';
import { useCategoryTranslation } from '../hooks/useCategoryTranslation';

interface RemindersProps {
  reminders: Reminder[];
  onAddReminder: (reminder: Omit<Reminder, 'id'>) => void;
  onDeleteReminder: (id: string) => void;
  onPayReminder: (reminder: Reminder) => void;
  onUpdateReminder: (reminder: Reminder) => void;
  onOpenAIModal?: (context?: 'transaction' | 'reminder') => void;
  isProMode?: boolean;
  userPlan?: 'starter' | 'pro' | 'family';
  onUpgrade?: () => void;
  userId?: string;
}

type ModalMode = 'ai' | 'manual';

// Helpers
const getDaysDiff = (dateStr: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

// --- COMPONENTE DO CARD DE LEMBRETE (Design Moderno) ---
interface ReminderCardProps {
  item: Reminder;
  onPayReminder: (reminder: Reminder) => void;
  onConfirmDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}
const ReminderCard: React.FC<ReminderCardProps> = ({ item, onPayReminder, onConfirmDelete, onEdit, selectionMode = false, selected = false, onToggleSelect }) => {
  const daysDiff = getDaysDiff(item.dueDate);

  // Configuração visual baseada no status
  let statusConfig = {
    accentColor: "bg-gray-500",
    badgeBg: "bg-gray-500/10",
    badgeText: "text-gray-400",
    statusText: "No Prazo",
    statusIcon: <CalendarClock size={12} />,
    amountColor: "text-white"
  };

  if (daysDiff < 0) {
    statusConfig = {
      accentColor: "bg-red-500",
      badgeBg: "bg-red-500/10",
      badgeText: "text-red-400",
      statusText: `Atrasado ${Math.abs(daysDiff)}d`,
      statusIcon: <AlertCircle size={12} />,
      amountColor: "text-red-400"
    };
  } else if (daysDiff === 0) {
    statusConfig = {
      accentColor: "bg-amber-500",
      badgeBg: "bg-amber-500/10",
      badgeText: "text-amber-400",
      statusText: "Vence Hoje",
      statusIcon: <AlertTriangle size={12} />,
      amountColor: "text-amber-400"
    };
  } else if (daysDiff <= 3) {
    statusConfig = {
      accentColor: "bg-[#d97757]",
      badgeBg: "bg-[#d97757]/10",
      badgeText: "text-[#d97757]",
      statusText: `${daysDiff}d restantes`,
      statusIcon: <Clock size={12} />,
      amountColor: "text-white"
    };
  }

  // Override for Income
  if (item.type === 'income') {
    statusConfig = {
      accentColor: "bg-emerald-500",
      badgeBg: "bg-emerald-500/10",
      badgeText: "text-emerald-400",
      statusText: "A Receber",
      statusIcon: <TrendingUp size={12} />,
      amountColor: "text-emerald-400"
    };
  }

  return (
    <div
      className={`
        group relative bg-[#30302E] rounded-xl sm:rounded-2xl border border-[#373734] overflow-hidden transition-all duration-300
        hover:border-[#4a4a47] hover:bg-[#343432]
        ${selected ? 'ring-2 ring-[#d97757] border-[#d97757]' : ''}
        ${selectionMode ? 'cursor-pointer' : ''}
      `}
      onClick={selectionMode ? () => onToggleSelect && onToggleSelect(item.id) : undefined}
    >
      {/* Conteúdo Principal */}
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4">
        {/* Checkbox de seleção */}
        {selectionMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(item.id); }}
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
            <h4 className="font-semibold text-white text-sm sm:text-[15px] truncate">{item.description}</h4>
            {/* Badge de lembrete automático de cartão */}
            {item.isRecurring && (
              <span className="hidden sm:flex items-center gap-1 text-[10px] text-gray-500 bg-[#272725] px-1.5 py-0.5 rounded-md border border-[#373734]">
                <RefreshCw size={9} />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-[12px] text-gray-500">
            <span className="flex items-center gap-1">
              {getCategoryIcon(item.category, 10)}
              <span className="hidden sm:inline">{item.category}</span>
            </span>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <span className="font-mono text-[10px] sm:text-[12px]">{formatDate(item.dueDate)}</span>
          </div>
        </div>

        {/* Valor e Status */}
        <div className="flex flex-col items-end gap-0.5 sm:gap-1 flex-shrink-0">
          <span className={`font-mono font-bold text-base sm:text-lg tracking-tight ${statusConfig.amountColor}`}>
            <NumberFlow value={item.amount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
          </span>
          <span className={`flex items-center gap-1 text-[9px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${statusConfig.badgeBg} ${statusConfig.badgeText}`}>
            {statusConfig.statusIcon}
            <span className="hidden sm:inline">{statusConfig.statusText}</span>
          </span>
        </div>

        {/* Ações - aparecem no hover (desktop) ou parcialmente visíveis (mobile) */}
        <div className={`flex items-center gap-0.5 sm:gap-1 transition-all duration-300 ${selectionMode ? 'opacity-0 pointer-events-none w-0' : 'sm:opacity-0 sm:group-hover:opacity-100 sm:-mr-2 sm:group-hover:mr-0'}`}>
          {/* Botão de pagar - sempre visível */}
          <button
            onClick={(e) => { e.stopPropagation(); onPayReminder(item); }}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
            title={item.type === 'income' ? "Confirmar Recebimento" : "Marcar como Pago"}
          >
            <Check size={14} className="sm:w-4 sm:h-4" strokeWidth={2.5} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
            title="Editar"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmDelete(item.id); }}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};


export const Reminders: React.FC<RemindersProps> = ({ reminders, onAddReminder, onDeleteReminder, onPayReminder, onUpdateReminder, onOpenAIModal, isProMode = false, userPlan = 'starter', onUpgrade, userId }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);


  const [modalMode, setModalMode] = useState<ModalMode>('manual');
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  // AI State - Chat System (igual AIModal)
  interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    summaryData?: AIParsedReminder[];
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

  const [newReminder, setNewReminder] = useState({
    description: '',
    amount: '',
    dueDate: toLocalISODate(),
    category: '',
    type: 'expense' as 'income' | 'expense',
    isRecurring: true,
    frequency: 'monthly' as 'monthly' | 'weekly' | 'yearly'
  });
  // Seleção em massa
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<'single' | 'per-item'>('single');
  const [bulkDate, setBulkDate] = useState('');
  const [perReminderDates, setPerReminderDates] = useState<Record<string, string>>({});
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  // New States for Redesign
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

  // State para filtro de mês
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  // State para filtro de tipo (A Pagar / A Receber)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  // Animation state for bottom bar
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(false);
  const [shouldRenderBottomBar, setShouldRenderBottomBar] = useState(false);



  useEffect(() => {
    if (selectionMode) {
      setShouldRenderBottomBar(true);
      // Small delay to allow mount before triggering animation
      const timer = setTimeout(() => setIsBottomBarVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsBottomBarVisible(false);
      const timer = setTimeout(() => setShouldRenderBottomBar(false), 500);
      return () => clearTimeout(timer);
    }
  }, [selectionMode]);



  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { categoryMappings } = useCategoryTranslation(userId);
  const categories = useMemo(() => {
    if (categoryMappings.length > 0) {
      return categoryMappings.map((c) => c.displayName).sort();
    }
    return ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Investimentos', 'Trabalho', 'Outros'];
  }, [categoryMappings]);

  const frequencies = [
    { value: 'monthly', label: 'Mensalmente' },
    { value: 'weekly', label: 'Semanalmente' },
    { value: 'yearly', label: 'Anualmente' }
  ];

  useEffect(() => {
    if (isModalOpen) {
      // Sync from storage
      const savedCount = localStorage.getItem('coinzinha_starter_count');
      if (savedCount) setStarterMessageCount(parseInt(savedCount, 10));

      // Inicializar mensagem de boas-vindas do chat
      if (chatMessages.length === 0) {
        setChatMessages([{
          id: 'init',
          role: 'assistant',
          content: 'Olá! Sou o Coinzinha. Diga o que você quer lembrar de pagar ou receber. Ex: "Luz 100 reais dia 10"'
        }]);
      }
    }
  }, [isModalOpen, isProMode]);

  // Scroll automático para novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, generationStatus]);
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => reminders.some((r) => r.id === id)));
  }, [reminders]);
  useEffect(() => {
    if (!selectionMode) {
      setBulkDate('');
      setPerReminderDates({});
      setBulkMode('single');
      setIsApplyingBulk(false);
      return;
    }
    if (bulkMode === 'single' && selectedIds.length > 0 && !bulkDate) {
      const first = reminders.find((r) => r.id === selectedIds[0]);
      if (first) setBulkDate(first.dueDate);
    }
    if (bulkMode === 'per-item') {
      setPerReminderDates((prev) => {
        const next: Record<string, string> = {};
        selectedIds.forEach((id) => {
          const found = prev[id] || reminders.find((r) => r.id === id)?.dueDate;
          if (found) next[id] = found;
        });
        return next;
      });
    } else {
      setPerReminderDates((prev) => {
        const next: Record<string, string> = {};
        selectedIds.forEach((id) => {
          if (prev[id]) next[id] = prev[id];
        });
        return next;
      });
    }
  }, [selectionMode, selectedIds, bulkMode, bulkDate, reminders]);
  const handleEditClick = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setNewReminder({
      description: reminder.description,
      amount: reminder.amount.toString(),
      dueDate: reminder.dueDate,
      category: reminder.category,
      type: reminder.type || 'expense',
      isRecurring: reminder.isRecurring,
      frequency: reminder.frequency || 'monthly'
    });
    setModalMode('manual');
    setIsModalOpen(true);
  };

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
      const result = await parseMessageIntent(userText);

      // Verificar se temos um lembrete válido (result.data é um OBJETO, não array)
      if (result && result.type === 'reminder' && (result as any).data) {
        const rem = (result as any).data as AIParsedReminder;
        setGenerationMessage("Gerando lembrete...");

        setTimeout(() => {
          onAddReminder({
            description: rem.description,
            amount: rem.amount,
            category: rem.category,
            dueDate: rem.dueDate,
            type: rem.type,
            isRecurring: rem.isRecurring,
            frequency: rem.frequency
          });
          setGenerationStatus('idle');

          setChatMessages(prev => [...prev, {
            id: Date.now().toString() + '_ai',
            role: 'assistant',
            content: "Pronto! Criei o lembrete.",
            summaryData: [rem]
          }]);
        }, 1500);
      } else {
        setGenerationStatus('idle');
        setChatMessages(prev => [...prev, {
          id: Date.now().toString() + '_err',
          role: 'assistant',
          content: "Não entendi muito bem. Tente dizer o valor e o nome, por exemplo: 'Conta de luz 150 reais dia 10'."
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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reminderData = {
      description: newReminder.description,
      amount: parseFloat(newReminder.amount.replace(',', '.')),
      dueDate: newReminder.dueDate,
      category: newReminder.category,
      type: newReminder.type,
      isRecurring: newReminder.isRecurring,
      frequency: newReminder.frequency
    };

    if (editingReminder) {
      onUpdateReminder({ ...editingReminder, ...reminderData });
    } else {
      onAddReminder(reminderData);
    }
    handleClose();
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setNewReminder({
        description: '',
        amount: '',
        dueDate: toLocalISODate(),
        category: '',
        type: 'expense',
        isRecurring: true,
        frequency: 'monthly'
      });
      setEditingReminder(null);
      setModalMode('manual');
      setAiInput('');
      setChatMessages([]);
      setGenerationStatus('idle');
      setGenerationMessage('');
    }, 300);
  };
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };
  const handleSelectAll = () => {
    if (selectedIds.length === reminders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(reminders.map((r) => r.id));
    }
  };
  const resetBulkSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    setBulkDate('');
    setPerReminderDates({});
    setBulkMode('single');
    setShowBulkEditModal(false);
  };

  // Filtrar lembretes pelo mês selecionado
  // Nota: Os lembretes automáticos de cartão já vêm incluídos no prop 'reminders' do App.tsx
  const filteredByMonth = useMemo(() => {
    if (!filterMonth) return reminders;
    return reminders.filter(r => r.dueDate.startsWith(filterMonth));
  }, [reminders, filterMonth]);

  const sortedReminders = useMemo(() => {
    let result = [...filteredByMonth];
    if (filterType !== 'all') {
      result = result.filter(r => (r.type || 'expense') === filterType);
    }
    return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [filteredByMonth, filterType]);
  const selectedReminders = useMemo(() => {
    return reminders.filter((r) => selectedIds.includes(r.id));
  }, [reminders, selectedIds]);


  // Totais baseados no filtro de mês
  const totalExpenses = useMemo(() => {
    return filteredByMonth.filter(r => (!r.type || r.type === 'expense')).reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredByMonth]);

  const totalIncome = useMemo(() => {
    return filteredByMonth.filter(r => r.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredByMonth]);
  const handleBulkApplyDates = async () => {
    if (selectedReminders.length === 0) return;
    if (bulkMode === 'single' && !bulkDate) return;
    setIsApplyingBulk(true);
    try {
      const updates = selectedReminders.map((reminder) => {
        const nextDate = bulkMode === 'single' ? bulkDate : (perReminderDates[reminder.id] || reminder.dueDate);
        if (!nextDate || nextDate === reminder.dueDate) return null;
        return Promise.resolve(onUpdateReminder({ ...reminder, dueDate: nextDate }));
      }).filter((p): p is Promise<void> => !!p);
      await Promise.all(updates);
    } finally {
      setIsApplyingBulk(false);
      resetBulkSelection();
      setShowBulkEditModal(false);
    }
  };
  const allSelected = reminders.length > 0 && selectedIds.length === reminders.length;
  const applyDisabled = selectedReminders.length === 0 || (bulkMode === 'single' && !bulkDate) || isApplyingBulk;
  const selectedLabel = selectedReminders.length === 1 ? '1 item' : `${selectedReminders.length} itens`;

  return (
    <div className="w-full space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in font-sans pb-10 relative">

      {/* HEADER + TIP BANNER WRAPPER (grudados) */}
      <div className="space-y-0">
        {/* HEADER PADRONIZADO - Responsivo */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 sm:pb-4">
          {/* Título e subtítulo - Escondido em mobile (já aparece no Header) */}
          <div className="hidden sm:flex items-center gap-4">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight">Lembretes</h2>
              <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1">Organize seus lembretes</p>
            </div>
          </div>

          {/* Controles - Em linha para mobile */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Dropdown de Opções */}
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
                <DropdownItem
                  icon={CalendarClock}
                  onClick={() => setSelectionMode(true)}
                >
                  Alterar datas em massa
                </DropdownItem>
              </DropdownContent>
            </Dropdown>

            {/* Filter Type Toggles */}
            <div className="flex bg-[#272725] p-1 rounded-lg border border-[#373734] shrink-0 overflow-x-auto max-w-[200px] sm:max-w-none no-scrollbar">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${filterType === 'all' ? 'bg-[#373734] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('expense')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${filterType === 'expense' ? 'bg-red-500/10 text-red-500 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Pagar
              </button>
              <button
                onClick={() => setFilterType('income')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${filterType === 'income' ? 'bg-emerald-500/10 text-emerald-500 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Receber
              </button>
            </div>

            {/* Month Picker - Flex grow em mobile */}
            <div className="flex-1 min-w-[120px] sm:flex-none sm:w-40 lg:w-48">
              <CustomMonthPicker
                value={filterMonth}
                onChange={setFilterMonth}
                placeholder="Mês"
                portal={true}
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
      </div>



      {/* QUICK STATS CARDS - Responsivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-5">

        {/* Card Despesas */}
        <div className="rounded-xl sm:rounded-2xl border border-[#373734] bg-[#30302E] p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 bg-[#272725] border border-[#373734] rounded-lg sm:rounded-xl text-red-500">
                <TrendingDown size={18} className="sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest">A Pagar</span>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              <NumberFlow
                value={totalExpenses}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">{filteredByMonth.filter(r => (!r.type || r.type === 'expense')).length} despesas no mês</p>
          </div>
        </div>

        {/* Card Receitas */}
        <div className="rounded-xl sm:rounded-2xl border border-[#373734] bg-[#30302E] p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 bg-[#272725] border border-[#373734] rounded-lg sm:rounded-xl text-emerald-500">
                <TrendingUp size={18} className="sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest">A Receber</span>
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              <NumberFlow
                value={totalIncome}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">{filteredByMonth.filter(r => r.type === 'income').length} receitas no mês</p>
          </div>
        </div>
      </div>

      {/* LEGENDA DE STATUS - Responsiva */}
      {reminders.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pb-2 sm:pb-4">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#d97757]/10 flex items-center justify-center text-[#d97757]">
              <Calendar size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
            </div>
            Próximos Lembretes
          </h3>

          {/* Legenda de cores Minimalista */}
          <div className="flex items-center gap-2 px-2 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/5 border border-white/5 group/legend backdrop-blur-sm self-start sm:self-auto">
            <Tooltip content="Atrasado">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(239,68,68,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="Vence Hoje">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(245,158,11,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="Próximo a vencer">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#d97757] cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(217,119,87,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="No Prazo">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-gray-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(107,114,128,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="Receita">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(16,185,129,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
          </div>
        </div>
      )}
      {/* LISTA DE CONTEÚDO */}
      {sortedReminders.length === 0 ? (
        <EmptyState
          title="Tudo limpo!"
          description="Nenhum pagamento ou recebimento pendente."
        />
      ) : (
        <div className="animate-fade-in space-y-3">
          {sortedReminders.map(item => (
            <ReminderCard
              key={item.id}
              item={item}
              onPayReminder={onPayReminder}
              onConfirmDelete={setDeleteId}
              onEdit={handleEditClick}
              selectionMode={selectionMode}
              selected={selectedIds.includes(item.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))}
        </div>
      )}

      {/* --- MODAL REFORMULADA (Visual igual ConfirmationCard) --- */}
      {/* --- MODAL REFORMULADA COM UNIVERSAL MODAL --- */}
      <UniversalModal
        isOpen={isModalOpen}
        onClose={handleClose}
        title={editingReminder ? "Editar Lembrete" : "Novo Lembrete"}
        icon={editingReminder ? <Edit2 size={18} /> : <Plus size={18} />}
        width="max-w-md"
        themeColor={newReminder.type === 'income' ? '#10b981' : '#d97757'}
        footer={
          modalMode === 'manual' ? (
            <button
              onClick={handleManualSubmit as any}
              className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm ${newReminder.type === 'income'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                : 'bg-[#d97757] hover:bg-[#c56a4d] text-white'
                }`}
            >
              <Check size={18} strokeWidth={2.5} />
              Confirmar
            </button>
          ) : undefined
        }
      >
        <div className="space-y-5">
          {/* --- AI MODE (Chat Style igual AIModal) --- */}
          {modalMode === 'ai' && (
            <>
              {/* Área de mensagens */}
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

                        {/* Reminder Summary Card */}
                        {msg.summaryData && msg.summaryData.length > 0 && (
                          <div className="mt-3 w-full max-w-[280px] bg-[#272725] border border-[#373734] rounded-2xl overflow-hidden shadow-xl">
                            <div className="bg-[#30302E]/80 px-4 py-2.5 border-b border-[#373734] flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#d97757]"></div>
                                {msg.summaryData.length === 1 ? 'Lembrete Criado' : `${msg.summaryData.length} Lembretes`}
                              </span>
                            </div>
                            <div className="divide-y divide-[#373734]/50">
                              {msg.summaryData.map((r, idx) => (
                                <div key={idx} className="p-3 hover:bg-white/5 transition-colors group">
                                  <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
                                        {r.description}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="text-[10px] text-gray-500 bg-[#373734] px-1.5 py-0.5 rounded flex items-center gap-1 border border-[#4a4a47]/50">
                                          <Tag size={10} /> {r.category}
                                        </span>
                                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                          <Calendar size={10} /> {r.dueDate.split('-').reverse().slice(0, 2).join('/')}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-sm font-bold ${r.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {r.type === 'expense' ? '- ' : '+ '}
                                        R$ {r.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                      {r.isRecurring && (
                                        <span className="text-[10px] text-gray-500 flex items-center justify-end gap-1 mt-0.5">
                                          <Clock size={10} /> Recorrente
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
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
                    placeholder={isLimitReached ? "Limite atingido. Use o modo manual." : "Digite sua transação... (ex: Uber 20)"}
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

          {/* --- MANUAL MODE --- */}
          {modalMode === 'manual' && (
            <>
              {/* Tipo Segmentado com Smooth Animation */}
              <div className="relative flex p-1 bg-gray-900/50 rounded-xl">
                <div
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out"
                  style={{
                    left: newReminder.type === 'expense' ? '4px' : 'calc(50% + 0px)',
                    backgroundColor: newReminder.type === 'expense' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setNewReminder({ ...newReminder, type: 'expense' })}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${newReminder.type === 'expense' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <TrendingDown size={14} /> Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setNewReminder({ ...newReminder, type: 'income' })}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${newReminder.type === 'income' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
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
                    required
                    type="text"
                    value={newReminder.description}
                    onChange={e => setNewReminder({ ...newReminder, description: e.target.value })}
                    className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
                    placeholder={newReminder.type === 'income' ? "Ex: Salário" : "Ex: Almoço"}
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
                      type="text"
                      inputMode="decimal"
                      value={newReminder.amount}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9,.]/g, '');
                        setNewReminder({ ...newReminder, amount: val });
                      }}
                      className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Data */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Data</label>
                  <CustomDatePicker
                    value={newReminder.dueDate}
                    onChange={(val) => setNewReminder({ ...newReminder, dueDate: val })}
                  />
                </div>
              </div>

              {/* Categoria */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Categoria</label>
                <CustomAutocomplete
                  value={newReminder.category}
                  onChange={(val) => setNewReminder({ ...newReminder, category: val })}
                  options={categories}
                  icon={<Tag size={16} />}
                  placeholder="Selecione ou digite..."
                  portal
                />
              </div>

              {/* Recorrência Toggle com Smooth */}
              <div className="flex items-center justify-between py-3 border-t border-gray-800/40">
                <div className="flex items-center gap-2.5">
                  <RefreshCw size={16} className={`transition-colors ${newReminder.isRecurring ? 'text-[#d97757]' : 'text-gray-600'}`} />
                  <div>
                    <span className="block text-sm font-medium text-gray-300">Recorrência</span>
                    <span className="block text-[10px] text-gray-500">Repetir este lembrete</span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newReminder.isRecurring}
                    onChange={e => setNewReminder({ ...newReminder, isRecurring: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-gray-500 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d97757] peer-checked:after:bg-white border border-gray-700"></div>
                </label>
              </div>

              {newReminder.isRecurring && (
                <div className="animate-fade-in">
                  <CustomSelect
                    value={newReminder.frequency}
                    onChange={(val) => setNewReminder({ ...newReminder, frequency: val as any })}
                    options={frequencies}
                    className="text-sm"
                    placeholder="Selecione a frequência"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </UniversalModal>

      {/* NEW MINIMALIST FLOATING BOTTOM BAR (ACTIONS) */}
      {
        shouldRenderBottomBar && createPortal(
          <div
            className={`
                fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] 
                transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]
                ${isBottomBarVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-24 opacity-0 scale-90'}
                 w-full max-w-[420px] px-4
            `}
          >
            <div className={`bg-[#30302E] border border-[#373734] shadow-2xl flex items-center px-4 py-2.5 gap-4 relative overflow-hidden transition-all duration-300 ring-1 ring-[#373734] ${showBulkEditModal ? 'rounded-b-2xl rounded-t-none border-t-0 w-full justify-center' : 'rounded-2xl w-full'}`}>
              {/* Decorative Glow */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#d97757] rounded-full blur-3xl -mr-10 -mt-10 opacity-20 pointer-events-none"></div>

              <div className="flex items-center gap-3 relative z-10">
                <div className="bg-[#d97757] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-lg shadow-[#d97757]/30">
                  {selectedReminders.length}
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
                  disabled={selectedReminders.length === 0}
                  className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Calendar size={14} strokeWidth={2.5} />
                  Alterar Data
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
        )
      }

      {/* NEW MINIMALIST BULK EDIT MODAL - CONNECTED TO BOTTOM BAR */}
      {/* BULK EDIT MODAL WITH UNIVERSAL MODAL */}
      <UniversalModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        title="Nova Data"
        subtitle={`Para ${selectedReminders.length} itens selecionados`}
        icon={<Calendar size={20} />}
        width="max-w-sm"
      >
        <div className="space-y-4">
          {/* Content - Single Date Picker only */}
          <div className="pt-2">
            <CustomDatePicker
              value={bulkDate}
              onChange={setBulkDate}
              className="w-full text-sm"
              dropdownMode="relative"
            />
          </div>

          {/* Actions */}
          <button
            onClick={handleBulkApplyDates}
            disabled={applyDisabled}
            className="w-full h-10 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold shadow-lg shadow-[#d97757]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm"
          >
            <Check size={18} strokeWidth={3} />
            Aplicar Mudanças
          </button>
        </div>
      </UniversalModal>

      {/* Delete Confirmation */}
      <ConfirmationBar
        isOpen={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            onDeleteReminder(deleteId);
            setDeleteId(null);
          }
        }}
        label="Excluir Lembrete?"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isDestructive={true}
      />
    </div >
  );
};
