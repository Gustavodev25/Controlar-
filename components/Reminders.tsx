import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Reminder } from '../types';
import { CalendarClock, Check, Trash2, AlertCircle, DollarSign, Tag, Calendar, getCategoryIcon, X, LayoutDashboard, Table2, FileText, Sparkles, Plus, Bot, ArrowRight, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Edit2, Send, User, Clock } from './Icons';
import { CustomSelect, CustomDatePicker, ConfirmationCard, CustomAutocomplete, TextShimmer } from './UIComponents';
import { parseReminderFromText, AIParsedReminder, parseMessageIntent } from '../services/geminiService';
import { EmptyState } from './EmptyState';
import coinzinhaImg from '../assets/coinzinha.png';
import { CoinzinhaGreeting } from './CoinzinhaGreeting';
import NumberFlow from '@number-flow/react';
import { toLocalISODate } from '../utils/dateUtils';
import { CheckSquare, Square, Settings } from 'lucide-react';

interface RemindersProps {
  reminders: Reminder[];
  onAddReminder: (reminder: Omit<Reminder, 'id'>) => void;
  onDeleteReminder: (id: string) => void;
  onPayReminder: (reminder: Reminder) => void;
  onUpdateReminder: (reminder: Reminder) => void;
  onOpenAIModal?: (context?: 'transaction' | 'reminder') => void;
}

type ViewMode = 'list' | 'grouped';
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

