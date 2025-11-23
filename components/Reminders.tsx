import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Reminder } from '../types';
import { Bell, CalendarClock, Check, Trash2, AlertCircle, DollarSign, Tag, Calendar, getCategoryIcon, X, LayoutDashboard, Table2, FileText, Clock, Sparkles, Plus, Bot, ArrowRight, TrendingUp, TrendingDown } from './Icons';
import { CustomSelect, CustomDatePicker, ConfirmationCard, CustomAutocomplete } from './UIComponents';
import { parseReminderFromText, AIParsedReminder } from '../services/geminiService';

interface RemindersProps {
  reminders: Reminder[];
  onAddReminder: (reminder: Omit<Reminder, 'id'>) => void;
  onDeleteReminder: (id: string) => void;
  onPayReminder: (reminder: Reminder) => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
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

// Shared Card Component
interface ReminderCardProps {
  item: Reminder;
  onPayReminder: (reminder: Reminder) => void;
  onConfirmDelete: (id: string) => void;
}

const ReminderCard: React.FC<ReminderCardProps> = ({ item, onPayReminder, onConfirmDelete }) => {
  const daysDiff = getDaysDiff(item.dueDate);

  // Configuração visual baseada no status
  let statusConfig = {
    borderColor: "border-gray-800",
    barColor: "bg-gray-700",
    iconColor: "text-gray-500",
    statusText: "No Prazo",
    textColor: "text-gray-400"
  };

  if (daysDiff < 0) {
    statusConfig = {
      borderColor: "border-red-900/30",
      barColor: "bg-red-500",
      iconColor: "text-red-500",
      statusText: `Venceu há ${Math.abs(daysDiff)} dias`,
      textColor: "text-red-400"
    };
  } else if (daysDiff === 0) {
    statusConfig = {
      borderColor: "border-yellow-900/30",
      barColor: "bg-yellow-500",
      iconColor: "text-yellow-500",
      statusText: "Vence Hoje",
      textColor: "text-yellow-400"
    };
  } else if (daysDiff <= 3) {
    statusConfig = {
      borderColor: "border-[#d97757]/30",
      barColor: "bg-[#d97757]",
      iconColor: "text-[#d97757]",
      statusText: `Vence em ${daysDiff} dias`,
      textColor: "text-[#d97757]"
    };
  }

  // Override for Income
  if (item.type === 'income') {
    statusConfig.barColor = "bg-green-500";
    if (daysDiff >= 0) {
      statusConfig.borderColor = "border-green-900/30";
      statusConfig.iconColor = "text-green-500";
      statusConfig.textColor = "text-green-400";
    }
  }

  return (
    <div className={`relative bg-gray-900 rounded-xl border ${statusConfig.borderColor} p-4 mb-3 flex flex-col sm:flex-row items-center gap-4 overflow-hidden hover:scale-[1.005] transition-transform duration-200`}>
      {/* Barra Lateral de Status */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusConfig.barColor}`}></div>

      {/* Ícone */}
      <div className="pl-2 hidden sm:block">
        <div className={`w-10 h-10 rounded-lg bg-gray-950 border border-gray-800 flex items-center justify-center ${statusConfig.iconColor}`}>
          {item.type === 'income' ? <TrendingUp size={18} /> : (daysDiff < 0 ? <AlertCircle size={18} /> : <CalendarClock size={18} />)}
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 w-full sm:w-auto min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-bold text-gray-200 text-base truncate">{item.description}</h4>
          {item.isRecurring && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded border border-gray-700 uppercase tracking-wider font-semibold">
              Recorrente
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            {getCategoryIcon(item.category, 14)}
            <span>{item.category}</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-1.5">
            <Calendar size={14} />
            <span className="font-mono">{formatDate(item.dueDate)}</span>
          </span>
        </div>
      </div>

      {/* Lado Direito: Valores e Ações */}
      <div className="flex items-center justify-between w-full sm:w-auto gap-6 border-t border-gray-800 pt-3 sm:pt-0 sm:border-t-0">
        <div className="text-right">
          <p className={`font-mono font-bold text-lg ${item.type === 'income' ? 'text-green-400' : 'text-gray-200'}`}>
            {item.type === 'income' ? '+' : '-'} {formatCurrency(item.amount)}
          </p>
          <p className={`text-[10px] font-bold uppercase tracking-wide ${statusConfig.textColor}`}>
            {statusConfig.statusText}
          </p>
        </div>

        <div className="flex items-center gap-2 pl-4 sm:border-l border-gray-800">
          <button
            onClick={() => onPayReminder(item)}
            className="group flex items-center justify-center w-9 h-9 rounded-lg bg-gray-800 hover:bg-green-600 text-gray-400 hover:text-white border border-gray-700 hover:border-green-500 transition-all"
            title={item.type === 'income' ? "Confirmar Recebimento" : "Marcar como Pago"}
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => onConfirmDelete(item.id)}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-red-900/20 text-gray-500 hover:text-red-400 border border-transparent hover:border-red-900/30 transition-all"
            title="Excluir"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const Reminders: React.FC<RemindersProps> = ({ reminders, onAddReminder, onDeleteReminder, onPayReminder, isModalOpen, onCloseModal }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Modal Animation & State
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('ai');

  // AI State
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [parsedReminder, setParsedReminder] = useState<AIParsedReminder | null>(null);

  const [newReminder, setNewReminder] = useState({
    description: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    category: 'Moradia',
    type: 'expense' as 'income' | 'expense',
    isRecurring: true,
    frequency: 'monthly' as 'monthly' | 'weekly' | 'yearly'
  });

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
    } else {
      setIsAnimating(false);
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isModalOpen]);

  const handleAiAnalyze = async () => {
    if (!aiInput.trim()) return;
    setIsProcessing(true);
    setAiError('');
    setParsedReminder(null);

    try {
      const result = await parseReminderFromText(aiInput);
      if (result) {
        setParsedReminder(result);
      } else {
        setAiError("Não entendi o lembrete. Tente: 'Conta de luz 150 reais dia 10'");
      }
    } catch (e) {
      setAiError("Erro de conexão com a IA.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAi = () => {
    if (parsedReminder) {
      onAddReminder({
        description: parsedReminder.description,
        amount: parsedReminder.amount,
        dueDate: parsedReminder.dueDate,
        category: parsedReminder.category,
        type: parsedReminder.type || 'expense',
        isRecurring: parsedReminder.isRecurring,
        frequency: parsedReminder.frequency
      });
      handleClose();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddReminder({
      description: newReminder.description,
      amount: parseFloat(newReminder.amount),
      dueDate: newReminder.dueDate,
      category: newReminder.category,
      type: newReminder.type,
      isRecurring: newReminder.isRecurring,
      frequency: newReminder.frequency
    });
    handleClose();
  };

  const handleClose = () => {
    onCloseModal();
    setTimeout(() => {
      setNewReminder({
        description: '',
        amount: '',
        dueDate: new Date().toISOString().split('T')[0],
        category: 'Moradia',
        type: 'expense',
        isRecurring: true,
        frequency: 'monthly'
      });
      setModalMode('ai');
      setAiInput('');
      setParsedReminder(null);
      setAiError('');
    }, 300);
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

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-sm flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-red-500/10 rounded-lg text-red-500">
                <TrendingDown size={16} />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">A Pagar (Mês)</span>
            </div>
            <h3 className="text-3xl font-bold text-[#faf9f5]">
              {formatCurrency(reminders.filter(r => (!r.type || r.type === 'expense')).reduce((acc, curr) => acc + curr.amount, 0))}
            </h3>
            <p className="text-sm text-gray-400">Despesas Previstas</p>
          </div>
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-red-500/5 to-transparent"></div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-sm flex items-center justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-green-500/10 rounded-lg text-green-500">
                <TrendingUp size={16} />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">A Receber (Mês)</span>
            </div>
            <h3 className="text-3xl font-bold text-[#faf9f5]">
              {formatCurrency(reminders.filter(r => r.type === 'income').reduce((acc, curr) => acc + curr.amount, 0))}
            </h3>
            <p className="text-sm text-gray-400">Receitas Previstas</p>
          </div>
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-green-500/5 to-transparent"></div>
        </div>
      </div>

      {/* Reminders List Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-800 pb-4 gap-4">
        <h3 className="text-lg font-bold text-gray-200 px-1 flex items-center gap-2">
          <CalendarClock className="text-[#d97757]" size={20} />
          Agenda Financeira
        </h3>

        {/* View Toggles */}
        {reminders.length > 0 && (
          <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
              title="Visualizar em Lista"
            >
              <Table2 size={16} />
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grouped' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
              title="Agrupar por Categoria"
            >
              <LayoutDashboard size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Reminders Content */}
      {sortedReminders.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center h-64 animate-fade-in">
          <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6 text-[#d97757] shadow-inner border border-gray-700/50">
            <Bell size={32} />
          </div>
          <h4 className="text-white font-bold text-lg mb-2">Tudo em dia!</h4>
          <p className="text-gray-500 text-sm max-w-xs">Você não tem nenhum item agendado.</p>
        </div>
      ) : (
        <div className="animate-fade-in overflow-visible">
          {viewMode === 'list' ? (
            <div className="space-y-2">
              {sortedReminders.map(item => (
                <ReminderCard
                  key={item.id}
                  item={item}
                  onPayReminder={onPayReminder}
                  onConfirmDelete={setDeleteId}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedReminders).map(([category, items]: [string, Reminder[]]) => (
                <div key={category} className="bg-gray-900/30 rounded-2xl p-4 border border-gray-800/50">
                  <div className="flex items-center gap-2 mb-4 px-2">
                    <div className="p-1.5 bg-gray-800 rounded text-gray-400">
                      {getCategoryIcon(category, 16)}
                    </div>
                    <h4 className="font-bold text-gray-300">{category}</h4>
                    <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-500">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map(item => (
                      <ReminderCard
                        key={item.id}
                        item={item}
                        onPayReminder={onPayReminder}
                        onConfirmDelete={setDeleteId}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Redesigned Modal matching AIModal aesthetics with high Z-index and dark background */}
      {isVisible && createPortal(
        <div
          className={`
                fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ease-in-out
                ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}
            `}
        >
          <div
            className={`
                bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-visible border border-gray-800 flex flex-col max-h-[90vh] relative transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
            `}
          >
            {/* Background Effects */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
            </div>

            {/* Header - Tabbed Switcher matching AIModal */}
            <div className="p-5 border-b border-gray-800/50 flex justify-between items-center relative z-10">
              <div className="flex gap-2 bg-gray-900/50 p-1 rounded-xl border border-gray-700/50 backdrop-blur-md">
                <button
                  onClick={() => setModalMode('ai')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${modalMode === 'ai' ? 'bg-gradient-to-r from-[#d97757] to-[#e68e70] text-white shadow-lg shadow-[#d97757]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Sparkles size={14} />
                  Inteligência
                </button>
                <button
                  onClick={() => setModalMode('manual')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${modalMode === 'manual' ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Plus size={14} />
                  Manual
                </button>
              </div>
              <button onClick={handleClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-visible custom-scrollbar relative z-10">

              {/* --- AI MODE --- */}
              {modalMode === 'ai' && (
                <div className="space-y-6 animate-fade-in">
                  {!parsedReminder ? (
                    <>
                      <div className="text-center space-y-3 py-2">
                        <div className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#d97757] to-[#e68e70] flex items-center justify-center shadow-xl shadow-[#d97757]/30 ${isProcessing ? 'animate-pulse' : ''}`}>
                          <Bot size={28} className="text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Novo Lembrete Inteligente</h3>
                        <p className="text-sm text-gray-400 max-w-xs mx-auto">
                          Ex: <span className="text-[#d97757]">"Pagar conta de internet 120 reais dia 15"</span>
                        </p>
                      </div>

