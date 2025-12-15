import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Reminder } from '../types';
import { CalendarClock, Check, Trash2, AlertCircle, DollarSign, Tag, Calendar, getCategoryIcon, X, LayoutDashboard, Table2, FileText, Sparkles, Plus, Bot, ArrowRight, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Edit2, Send, User, Clock, ChevronLeft, ChevronRight } from './Icons';
import { CustomSelect, CustomDatePicker, CustomAutocomplete, TextShimmer, CustomMonthPicker, Tooltip } from './UIComponents';
import { ConfirmationBar } from './ConfirmationBar';
import { parseReminderFromText, AIParsedReminder, parseMessageIntent } from '../services/geminiService';
import { EmptyState } from './EmptyState';
import coinzinhaImg from '../assets/coinzinha.png';
import { CoinzinhaGreeting } from './CoinzinhaGreeting';
import NumberFlow from '@number-flow/react';
import { toLocalISODate } from '../utils/dateUtils';
import { CheckSquare, Square, Settings } from 'lucide-react';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './Dropdown';

interface RemindersProps {
  reminders: Reminder[];
  onAddReminder: (reminder: Omit<Reminder, 'id'>) => void;
  onDeleteReminder: (id: string) => void;
  onPayReminder: (reminder: Reminder) => void;
  onUpdateReminder: (reminder: Reminder) => void;
  onOpenAIModal?: (context?: 'transaction' | 'reminder') => void;
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
        group relative bg-[#30302E] rounded-2xl border border-[#373734] overflow-hidden transition-all duration-300
        hover:border-[#4a4a47] hover:bg-[#343432]
        ${selected ? 'ring-2 ring-[#d97757] border-[#d97757]' : ''}
        ${selectionMode ? 'cursor-pointer' : ''}
      `}
      onClick={selectionMode ? () => onToggleSelect && onToggleSelect(item.id) : undefined}
    >
      {/* Conteúdo Principal */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Checkbox de seleção */}
        {selectionMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(item.id); }}
            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${selected
              ? 'bg-[#d97757] border-[#d97757] text-white'
              : 'border-gray-600 hover:border-[#d97757]'
              }`}
          >
            {selected && <Check size={14} strokeWidth={3} />}
          </button>
        )}

        {/* Indicador de status (bolinha colorida) */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusConfig.accentColor}`} />

        {/* Info Principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="font-semibold text-white text-[15px] truncate">{item.description}</h4>
            {item.isRecurring && (
              <span className="flex items-center gap-1 text-[10px] text-gray-500 bg-[#272725] px-1.5 py-0.5 rounded-md border border-[#373734]">
                <RefreshCw size={9} />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <span className="flex items-center gap-1">
              {getCategoryIcon(item.category, 11)}
              <span className="hidden sm:inline">{item.category}</span>
            </span>
            <span className="text-gray-600">•</span>
            <span className="font-mono">{formatDate(item.dueDate)}</span>
          </div>
        </div>

        {/* Valor e Status */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`font-mono font-bold text-lg tracking-tight ${statusConfig.amountColor}`}>
            <NumberFlow value={item.amount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
          </span>
          <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusConfig.badgeBg} ${statusConfig.badgeText}`}>
            {statusConfig.statusIcon}
            {statusConfig.statusText}
          </span>
        </div>

        {/* Ações - aparecem no hover */}
        <div className={`flex items-center gap-1 transition-all duration-300 ${selectionMode ? 'opacity-0 pointer-events-none w-0' : 'opacity-0 group-hover:opacity-100 -mr-2 group-hover:mr-0'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onPayReminder(item); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
            title={item.type === 'income' ? "Confirmar Recebimento" : "Marcar como Pago"}
          >
            <Check size={16} strokeWidth={2.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
            title="Editar"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmDelete(item.id); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Excluir"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};


export const Reminders: React.FC<RemindersProps> = ({ reminders, onAddReminder, onDeleteReminder, onPayReminder, onUpdateReminder, onOpenAIModal }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal Animation & State
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('ai');
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

  // Animation state for bottom bar
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(false);
  const [shouldRenderBottomBar, setShouldRenderBottomBar] = useState(false);

  const [isDateModalVisible, setIsDateModalVisible] = useState(false);
  const [shouldRenderDateModal, setShouldRenderDateModal] = useState(false);

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

  useEffect(() => {
    if (showBulkEditModal) {
      setShouldRenderDateModal(true);
      const timer = setTimeout(() => setIsDateModalVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsDateModalVisible(false);
      const timer = setTimeout(() => setShouldRenderDateModal(false), 500);
      return () => clearTimeout(timer);
    }
  }, [showBulkEditModal]);

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const categories = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Investimentos', 'Trabalho', 'Outros'];
  const frequencies = [
    { value: 'monthly', label: 'Mensalmente' },
    { value: 'weekly', label: 'Semanalmente' },
    { value: 'yearly', label: 'Anualmente' }
  ];

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isModalOpen) {
      setIsVisible(true);
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
          content: 'Olá! Sou o Coinzinha. Diga o que você quer lembrar de pagar ou receber. Ex: "Luz 100 reais dia 10"'
        }]);
      }
    } else {
      setIsAnimating(false);
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isModalOpen]);

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

      if (result && result.data && result.data.length > 0 && result.type === 'reminder') {
        const rems = result.data as AIParsedReminder[];
        setGenerationMessage(rems.length === 1 ? "Gerando lembrete..." : `Gerando ${rems.length} lembretes...`);

        setTimeout(() => {
          rems.forEach(r => {
            onAddReminder({
              description: r.description,
              amount: r.amount,
              category: r.category,
              dueDate: r.dueDate,
              type: r.type,
              isRecurring: r.isRecurring,
              frequency: r.frequency
            });
          });
          setGenerationStatus('idle');

          const replyContent = rems.length === 1 ? "Pronto! Criei o lembrete." : `Pronto! Criei ${rems.length} lembretes.`;
          setChatMessages(prev => [...prev, {
            id: Date.now().toString() + '_ai',
            role: 'assistant',
            content: replyContent,
            summaryData: rems
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
      amount: parseFloat(newReminder.amount),
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
      setModalMode('ai');
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
  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [reminders]);
  const selectedReminders = useMemo(() => {
    return reminders.filter((r) => selectedIds.includes(r.id));
  }, [reminders, selectedIds]);

  // Filtrar lembretes pelo mês selecionado
  const filteredByMonth = useMemo(() => {
    if (!filterMonth) return reminders;
    return reminders.filter(r => r.dueDate.startsWith(filterMonth));
  }, [reminders, filterMonth]);

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
    <div className="w-full space-y-8 animate-fade-in font-sans pb-10 relative">

      {/* HEADER + TIP BANNER WRAPPER (grudados) */}
      <div className="space-y-0">
        {/* HEADER PADRONIZADO */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Lembretes</h2>
              <p className="text-gray-400 text-sm mt-1">Organize seus lembretes</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Dropdown de Opções */}
            <Dropdown className="flex items-center">
              <DropdownTrigger className="flex items-center">
                <button
                  className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                  title="Opções"
                >
                  <Settings size={20} />
                </button>
              </DropdownTrigger>
              <DropdownContent align="right">
                <DropdownItem
                  icon={CalendarClock}
                  onClick={() => setSelectionMode(true)}
                >
                  Alterar datas em massa
                </DropdownItem>
              </DropdownContent>
            </Dropdown>

            {/* Month Picker no Header */}
            <div className="w-48">
              <CustomMonthPicker
                value={filterMonth}
                onChange={setFilterMonth}
                placeholder="Selecionar mês"
              />
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#d97757] hover:bg-[#c56a4d] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#d97757]/20 hover:shadow-[#d97757]/40 hover:-translate-y-0.5 border border-[#d97757]/50"
            >
              <Plus size={20} strokeWidth={2.5} />
              <span className="hidden sm:inline font-bold text-sm">Novo</span>
            </button>
          </div>
        </div>
      </div>



      {/* QUICK STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Card Despesas */}
        <div className="rounded-2xl border border-[#373734] bg-[#30302E] p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#272725] border border-[#373734] rounded-xl text-red-500">
                <TrendingDown size={20} />
              </div>
              <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">A Pagar</span>
            </div>
          </div>
          <div className="">
            <p className="text-3xl font-bold text-white tracking-tight">
              <NumberFlow
                value={totalExpenses}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
            <p className="text-xs text-gray-500 mt-1">{filteredByMonth.filter(r => (!r.type || r.type === 'expense')).length} despesas no mês</p>
          </div>
        </div>

        {/* Card Receitas */}
        <div className="rounded-2xl border border-[#373734] bg-[#30302E] p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#272725] border border-[#373734] rounded-xl text-emerald-500">
                <TrendingUp size={20} />
              </div>
              <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">A Receber</span>
            </div>
          </div>
          <div className="">
            <p className="text-3xl font-bold text-white tracking-tight">
              <NumberFlow
                value={totalIncome}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
            <p className="text-xs text-gray-500 mt-1">{filteredByMonth.filter(r => r.type === 'income').length} receitas no mês</p>
          </div>
        </div>
      </div>

      {/* LEGENDA DE STATUS */}
      {reminders.length > 0 && (
        <div className="flex justify-between items-center pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#d97757]/10 flex items-center justify-center text-[#d97757]">
              <Calendar size={18} strokeWidth={2.5} />
            </div>
            Próximos Lembretes
          </h3>

          {/* Legenda de cores Minimalista */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/5 border border-white/5 group/legend backdrop-blur-sm">
            <Tooltip content="Atrasado">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(239,68,68,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="Vence Hoje">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(245,158,11,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="Próximo a vencer">
              <div className="w-2.5 h-2.5 rounded-full bg-[#d97757] cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(217,119,87,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="No Prazo">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(107,114,128,0.6)] opacity-70 hover:opacity-100" />
            </Tooltip>
            <Tooltip content="Receita">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 cursor-help transition-all duration-300 hover:scale-125 hover:shadow-[0_0_8px_rgba(16,185,129,0.6)] opacity-70 hover:opacity-100" />
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
      {isVisible && createPortal(
        <div className={`
            fixed inset-0 z-[9999] flex items-center justify-center p-4 
            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
            ${isAnimating ? 'backdrop-blur-md bg-black/60' : 'backdrop-blur-none bg-black/0'}
        `}>
          <div className={`
                bg-[#30302E] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#373734] 
                flex flex-col max-h-[85vh] relative 
                transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>

            {/* Background Glow */}
            <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-15 ${modalMode === 'ai' ? 'bg-[#d97757]' : 'bg-gray-600'}`} />

            {/* Header Modal - Tabs Compactas */}
            <div className="px-4 py-3 border-b border-[#373734]/50 flex justify-between items-center relative z-10">
              {!editingReminder ? (
                <div className="relative flex bg-[#272725]/60 p-0.5 rounded-lg">
                  {/* Indicador animado que desliza */}
                  <div
                    className="absolute top-0.5 bottom-0.5 bg-[#d97757] rounded-md transition-all duration-300 ease-out shadow-md shadow-[#d97757]/20"
                    style={{
                      width: 'calc(50% - 2px)',
                      left: modalMode === 'ai' ? '2px' : 'calc(50% + 2px)',
                    }}
                  />

                  <button
                    onClick={() => setModalMode('ai')}
                    className={`relative z-10 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-300 flex items-center gap-1.5 min-w-[90px] justify-center ${modalMode === 'ai'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-300'
                      }`}
                  >
                    <img
                      src={coinzinhaImg}
                      className={`w-3.5 h-3.5 rounded-full object-cover transition-all duration-300 ${modalMode === 'ai' ? 'ring-1 ring-white/30' : 'opacity-60'}`}
                      alt="Coinzinha"
                    />
                    Coinzinha
                  </button>
                  <button
                    onClick={() => setModalMode('manual')}
                    className={`relative z-10 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-300 flex items-center gap-1.5 min-w-[90px] justify-center ${modalMode === 'manual'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-300'
                      }`}
                  >
                    <Plus size={12} className={`transition-transform duration-300 ${modalMode === 'manual' ? 'rotate-0' : 'rotate-90'}`} />
                    Manual
                  </button>
                </div>
              ) : (
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Edit2 size={14} className="text-[#d97757]" />
                  Editar Lembrete
                </h3>
              )}
              <button onClick={handleClose} className="text-gray-500 hover:text-white p-1.5 hover:bg-[#373734]/50 rounded-md transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Content Modal */}
            <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
              {/* --- AI MODE (Chat Style igual AIModal) --- */}
              {modalMode === 'ai' && (
                <>
                  {/* Área de mensagens */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
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

                  {/* Input Area */}
                  <div className="p-4 bg-[#272725]/50 border-t border-[#373734]/50 shrink-0">
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
                        placeholder="Digite sua transação... (ex: Uber 20)"
                        disabled={generationStatus !== 'idle'}
                        className="flex-1 bg-[#272725] border border-[#373734] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 disabled:opacity-50 transition-all placeholder-gray-600"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!aiInput.trim() || generationStatus !== 'idle'}
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
                <form onSubmit={handleManualSubmit} className="p-4 overflow-y-auto custom-scrollbar space-y-3 animate-fade-in">

                  {/* Tipo Segmentado - Compacto */}
                  <div className="flex p-0.5 bg-[#272725]/50 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setNewReminder({ ...newReminder, type: 'expense' })}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-semibold transition-all ${newReminder.type === 'expense' ? 'bg-red-500/90 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <TrendingDown size={12} /> Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewReminder({ ...newReminder, type: 'income' })}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-semibold transition-all ${newReminder.type === 'income' ? 'bg-emerald-500/90 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <TrendingUp size={12} /> Receita
                    </button>
                  </div>

                  {/* Descrição - Compacto */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Descrição</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                      <input
                        required
                        type="text"
                        value={newReminder.description}
                        onChange={e => setNewReminder({ ...newReminder, description: e.target.value })}
                        className="w-full bg-[#272725]/40 border border-[#373734]/60 rounded-lg text-white pl-9 pr-3 py-2.5 text-[13px] focus:border-[#4a4a47] focus:bg-[#272725]/60 outline-none transition-all placeholder-gray-600"
                        placeholder={newReminder.type === 'income' ? "Ex: Salário" : "Ex: Internet"}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Valor */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Valor (R$)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                        <input
                          required
                          type="number"
                          step="0.01"
                          value={newReminder.amount}
                          onChange={e => setNewReminder({ ...newReminder, amount: e.target.value })}
                          className="w-full bg-[#272725]/40 border border-[#373734]/60 rounded-lg text-white pl-9 pr-3 py-2.5 text-[13px] focus:border-[#4a4a47] focus:bg-[#272725]/60 outline-none transition-all placeholder-gray-600 font-mono"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    {/* Data */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Data</label>
                      <CustomDatePicker
                        value={newReminder.dueDate}
                        onChange={(val) => setNewReminder({ ...newReminder, dueDate: val })}
                      />
                    </div>
                  </div>

                  {/* Categoria */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Categoria</label>
                    <CustomAutocomplete
                      value={newReminder.category}
                      onChange={(val) => setNewReminder({ ...newReminder, category: val })}
                      options={categories}
                      icon={<Tag size={14} />}
                      placeholder="Selecione ou digite..."
                    />
                  </div>

                  {/* Recorrência - Compacto */}
                  <div className="flex items-center justify-between py-2 border-t border-[#373734]/30">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={13} className={`transition-colors ${newReminder.isRecurring ? 'text-[#d97757]' : 'text-gray-600'}`} />
                      <div>
                        <span className="block text-[13px] font-medium text-gray-300">Recorrência</span>
                        <span className="block text-[9px] text-gray-500">Repetir este lembrete</span>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newReminder.isRecurring}
                        onChange={e => setNewReminder({ ...newReminder, isRecurring: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-[18px] bg-[#373734] rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-500 after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#d97757] peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  {newReminder.isRecurring && (
                    <div className="animate-fade-in -mt-1">
                      <CustomSelect
                        value={newReminder.frequency}
                        onChange={(val) => setNewReminder({ ...newReminder, frequency: val as any })}
                        options={frequencies}
                        className="text-[13px]"
                        placeholder="Selecione a frequência"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className={`w-full py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-[13px] ${newReminder.type === 'income'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                      : 'bg-[#d97757] hover:bg-[#e08868] text-white'
                      }`}
                  >
                    <Check size={16} strokeWidth={2.5} />
                    {editingReminder
                      ? `Atualizar ${newReminder.type === 'income' ? 'Receita' : 'Despesa'}`
                      : `Confirmar ${newReminder.type === 'income' ? 'Receita' : 'Despesa'}`
                    }
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
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
      )}

      {/* NEW MINIMALIST BULK EDIT MODAL - CONNECTED TO BOTTOM BAR */}
      {shouldRenderDateModal && createPortal(
        <div
          className={`
                fixed bottom-6 left-1/2 -translate-x-1/2 z-[99] w-[420px]
                transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                ${isDateModalVisible
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
                <h3 className="text-base font-bold text-white tracking-tight">Nova Data</h3>
                <p className="text-[11px] font-medium text-gray-400">Para {selectedReminders.length} itens selecionados</p>
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
            onDeleteReminder(deleteId);
            setDeleteId(null);
          }
        }}
        label="Excluir Lembrete?"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        isDestructive={true}
      />
    </div>
  );
};