// --- COMPONENTE DO CARD DE LEMBRETE (Visual Atualizado) ---
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
    barColor: "bg-gray-600",
    iconBg: "bg-gray-800 text-gray-400",
    statusText: "No Prazo",
    textColor: "text-gray-400",
    glowColor: "bg-gray-500" // Cor para o efeito de fundo
  };

  if (daysDiff < 0) {
    statusConfig = {
      barColor: "bg-red-500",
      iconBg: "bg-red-500/10 text-red-500",
      statusText: `Venceu há ${Math.abs(daysDiff)} dias`,
      textColor: "text-red-400",
      glowColor: "bg-red-500"
    };
  } else if (daysDiff === 0) {
    statusConfig = {
      barColor: "bg-amber-500",
      iconBg: "bg-amber-500/10 text-amber-500",
      statusText: "Vence Hoje",
      textColor: "text-amber-400",
      glowColor: "bg-amber-500"
    };
  } else if (daysDiff <= 3) {
    statusConfig = {
      barColor: "bg-[#d97757]",
      iconBg: "bg-[#d97757]/10 text-[#d97757]",
      statusText: `Vence em ${daysDiff} dias`,
      textColor: "text-[#d97757]",
      glowColor: "bg-[#d97757]"
    };
  }

  // Override for Income
  if (item.type === 'income') {
    statusConfig = {
      barColor: "bg-emerald-500",
      iconBg: "bg-emerald-500/10 text-emerald-500",
      statusText: daysDiff < 0 ? "Recebimento Atrasado" : "A Receber",
      textColor: "text-emerald-400",
      glowColor: "bg-emerald-500"
    };
  }

  return (
    <div
      className={`
        bg-gray-950 rounded-xl p-4 border hover:border-gray-700 transition-all group relative overflow-hidden shadow-lg shadow-black/20
        ${selected ? 'border-[#d97757]/70 ring-2 ring-[#d97757]/30' : 'border-gray-800'}
        ${selectionMode ? 'cursor-pointer' : ''}
      `}
      onClick={selectionMode ? () => onToggleSelect && onToggleSelect(item.id) : undefined}
    >
      {/* Luz de fundo decorativa suave */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none ${statusConfig.glowColor}`}></div>

      {selectionMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(item.id); }}
          className={`absolute top-1/2 -translate-y-1/2 right-4 w-9 h-9 rounded-xl border transition-all duration-300 flex items-center justify-center z-20 active:scale-90 group-hover/btn:scale-110 ${selected
            ? 'bg-[#d97757]/20 border-[#d97757]/50 text-[#d97757]'
            : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-[#d97757]/50 hover:text-[#d97757]'
            }`}
          title={selected ? 'Remover da seleção' : 'Selecionar'}
        >
          {selected ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-circle-dashed-check animate-scale-in">
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M8.56 3.69a9 9 0 0 0 -2.92 1.95" />
              <path d="M3.69 8.56a9 9 0 0 0 -.69 3.44" />
              <path d="M3.69 15.44a9 9 0 0 0 1.95 2.92" />
              <path d="M8.56 20.31a9 9 0 0 0 3.44 .69" />
              <path d="M15.44 20.31a9 9 0 0 0 2.92 -1.95" />
              <path d="M20.31 15.44a9 9 0 0 0 .69 -3.44" />
              <path d="M20.31 8.56a9 9 0 0 0 -1.95 -2.92" />
              <path d="M15.44 3.69a9 9 0 0 0 -3.44 -.69" />
              <path d="M9 12l2 2l4 -4" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-circle-dashed transition-transform duration-300 hover:rotate-90">
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M8.56 3.69a9 9 0 0 0 -2.92 1.95" />
              <path d="M3.69 8.56a9 9 0 0 0 -.69 3.44" />
              <path d="M3.69 15.44a9 9 0 0 0 1.95 2.92" />
              <path d="M8.56 20.31a9 9 0 0 0 3.44 .69" />
              <path d="M15.44 20.31a9 9 0 0 0 2.92 -1.95" />
              <path d="M20.31 15.44a9 9 0 0 0 .69 -3.44" />
              <path d="M20.31 8.56a9 9 0 0 0 -1.95 -2.92" />
              <path d="M15.44 3.69a9 9 0 0 0 -3.44 -.69" />
            </svg>
          )}
        </button>
      )}
      <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
        {/* Ícone */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5 shadow-inner ${statusConfig.iconBg}`}>
          {item.type === 'income' ? <TrendingUp size={20} /> : (daysDiff < 0 ? <AlertCircle size={20} /> : <CalendarClock size={20} />)}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 w-full min-w-0 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
            <h4 className="font-bold text-gray-100 text-base truncate">{item.description}</h4>
            {item.isRecurring && (
              <span className="text-[9px] px-1.5 py-0.5 bg-gray-900 text-gray-500 rounded border border-gray-800 uppercase tracking-wider font-bold flex items-center gap-1">
                <RefreshCw size={8} /> Auto
              </span>
            )}
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5 bg-gray-900/50 px-2 py-1 rounded-md border border-gray-800/50">
              {getCategoryIcon(item.category, 12)} {item.category}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-gray-400">
              <Calendar size={12} /> {formatDate(item.dueDate)}
            </span>
          </div>
        </div>

        {/* Valores e Ações */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-6 border-t border-gray-800/50 pt-3 sm:pt-0 sm:border-t-0">
          <div className="text-right flex-1 sm:flex-auto">
            <p className={`font-mono font-bold text-lg ${item.type === 'income' ? 'text-emerald-400' : 'text-gray-200'}`}>
              {item.type === 'income' ? '+' : '-'} <NumberFlow value={item.amount} format={{ style: 'currency', currency: 'BRL' }} locales="pt-BR" />
            </p>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${statusConfig.textColor}`}>
              {statusConfig.statusText}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); if (!selectionMode) onPayReminder(item); }}
              disabled={selectionMode}
              className={`w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900 hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400 border border-gray-800 hover:border-emerald-500/30 transition-all ${selectionMode ? 'opacity-40 cursor-not-allowed hover:bg-gray-900 hover:text-gray-500 hover:border-gray-800' : ''}`}
              title={item.type === 'income' ? "Confirmar Recebimento" : "Pagar"}
            >
              <Check size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (!selectionMode) onEdit(item); }}
              disabled={selectionMode}
              className={`w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900 hover:bg-[#d97757]/10 text-gray-500 hover:text-[#d97757] border border-gray-800 hover:border-[#d97757]/30 transition-all ${selectionMode ? 'opacity-40 cursor-not-allowed hover:bg-gray-900 hover:text-gray-500 hover:border-gray-800' : ''}`}
              title="Editar"
            >
              <Edit2 size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (!selectionMode) onConfirmDelete(item.id); }}
              disabled={selectionMode}
              className={`w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900 hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-gray-800 hover:border-red-500/30 transition-all ${selectionMode ? 'opacity-40 cursor-not-allowed hover:bg-gray-900 hover:text-gray-500 hover:border-gray-800' : ''}`}
              title="Excluir"
            >
              <Trash2 size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Reminders: React.FC<RemindersProps> = ({ reminders, onAddReminder, onDeleteReminder, onPayReminder, onUpdateReminder, onOpenAIModal }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
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
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

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
  const selectionButtonRef = useRef<HTMLButtonElement>(null);

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
  };
  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [reminders]);
  const groupedReminders = useMemo(() => {
    return reminders.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = [];
      acc[curr.category].push(curr);
      return acc;
    }, {} as Record<string, Reminder[]>);
  }, [reminders]);
  const selectedReminders = useMemo(() => {
    return reminders.filter((r) => selectedIds.includes(r.id));
  }, [reminders, selectedIds]);
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

      {/* HEADER PADRONIZADO */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Lembretes</h2>
            <p className="text-gray-400 text-sm mt-1">Organize seus lembretes</p>
          </div>

          {/* Balloon Hint */}
          <div className="hidden md:block animate-fade-in ml-2">
            <div className="relative bg-blue-500/10 border border-blue-500/20 rounded-lg py-2 px-3 ">
              {/* Arrow */}
              <div className="absolute top-1/2 -left-[5px] -translate-y-1/2 w-2.5 h-2.5 bg-gray-950 border-l border-b border-blue-500/20 rotate-45"></div>

              <p className="text-[11px] text-blue-200 leading-snug relative z-10">
                <span className="font-bold text-blue-400">Dica:</span> Veja o impacto no saldo clicando em <strong>"Previsão dos lembretes"</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              ref={selectionButtonRef}
              onClick={() => setIsOptionsOpen(!isOptionsOpen)}
              className={`p-2 rounded-lg transition-colors ${isOptionsOpen ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800/50'}`}
              title="Opções"
            >
              <Settings size={20} />
            </button>

            {isOptionsOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsOptionsOpen(false)}
                ></div>
                <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 p-1 animate-dropdown-open">
                  <button
                    onClick={() => {
                      setSelectionMode(true);
                      setIsOptionsOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors text-sm text-gray-300 hover:text-white group"
                  >
                    <CalendarClock size={16} className="text-gray-500 group-hover:text-[#d97757] transition-colors" />
                    Alterar datas em massa
                  </button>
                </div>
              </>
            )}
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

      {/* QUICK STATS CARDS - VISUAL IGUAL CONFIRMATION CARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card Despesas */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 flex flex-col justify-between">

          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-red-500 ">
                <TrendingDown size={20} />
              </div>
              <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">A Pagar (Mes)</span>
            </div>
          </div>
          <div className="">
            <p className="text-3xl font-bold text-white tracking-tight">
              <NumberFlow
                value={reminders.filter(r => (!r.type || r.type === 'expense')).reduce((acc, curr) => acc + curr.amount, 0)}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
            <p className="text-xs text-gray-500 mt-1">Total de despesas agendadas</p>
          </div>
        </div>

        {/* Card Receitas */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 flex flex-col justify-between">

          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-emerald-500 ">
                <TrendingUp size={20} />
              </div>
              <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">A Receber (Mes)</span>
            </div>
          </div>
          <div className="">
            <p className="text-3xl font-bold text-white tracking-tight">
              <NumberFlow
                value={reminders.filter(r => r.type === 'income').reduce((acc, curr) => acc + curr.amount, 0)}
                format={{ style: 'currency', currency: 'BRL' }}
                locales="pt-BR"
              />
            </p>
            <p className="text-xs text-gray-500 mt-1">Total de receitas agendadas</p>
          </div>
        </div>
      </div>

      {/* VIEW TOGGLE */}
      {reminders.length > 0 && (
        <div className="flex justify-between items-end border-b border-gray-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar size={18} className="text-[#d97757]" /> Próximos Lembretes
          </h3>
          <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              title="Lista"
            >
              <Table2 size={18} />
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grouped' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              title="Agrupar"
            >
              <LayoutDashboard size={18} />
            </button>
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
        <div className="animate-fade-in">
          {viewMode === 'list' ? (
            <div className="space-y-3">
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
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedReminders).map(([category, items]: [string, Reminder[]]) => (
                <div key={category} className="bg-gray-950/50 border border-gray-800/50 rounded-2xl overflow-hidden">
                  <div className="bg-gray-900/80 p-4 border-b border-gray-800 flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-gray-800 text-gray-400 border border-gray-700">
                      {getCategoryIcon(category, 16)}
                    </div>
                    <h4 className="text-sm font-bold text-gray-200 uppercase tracking-wide">{category}</h4>
                    <span className="text-[10px] bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full ml-auto font-mono">{items.length}</span>
                  </div>
                  <div className="p-3 space-y-3">
                    {items.map(item => (
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
                </div>
              ))}
            </div>
          )}
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
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-800 
                flex flex-col max-h-[90vh] relative 
                transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
          `}>

            {/* Background Glow igual ao ConfirmationCard */}
            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 ${modalMode === 'ai' ? 'bg-[#d97757]' : 'bg-gray-600'}`} />

            {/* Header Modal */}
            {/* Header Modal - Tabs Redesenhadas */}
            <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
              {!editingReminder ? (
                <div className="relative flex bg-gray-900/60 p-1 rounded-xl">
                  {/* Indicador animado que desliza */}
                  <div
                    className="absolute top-1 bottom-1 bg-[#d97757] rounded-lg transition-all duration-300 ease-out shadow-lg shadow-[#d97757]/25"
                    style={{
                      width: 'calc(50% - 2px)',
                      left: modalMode === 'ai' ? '4px' : 'calc(50% + 2px)',
                    }}
                  />

                  <button
                    onClick={() => setModalMode('ai')}
                    className={`relative z-10 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center gap-2 min-w-[110px] justify-center ${modalMode === 'ai'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-300'
                      }`}
                  >
                    <img
                      src={coinzinhaImg}
                      className={`w-4 h-4 rounded-full object-cover transition-all duration-300 ${modalMode === 'ai' ? 'ring-2 ring-white/30' : 'opacity-60'}`}
                      alt="Coinzinha"
                    />
                    Coinzinha
                  </button>
                  <button
                    onClick={() => setModalMode('manual')}
                    className={`relative z-10 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center gap-2 min-w-[110px] justify-center ${modalMode === 'manual'
                      ? 'text-white'
                      : 'text-gray-500 hover:text-gray-300'
                      }`}
                  >
                    <Plus size={14} className={`transition-transform duration-300 ${modalMode === 'manual' ? 'rotate-0' : 'rotate-90'}`} />
                    Manual
                  </button>
                </div>
              ) : (
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Edit2 size={16} className="text-[#d97757]" />
                  Editar Lembrete
                </h3>
              )}
              <button onClick={handleClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800/50 rounded-lg transition-all">
                <X size={18} />
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-[#d97757] border-[#e68e70]' : 'bg-gray-800 border-gray-700'}`}>
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
                              : 'bg-gray-800/50 text-gray-200 rounded-bl-none border border-gray-700/50'
                              }`}>
                              {msg.content}
                            </div>

                            {/* Reminder Summary Card */}
                            {msg.summaryData && msg.summaryData.length > 0 && (
                              <div className="mt-3 w-full max-w-[280px] bg-[#1a1a1a] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                                <div className="bg-gray-900/80 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#d97757]"></div>
                                    {msg.summaryData.length === 1 ? 'Lembrete Criado' : `${msg.summaryData.length} Lembretes`}
                                  </span>
                                </div>
                                <div className="divide-y divide-gray-800/50">
                                  {msg.summaryData.map((r, idx) => (
                                    <div key={idx} className="p-3 hover:bg-white/5 transition-colors group">
                                      <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
                                            {r.description}
                                          </p>
                                          <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded flex items-center gap-1 border border-gray-700/50">
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
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-gray-800 border-gray-700">
                            <img src={coinzinhaImg} className="w-full h-full rounded-full object-cover" alt="Coinzinha" />
                          </div>
                          <div className="bg-gray-800/50 text-gray-200 rounded-2xl rounded-bl-none border border-gray-700/50 p-3 shadow-sm flex items-center">
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
                  <div className="p-4 bg-gray-950/50 border-t border-gray-800/50 shrink-0">
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
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 disabled:opacity-50 transition-all placeholder-gray-600"
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
                <form onSubmit={handleManualSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5 animate-fade-in">

                  {/* Tipo Segmentado - Mais compacto */}
                  <div className="flex p-1 bg-gray-900/50 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setNewReminder({ ...newReminder, type: 'expense' })}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${newReminder.type === 'expense' ? 'bg-red-500/90 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <TrendingDown size={14} /> Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewReminder({ ...newReminder, type: 'income' })}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${newReminder.type === 'income' ? 'bg-emerald-500/90 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <TrendingUp size={14} /> Receita
                    </button>
                  </div>

                  {/* Descrição - Mais clean */}
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
                        placeholder={newReminder.type === 'income' ? "Ex: Salário" : "Ex: Internet"}
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
                          value={newReminder.amount}
                          onChange={e => setNewReminder({ ...newReminder, amount: e.target.value })}
                          className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                          placeholder="0,00"
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
                    />
                  </div>

                  {/* Recorrência - Mais sutil */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-800/40">
                    <div className="flex items-center gap-2.5">
                      <RefreshCw size={15} className={`transition-colors ${newReminder.isRecurring ? 'text-[#d97757]' : 'text-gray-600'}`} />
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
                      <div className="w-10 h-5 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-500 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#d97757] peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  {newReminder.isRecurring && (
                    <div className="animate-fade-in -mt-2">
                      <CustomSelect
                        value={newReminder.frequency}
                        onChange={(val) => setNewReminder({ ...newReminder, frequency: val as any })}
                        options={frequencies}
                        className="text-sm"
                        placeholder="Selecione a frequência"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className={`w-full py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${newReminder.type === 'income'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                      : 'bg-[#d97757] hover:bg-[#e08868] text-white'
                      }`}
                  >
                    <Check size={18} strokeWidth={2.5} />
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
          <div className="bg-gray-950 border border-gray-800 shadow-2xl rounded-2xl flex items-center p-2 gap-4 relative overflow-hidden">
            {/* Decorative Glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#d97757] rounded-full blur-3xl -mr-10 -mt-10 opacity-20 pointer-events-none"></div>

            <div className="pl-4 pr-2 flex items-center gap-3 border-r border-gray-800 relative z-10">
              <div className="bg-[#d97757] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-[#d97757]/30">
                {selectedReminders.length}
              </div>
              <span className="text-sm font-bold text-white">Selecionados</span>
            </div>

            <div className="flex items-center gap-1 relative z-10">
              <button
                onClick={handleSelectAll}
                className="p-2 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
                title="Selecionar Todos"
              >
                {allSelected ? 'Limpar' : 'Todos'}
              </button>

              <div className="w-px h-6 bg-gray-800 mx-1"></div>

              <button
                onClick={() => setShowBulkEditModal(true)}
                disabled={selectedReminders.length === 0}
                className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5"
              >
                <Calendar size={14} strokeWidth={2.5} />
                Alterar Data
              </button>

              <button
                onClick={resetBulkSelection}
                className="p-2 hover:bg-gray-800 rounded-xl text-gray-500 hover:text-red-400 transition-colors ml-1"
                title="Cancelar"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* NEW MINIMALIST BULK EDIT MODAL - FLOATING CARD */}
      {shouldRenderDateModal && createPortal(
        <div
          className={`
                fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] w-max max-w-[90vw]
                transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-bottom
                ${isDateModalVisible ? '-translate-y-[84px] opacity-100 scale-100' : 'translate-y-0 opacity-0 scale-95'}
            `}
        >
          <div className="bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl relative overflow-hidden w-[340px]">
            {/* Decorative Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d97757] rounded-full blur-3xl -mr-10 -mt-10 opacity-20 pointer-events-none"></div>

            {/* Header */}
            <div className="px-5 pt-5 pb-2 flex justify-between items-center relative z-10">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Nova Data</h3>
                <p className="text-[11px] font-medium text-gray-400">Para {selectedReminders.length} itens selecionados</p>
              </div>
              <button
                onClick={() => setShowBulkEditModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 pt-2 space-y-5 relative z-10">
              {/* Content - Single Date Picker only */}
              <CustomDatePicker
                value={bulkDate}
                onChange={setBulkDate}
                className="w-full text-sm"
                dropdownMode="relative"
              />

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

      {/* Delete Confirmation (Mantendo seu card original) */}
      <ConfirmationCard
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && onDeleteReminder(deleteId)}
        title="Excluir Lembrete?"
        description="Esta ação removerá o lembrete da sua agenda permanentemente."
        isDestructive={true}
        confirmText="Sim, excluir"
        cancelText="Cancelar"
      />
    </div>
  );
};