                      <div className="relative group">
                        <textarea
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          placeholder="Digite aqui..."
                          className="w-full h-28 p-4 bg-gray-900/50 border border-gray-700 rounded-2xl focus:ring-2 focus:ring-[#d97757]/50 focus:border-[#d97757] resize-none text-gray-100 placeholder-gray-600 transition-all text-base"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAiAnalyze();
                            }
                          }}
                        />
                        <div className="absolute bottom-3 right-3">
                          <span className="text-[10px] text-gray-600 bg-gray-900 px-2 py-1 rounded border border-gray-800">Enter para enviar</span>
                        </div>
                      </div>

                      {aiError && (
                        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/10 p-3 rounded-xl border border-red-900/30 animate-shake">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                          {aiError}
                        </div>
                      )}

                      <button
                        onClick={handleAiAnalyze}
                        disabled={isProcessing || !aiInput.trim()}
                        className="w-full py-4 bg-white text-black hover:bg-gray-200 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                            Processando...
                          </span>
                        ) : (
                          <>
                            Processar
                            <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="space-y-6 animate-slide-up">
                      {/* Parsed Result Ticket */}
                      <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-1 border border-gray-700 shadow-2xl">
                        <div className="bg-gray-950/50 rounded-t-xl p-3 flex justify-between items-center border-b border-gray-700 border-dashed">
                          <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-[#d97757]" />
                            <span className="text-xs font-bold text-[#d97757] uppercase tracking-wider">Lembrete Entendido</span>
                          </div>
                        </div>

                        <div className="p-5 space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs text-gray-400">Descrição</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${parsedReminder.type === 'income' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                  {parsedReminder.type === 'income' ? 'Receita' : 'Despesa'}
                                </span>
                              </div>
                              <p className="text-lg font-bold text-white">{parsedReminder.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400 mb-1">Valor</p>
                              <p className={`text-2xl font-bold ${parsedReminder.type === 'income' ? 'text-green-400' : 'text-white'}`}>
                                {parsedReminder.type === 'income' ? '+' : ''} R$ {parsedReminder.amount.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-700/50">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Vencimento</p>
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-gray-400" />
                                <span className="text-sm font-medium text-gray-200">{formatDate(parsedReminder.dueDate)}</span>
                              </div>
                            </div>
                            <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-700/50">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Recorrência</p>
                              <div className="flex items-center gap-2">
                                <Clock size={14} className="text-gray-400" />
                                <span className="text-sm font-medium text-gray-200">
                                  {parsedReminder.isRecurring
                                    ? (parsedReminder.frequency === 'monthly' ? 'Mensal' : parsedReminder.frequency === 'weekly' ? 'Semanal' : 'Anual')
                                    : 'Único'
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setParsedReminder(null)}
                          className="flex-1 py-3.5 bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded-xl font-medium transition-all border border-gray-700"
                        >
                          Editar
                        </button>
                        <button
                          onClick={handleConfirmAi}
                          className="flex-[2] py-3.5 bg-green-600 text-white hover:bg-green-500 rounded-xl font-bold transition-all shadow-lg shadow-green-900/40 flex items-center justify-center gap-2"
                        >
                          <Check size={18} />
                          Confirmar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- MANUAL MODE --- */}
              {modalMode === 'manual' && (
                <form onSubmit={handleManualSubmit} className="space-y-5 animate-fade-in">

                  {/* Type Selector */}
                  <div className="grid grid-cols-2 gap-3 p-1 bg-gray-900/50 rounded-xl border border-gray-800">
                    <button
                      type="button"
                      onClick={() => setNewReminder({ ...newReminder, type: 'expense' })}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${newReminder.type === 'expense' ? 'bg-red-500 text-white shadow-lg shadow-red-900/20' : 'text-gray-400 hover:text-white'}`}
                    >
                      <TrendingDown size={16} />
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewReminder({ ...newReminder, type: 'income' })}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${newReminder.type === 'income' ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'text-gray-400 hover:text-white'}`}
                    >
                      <TrendingUp size={16} />
                      Receita
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Descrição</label>
                    <div className="relative group">
                      <FileText className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                      <input
                        required
                        type="text"
                        value={newReminder.description}
                        onChange={e => setNewReminder({ ...newReminder, description: e.target.value })}
                        className="input-primary pl-10 focus:border-[#d97757]"
                        placeholder={newReminder.type === 'income' ? "Ex: Salário Mensal" : "Ex: Conta de Internet"}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Valor (R$)</label>
                      <div className="relative group">
                        <DollarSign className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                        <input
                          required
                          type="number"
                          step="0.01"
                          value={newReminder.amount}
                          onChange={e => setNewReminder({ ...newReminder, amount: e.target.value })}
                          className="input-primary pl-10 focus:border-[#d97757]"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        {newReminder.type === 'income' ? 'Data Prevista' : 'Vencimento'}
                      </label>
                      <div className="z-30 relative group">
                        <CustomDatePicker
                          value={newReminder.dueDate}
                          onChange={(val) => setNewReminder({ ...newReminder, dueDate: val })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Categoria</label>
                      <div className="relative z-20 group">
                        <CustomAutocomplete
                          value={newReminder.category}
                          onChange={(val) => setNewReminder({ ...newReminder, category: val })}
                          options={categories}
                          icon={<Tag size={16} />}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recurrence Section styled like a card */}
                  <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800/50 space-y-3">
                    <label className="flex items-center justify-between cursor-pointer select-none group">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg transition-colors ${newReminder.isRecurring ? 'bg-[#d97757]/20 text-[#d97757]' : 'bg-gray-800 text-gray-500'}`}>
                          <Clock size={16} />
                        </div>
                        <div>
                          <span className="block text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                            {newReminder.type === 'income' ? 'Recebimento Recorrente' : 'Pagamento Recorrente'}
                          </span>
                          <span className="block text-[10px] text-gray-500">
                            {newReminder.type === 'income' ? 'Repetir este ganho automaticamente' : 'Repetir este lembrete automaticamente'}
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={newReminder.isRecurring}
                        onChange={e => setNewReminder({ ...newReminder, isRecurring: e.target.checked })}
                        className="checkbox-primary w-5 h-5"
                      />
                    </label>

                    {newReminder.isRecurring && (
                      <div className="pt-2 animate-slide-up">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Frequência</label>
                        <div className="relative z-10">
                          <CustomSelect
                            value={newReminder.frequency}
                            onChange={(val) => setNewReminder({ ...newReminder, frequency: val as any })}
                            options={frequencies}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-4 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/30 flex items-center justify-center gap-2"
                    >
                      <Check size={18} />
                      {newReminder.type === 'income' ? 'Salvar Receita' : 'Salvar Lembrete'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Card */}
      <ConfirmationCard
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && onDeleteReminder(deleteId)}
        title="Excluir Item?"
        description="Você vai parar de receber notificações para este item."
        isDestructive={true}
        confirmText="Sim, excluir"
        cancelText="Manter"
      />
    </div>
  );
};
