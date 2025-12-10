
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Plus, Calendar, DollarSign, Tag, FileSpreadsheet, Check, ArrowRight, Clock, Send, User, RefreshCw } from './Icons';
import { parseMessageIntent, AIParsedReminder } from '../services/geminiService';
import { AIParsedTransaction, Transaction, Reminder } from '../types';
import { CustomAutocomplete, CustomDatePicker, TextShimmer, CustomSelect } from './UIComponents';
import coinzinhaImg from '../assets/coinzinha.png';
import { toLocalISODate } from '../utils/dateUtils';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: Omit<Transaction, 'id'>) => void;
  onCreateReminder?: (data: Omit<Reminder, 'id'>) => void;
  initialContext?: 'transaction' | 'reminder';
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

export const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, onConfirm, onCreateReminder, initialContext = 'transaction' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mode, setMode] = useState<Mode>('ai');
  const [context, setContext] = useState<'transaction' | 'reminder'>(initialContext);

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
    isRecurring: false,
    frequency: 'monthly' as 'monthly' | 'weekly' | 'yearly'
  });

  // Animation Logic
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
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
      setIsAnimating(false);
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [isOpen, initialContext]);

  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generationStatus]);

  if (!isVisible) return null;

  // AI Handlers
  const handleSendMessage = async () => {
    if (!input.trim()) return;

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
      
      if (result && result.data && result.data.length > 0) {
        
        // Handle Transactions
        if (result.type === 'transaction') {
            const txs = result.data as AIParsedTransaction[];
            if (txs.length === 1) {
                let msg = "Gerando transação...";
                if (txs[0].isSubscription) msg = "Gerando assinatura...";
                else if (txs[0].installments && txs[0].installments > 1) msg = "Gerando parcelamento...";
                setGenerationMessage(msg);
            } else {
                setGenerationMessage(`Gerando ${txs.length} transações...`);
            }

            setTimeout(() => {
                txs.forEach(t => saveTransaction(t));
                setGenerationStatus('idle');
                
                let replyContent = txs.length === 1 ? "Pronto! Criei o lançamento." : `Pronto! Criei ${txs.length} lançamentos.`;
                setMessages(prev => [...prev, {
                    id: Date.now().toString() + '_ai',
                    role: 'assistant',
                    content: replyContent,
                    summaryData: txs,
                    summaryType: 'transaction'
                }]);
            }, 1500);
        }
        
        // Handle Reminders
        else if (result.type === 'reminder') {
            const rems = result.data as AIParsedReminder[];
            setGenerationMessage(rems.length === 1 ? "Gerando lembrete..." : `Gerando ${rems.length} lembretes...`);

            setTimeout(() => {
                rems.forEach(r => {
                    if (onCreateReminder) {
                        onCreateReminder({
                            description: r.description,
                            amount: r.amount,
                            category: r.category,
                            dueDate: r.dueDate,
                            type: r.type,
                            isRecurring: r.isRecurring,
                            frequency: r.frequency
                        });
                    }
                });
                setGenerationStatus('idle');
                
                let replyContent = rems.length === 1 ? "Pronto! Criei o lembrete." : `Pronto! Criei ${rems.length} lembretes.`;
                setMessages(prev => [...prev, {
                    id: Date.now().toString() + '_ai',
                    role: 'assistant',
                    content: replyContent,
                    summaryData: rems,
                    summaryType: 'reminder'
                }]);
            }, 1500);
        }

      } else {
        setGenerationStatus('idle');
        setMessages(prev => [...prev, {
            id: Date.now().toString() + '_err',
            role: 'assistant',
            content: "Não entendi muito bem. Tente dizer o valor e o nome, por exemplo: 'Mercado 50 reais' ou 'Lembrar conta luz dia 10'."
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
            status: 'completed'
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
        isRecurring: false,
        frequency: 'monthly'
      });
      setMode('ai');
    }, 300);
  };

  const categories = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Salário', 'Investimentos', 'Outros'];

  return (
    <div
      className={`
            fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-in-out
            ${isAnimating ? 'bg-black/90 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}
        `}
    >
      <motion.div
        initial={{ height: 600 }}
        animate={{ height: mode === 'ai' ? 600 : "auto" }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        className={`
            bg-gray-950 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-800 flex flex-col max-h-[90vh] relative transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
            ${isAnimating ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
        `}
      >

        {/* Background Effects Container */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#d97757]/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-700/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
        </div>

        {/* Header */}
        <div className="p-4 border-b border-gray-800/50 flex justify-between items-center relative z-10 shrink-0">
          <div className="flex gap-2 bg-gray-900/50 p-1 rounded-xl border border-gray-700/50 backdrop-blur-md">
            <button
              onClick={() => setMode('ai')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mode === 'ai' ? 'bg-gradient-to-r from-[#d97757] to-[#e68e70] text-white shadow-lg shadow-[#d97757]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
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
          <button onClick={handleClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative z-10 flex flex-col">

          {/* AI MODE */}
          {mode === 'ai' && (
            <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
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
                                    <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                        msg.role === 'user' 
                                        ? 'bg-[#d97757]/20 text-white rounded-br-none border border-[#d97757]/30' 
                                        : 'bg-gray-800/50 text-gray-200 rounded-bl-none border border-gray-700/50'
                                    }`}>
                                        {msg.content}
                                    </div>

                                    {/* Transaction Summary Card */}
                                    {msg.summaryData && (
                                        <TransactionSummaryCard transactions={msg.summaryData} />
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
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
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
                            disabled={!input.trim() || generationStatus !== 'idle'}
                            className="p-3 bg-[#d97757] hover:bg-[#c56a4d] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#d97757]/20"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </>
          )}

          {/* MANUAL MODE */}
          {mode === 'manual' && (
            <div className="p-6 overflow-y-auto custom-scrollbar">
                <form onSubmit={handleManualSubmit} className="space-y-5 animate-fade-in">
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Descrição</label>
                    <div className="relative group">
                    <FileSpreadsheet className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#d97757] transition-colors" size={16} />
                    <input
                        required
                        type="text"
                        value={manualForm.description}
                        onChange={e => setManualForm({ ...manualForm, description: e.target.value })}
                        placeholder="Ex: Supermercado"
                        className="input-primary pl-10 focus:border-[#d97757]"
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
                        value={manualForm.amount}
                        onChange={e => setManualForm({ ...manualForm, amount: e.target.value })}
                        placeholder="0,00"
                        className="input-primary pl-10 focus:border-[#d97757]"
                    />
                    </div>
                    </div>

                    <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Data</label>
                    <div className="relative group z-30">
                        <CustomDatePicker
                        value={manualForm.date}
                        onChange={(val) => setManualForm({ ...manualForm, date: val })}
                        />
                    </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Categoria</label>
                    <div className="relative group z-20">
                        <CustomAutocomplete
                        value={manualForm.category}
                        onChange={(val) => setManualForm({ ...manualForm, category: val })}
                        options={categories}
                        icon={<Tag size={16} />}
                        />
                    </div>
                    </div>

                    <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Tipo</label>
                    <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-700">
                        <button
                        type="button"
                        onClick={() => setManualForm({ ...manualForm, type: 'income' })}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${manualForm.type === 'income' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                        >
                        Receita
                        </button>
                        <button
                        type="button"
                        onClick={() => setManualForm({ ...manualForm, type: 'expense' })}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${manualForm.type === 'expense' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                        >
                        Despesa
                        </button>
                    </div>
                    </div>
                </div>

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
                              </div>                </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
