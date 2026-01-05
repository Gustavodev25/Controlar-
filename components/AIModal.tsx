import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Plus, Calendar, DollarSign, Tag, FileSpreadsheet, Check, ArrowRight, Clock, Send, User, RefreshCw, TrendingUp, TrendingDown, FileText, AlertCircle } from './Icons';
import { UniversalModal } from './UniversalModal';
import { parseMessageIntent, AIParsedReminder } from '../services/claudeService';
import { AIParsedTransaction, Transaction, Reminder } from '../types';
import { CustomAutocomplete, CustomDatePicker, TextShimmer, CustomSelect } from './UIComponents';
import coinzinhaImg from '../assets/coinzinha.png';
import { toLocalISODate } from '../utils/dateUtils';
import { useCategoryTranslation } from '../hooks/useCategoryTranslation';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: Omit<Transaction, 'id'>) => void;
  onCreateReminder?: (data: Omit<Reminder, 'id'>) => void;
  initialContext?: 'transaction' | 'reminder';
  userPlan?: 'starter' | 'pro' | 'family';
  onUpgrade?: () => void;
  userId?: string;
}

type Mode = 'ai' | 'manual';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  summaryData?: (AIParsedTransaction | AIParsedReminder)[];
  summaryType?: 'transaction' | 'reminder';
}

const TransactionSummaryCard: React.FC<{ items: (AIParsedTransaction | AIParsedReminder)[]; type?: 'transaction' | 'reminder' }> = ({ items, type = 'transaction' }) => {
  const totalAmount = items.reduce((acc, t) => acc + (t.type === 'expense' ? -t.amount : t.amount), 0);
  const isMultiple = items.length > 1;

  const getDate = (item: any) => item.date || item.dueDate;

  return (
    <div className="mt-3 w-full max-w-[280px] bg-[#1a1a1a] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-gray-900/80 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#d97757]"></div>
          {isMultiple ? `${items.length} ${type === 'reminder' ? 'Lembretes' : 'Lançamentos'}` : (type === 'reminder' ? 'Lembrete Criado' : 'Lançamento Criado')}
        </span>
        <span className="text-[10px] text-gray-600 font-mono">
          #{Math.random().toString(36).substr(2, 6).toUpperCase()}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-800/50">
        {items.map((t, idx) => (
          <div key={idx} className="p-3 hover:bg-white/5 transition-colors group">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
                  {t.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded flex items-center gap-1 border border-gray-700/50">
                    <Tag size={10} /> {t.category}
                  </span>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Calendar size={10} /> {getDate(t).split('-').reverse().slice(0, 2).join('/')}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.type === 'expense' ? '- ' : '+ '}
                  R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                {(t as any).installments && (t as any).installments > 1 && (
                  <span className="text-[10px] text-gray-500 flex items-center justify-end gap-1 mt-0.5">
                    <Clock size={10} /> {(t as any).installments}x
                  </span>
                )}
                {(t as any).isRecurring && (
                  <span className="text-[10px] text-gray-500 flex items-center justify-end gap-1 mt-0.5">
                    <Clock size={10} /> Recorrente
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Total (Only if multiple) */}
      {isMultiple && (
        <div className="bg-gray-900/50 px-4 py-3 border-t border-gray-800 flex justify-between items-center">
          <span className="text-xs text-gray-400 font-medium">Balanço Total</span>
          <span className={`text-sm font-bold ${totalAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            R$ {Math.abs(totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
};

export const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, onConfirm, onCreateReminder, initialContext = 'transaction', userPlan = 'starter', onUpgrade, userId }) => {
  const [mode, setMode] = useState<Mode>('ai');
  const [context, setContext] = useState<'transaction' | 'reminder'>(initialContext);

  // Limit Logic
  const [starterMessageCount, setStarterMessageCount] = useState(() => {
    const saved = localStorage.getItem('coinzinha_starter_count');
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    localStorage.setItem('coinzinha_starter_count', starterMessageCount.toString());
  }, [starterMessageCount]);

  const isLimitReached = userPlan === 'starter' && starterMessageCount >= 5;

  // AI State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'success'>('idle');
  const [generationMessage, setGenerationMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Manual State
  const [manualForm, setManualForm] = useState({
    description: '',
    amount: '',
    category: 'Alimentação',
    date: toLocalISODate(),
    type: 'expense' as 'income' | 'expense',
    status: 'completed' as 'completed' | 'pending',
    isRecurring: false,
    frequency: 'monthly' as 'monthly' | 'weekly' | 'yearly'
  });

  // Animation Logic (State reset on open/close handled by useEffect)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isOpen) {
      // Sync limit from storage
      const savedCount = localStorage.getItem('coinzinha_starter_count');
      if (savedCount) setStarterMessageCount(parseInt(savedCount, 10));

      // Reset State
      setContext(initialContext);
      if (messages.length === 0) {
        const welcomeMsg = initialContext === 'reminder'
          ? 'Olá! Sou o Coinzinha. Diga o que você quer lembrar de pagar ou receber. Ex: "Luz 100 reais dia 10"'
          : 'Olá! Sou o Coinzinha. Diga o que você gastou ou recebeu, e eu anoto para você. Ex: "Almoço 30 reais hoje"';

        setMessages([{
          id: 'init',
          role: 'assistant',
          content: welcomeMsg
        }]);
      }
    } else {
      // Optional: clear state after close if needed, but keeping it potentially preserves history for session
      // If we want to reset on full close (after animation):
      timeoutId = setTimeout(() => {
        // Reset logic moved to handleClose wrapper
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isOpen, initialContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generationStatus]);



  // AI Handlers
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    if (userPlan === 'starter') {
      const currentCount = parseInt(localStorage.getItem('coinzinha_starter_count') || '0', 10);
      if (currentCount >= 5) {
        setStarterMessageCount(currentCount);
        return;
      }
      setStarterMessageCount(currentCount + 1);
    }

    const userText = input;
    setInput('');

    // Add User Message
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText
    };
    setMessages(prev => [...prev, newMessage]);

    // Start Generation Flow
    setGenerationMessage("Processando...");
    setGenerationStatus('generating');

    try {
      // Intent Detection & Parsing
      const result = await parseMessageIntent(userText);

      // Verificar se temos um resultado válido
      const hasValidData = result && (
        (result.type === 'transaction' && (result as any).data) ||
        (result.type === 'multiple_transactions' && (result as any).data && Array.isArray((result as any).data) && (result as any).data.length > 0) ||
        (result.type === 'reminder' && (result as any).data) ||
        (result.type === 'subscription' && (result as any).data)
      );


      if (hasValidData) {

        // Handle Single Transaction
        if (result.type === 'transaction') {
          const tx = result.data as AIParsedTransaction;
          let msg = "Gerando transação...";
          if (tx.isSubscription) msg = "Gerando assinatura...";
          else if (tx.installments && tx.installments > 1) msg = "Gerando parcelamento...";
          setGenerationMessage(msg);

          setTimeout(() => {
            saveTransaction(tx);
            setGenerationStatus('idle');

            setMessages(prev => [...prev, {
              id: Date.now().toString() + '_ai',
              role: 'assistant',
              content: "Pronto! Criei o lançamento.",
              summaryData: [tx],
              summaryType: 'transaction'
            }]);
          }, 1500);
        }

        // Handle Multiple Transactions
        else if (result.type === 'multiple_transactions') {
          const txs = result.data as AIParsedTransaction[];
          setGenerationMessage(`Gerando ${txs.length} transações...`);

          setTimeout(() => {
            txs.forEach(t => saveTransaction(t));
            setGenerationStatus('idle');

            setMessages(prev => [...prev, {
              id: Date.now().toString() + '_ai',
              role: 'assistant',
              content: `Pronto! Criei ${txs.length} lançamentos.`,
              summaryData: txs,
              summaryType: 'transaction'
            }]);
          }, 1500);
        }

        // Handle Single Reminder
        else if (result.type === 'reminder') {
          const rem = result.data as AIParsedReminder;
          setGenerationMessage("Gerando lembrete...");

          setTimeout(() => {
            if (onCreateReminder) {
              onCreateReminder({
                description: rem.description,
                amount: rem.amount,
                category: rem.category,
                dueDate: rem.dueDate,
                type: rem.type,
                isRecurring: rem.isRecurring,
                frequency: rem.frequency
              });
            }
            setGenerationStatus('idle');

            setMessages(prev => [...prev, {
              id: Date.now().toString() + '_ai',
              role: 'assistant',
              content: "Pronto! Criei o lembrete.",
              summaryData: [rem],
              summaryType: 'reminder'
            }]);
          }, 1500);
        }

      } else {
        setGenerationStatus('idle');
        setMessages(prev => [...prev, {
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
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_err',
        role: 'assistant',
        content: errorResponse
      }]);
    }
  };

  const saveTransaction = (parsedResult: AIParsedTransaction) => {
    const installments = parsedResult.installments || 1;

    if (installments > 1) {
      const [y, m, d] = parsedResult.date.split('-').map(Number);
      for (let i = 0; i < installments; i++) {
        const newDate = new Date(y, (m - 1) + i, d);
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, '0');
        const day = String(newDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;

        onConfirm({
          description: `${parsedResult.description} (${i + 1}/${installments})`,
          amount: parsedResult.amount,
          category: parsedResult.category,
          date: formattedDate,
          type: parsedResult.type as 'income' | 'expense',
          status: 'completed',
          accountType: 'CREDIT_CARD'
        });
      }
    } else {
      onConfirm({
        description: parsedResult.description,
        amount: parsedResult.amount,
        category: parsedResult.category,
        date: parsedResult.date,
        type: parsedResult.type as 'income' | 'expense',
        status: 'completed'
      });
    }
  };

  // Manual Handlers
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (context === 'reminder' && onCreateReminder) {
      onCreateReminder({
        description: manualForm.description,
        amount: parseFloat(manualForm.amount),
        category: manualForm.category,
        dueDate: manualForm.date,
        type: manualForm.type,
        isRecurring: manualForm.isRecurring,
        frequency: manualForm.frequency
      });
    } else {
      onConfirm({
        description: manualForm.description,
        amount: parseFloat(manualForm.amount),
        category: manualForm.category,
        date: manualForm.date,
        type: manualForm.type,
        status: manualForm.status
      });
    }
    handleClose();
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setInput('');
      setMessages([]);
      setGenerationStatus('idle');
      setGenerationMessage('');
      setManualForm({
        description: '',
        amount: '',
        category: 'Alimentação',
        date: toLocalISODate(),
        type: 'expense',
        status: 'completed',
        isRecurring: false,
        frequency: 'monthly'
      });
      setMode('ai');
    }, 300);
  };

  const { categoryMappings } = useCategoryTranslation(userId);
  const categories = React.useMemo(() => {
    if (categoryMappings.length > 0) {
      return categoryMappings.map((c) => c.displayName).sort();
    }
    return ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Salário', 'Investimentos', 'Outros'];
  }, [categoryMappings]);

  return (
    <UniversalModal
      isOpen={isOpen}
      onClose={handleClose}
      themeColor={mode === 'manual' ? (manualForm.type === 'income' ? '#10b981' : '#dc2626') : '#d97757'}
      width="max-w-lg"
      zIndex="z-[100]"
      title={
        <div className="flex gap-2 p-1 rounded-xl bg-[#373734] border border-[#4a4a47]">
          <button
            onClick={() => setMode('ai')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mode === 'ai' ? 'bg-[#d97757] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <img src={coinzinhaImg} className="w-4 h-4 rounded-full object-cover" alt="Coinzinha" />
            Coinzinha
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mode === 'manual' ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <Plus size={14} />
            Manual
          </button>
        </div>
      }
      footer={
        mode === 'ai' ? (
          <div className="relative flex items-center gap-2 w-full">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={isLimitReached ? "Limite atingido. Use o modo manual." : "Digite sua transação... (ex: Uber 20)"}
              disabled={generationStatus !== 'idle' || isLimitReached}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d97757] focus:ring-1 focus:ring-[#d97757]/50 disabled:opacity-50 transition-all placeholder-gray-600 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || generationStatus !== 'idle' || isLimitReached}
              className="p-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#d97757]/20"
            >
              <Send size={18} />
            </button>
          </div>
        ) : null
      }
    >
      {/* AI MODE Content */}
      {mode === 'ai' && (
        <div className="space-y-4">
          {messages.map((msg) => (
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

                  {/* Transaction Summary Card */}
                  {msg.summaryData && (
                    <TransactionSummaryCard items={msg.summaryData} type={msg.summaryType} />
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

          {/* Limit Banner */}
          {isLimitReached && (
            <div className="my-2 px-2 flex items-center justify-between">
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
        </div>
      )}

      {/* MANUAL MODE Content */}
      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-5 animate-fade-in min-h-[400px]">
          {/* Tipo Segmentado com Smooth */}
          <div className="relative flex p-1 bg-gray-900/50 rounded-xl">
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out"
              style={{
                left: manualForm.type === 'expense' ? '4px' : 'calc(50% + 0px)',
                backgroundColor: manualForm.type === 'expense' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)'
              }}
            />
            <button
              type="button"
              onClick={() => setManualForm({ ...manualForm, type: 'expense' })}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${manualForm.type === 'expense' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <TrendingDown size={14} /> Despesa
            </button>
            <button
              type="button"
              onClick={() => setManualForm({ ...manualForm, type: 'income' })}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${manualForm.type === 'income' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <TrendingUp size={14} /> Receita
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Descrição</label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input
                required
                type="text"
                value={manualForm.description}
                onChange={e => setManualForm({ ...manualForm, description: e.target.value })}
                placeholder="Ex: Supermercado"
                className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Valor (R$)</label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                <input
                  required
                  type="number"
                  step="0.01"
                  value={manualForm.amount}
                  onChange={e => setManualForm({ ...manualForm, amount: e.target.value })}
                  placeholder="0,00"
                  className="w-full bg-gray-900/40 border border-gray-800/60 rounded-xl text-white pl-10 pr-4 py-3 text-sm focus:border-gray-700 focus:bg-gray-900/60 outline-none transition-all placeholder-gray-600 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Data</label>
              <CustomDatePicker
                value={manualForm.date}
                onChange={(val) => setManualForm({ ...manualForm, date: val })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Categoria</label>
            <CustomAutocomplete
              value={manualForm.category}
              onChange={(val) => setManualForm({ ...manualForm, category: val })}
              options={categories}
              icon={<Tag size={16} />}
              placeholder="Selecione ou digite..."
            />
          </div>

          {/* Status Toggle (Only for transactions, not reminders context usually, but good to have) */}
          {context !== 'reminder' && (
            <div className="flex items-center justify-between py-3 border-t border-gray-800/40">
              <div className="flex items-center gap-2.5">
                {manualForm.status === 'completed'
                  ? <Check size={16} className="text-emerald-500" />
                  : <AlertCircle size={16} className="text-amber-500" />
                }
                <div>
                  <span className="block text-sm font-medium text-gray-300">Status</span>
                  <span className="block text-[10px] text-gray-500">
                    {manualForm.status === 'completed' ? 'Pago / Recebido' : 'Pendente'}
                  </span>
                </div>
              </div>

              <div className="relative flex bg-gray-900 rounded-lg p-0.5 border border-gray-800 w-48">
                <div
                  className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-300 ease-out
                  ${manualForm.status === 'pending' ? 'left-0.5 bg-amber-500/20' : 'left-1/2 bg-emerald-500/20'}
                `}
                />
                <button
                  type="button"
                  onClick={() => setManualForm({ ...manualForm, status: 'pending' })}
                  className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${manualForm.status === 'pending' ? 'text-amber-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  PENDENTE
                </button>
                <button
                  type="button"
                  onClick={() => setManualForm({ ...manualForm, status: 'completed' })}
                  className={`relative z-10 flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${manualForm.status === 'completed' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  PAGO
                </button>
              </div>
            </div>
          )}

          {context === 'reminder' && (
            <div className="pt-2 border-t border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-400 flex items-center gap-2">
                  <RefreshCw size={14} /> Recorrência
                </span>
                <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-700">
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, isRecurring: false })}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${!manualForm.isRecurring ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, isRecurring: true })}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${manualForm.isRecurring ? 'bg-[#d97757] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Sim
                  </button>
                </div>
              </div>

              {manualForm.isRecurring && (
                <div className="animate-fade-in">
                  <CustomSelect
                    value={manualForm.frequency}
                    onChange={(val) => setManualForm({ ...manualForm, frequency: val as any })}
                    options={[
                      { value: 'monthly', label: 'Mensalmente' },
                      { value: 'weekly', label: 'Semanalmente' },
                      { value: 'yearly', label: 'Anualmente' }
                    ]}
                    placeholder="Frequência"
                  />
                </div>
              )}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#d97757]/30 flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {context === 'reminder' ? 'Criar Lembrete' : 'Adicionar Transação'}
            </button>
          </div>
        </form>
      )}
    </UniversalModal>
  );
};
